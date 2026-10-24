const nodemailer = require("nodemailer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  NODE_ENV,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  FRONTEND_BASE_URL,
} = require("../config/env");
const { getOtpCollection, getPasswordResetCollection } = require("../models");
const { buildPasswordSetupUrl } = require("../utils/urlUtils");
const templates = require("./emailTemplates");

const LOGO_PATH = path.resolve(__dirname, "../assets/rca-logo.png");
const PREVIEWS_DIR = path.resolve(__dirname, "../../tmp/email-previews");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSenderDomain() {
  const source = EMAIL_FROM || SMTP_USER || "noreply@rca.ac.rw";
  const match = source.match(/@([a-zA-Z0-9.-]+)/);
  return match ? match[1] : "rca.ac.rw";
}

function generateMessageId() {
  const domain = getSenderDomain();
  const rand = crypto.randomBytes(6).toString("hex");
  return `<${Date.now()}.${rand}@${domain}>`;
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || SMTP_HOST,
    port: Number(process.env.SMTP_PORT || SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : Boolean(SMTP_SECURE),
    user: process.env.SMTP_USER || SMTP_USER,
    pass: process.env.SMTP_PASS || SMTP_PASS,
    from: process.env.EMAIL_FROM || EMAIL_FROM,
  };
}

function isRealSmtpConfigured() {
  const conf = getSmtpConfig();
  if (!conf.host || !conf.user || !conf.pass) {
    return false;
  }

  const lowerHost = conf.host.toLowerCase();
  const lowerUser = conf.user.toLowerCase();
  const lowerPass = conf.pass.toLowerCase();

  const placeholderChecks = [
    { key: "SMTP_HOST", value: lowerHost, checks: ["example.com"] },
    {
      key: "SMTP_PASS",
      value: lowerPass,
      checks: ["your-sendgrid-api-key", "your-smtp-password", "your-app-password"],
    },
    {
      key: "SMTP_USER",
      value: lowerUser,
      checks: ["your-smtp-user", "your-email@gmail.com"],
    },
  ];

  for (const { value, checks } of placeholderChecks) {
    for (const check of checks) {
      if (value.includes(check)) {
        return false;
      }
    }
  }

  return true;
}

let cachedTransporter = null;
let cachedIsReal = null;

async function createMailTransporter() {
  const currentEnv = process.env.NODE_ENV || NODE_ENV || "production";
  const conf = getSmtpConfig();

  if (currentEnv === "production") {
    if (!isRealSmtpConfigured()) {
      console.error("[ERROR] Real SMTP is not configured in production environment.");
      const err = new Error("Real SMTP is not configured in production environment.");
      err.userMessage = "We could not send the email right now. Please try again in a minute.";
      throw err;
    }

    try {
      const transporter = nodemailer.createTransport({
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
        host: conf.host,
        port: conf.port,
        secure: conf.secure,
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 8000,
        auth: {
          user: conf.user,
          pass: conf.pass,
        },
      });

      await transporter.verify();
      return { transporter, isReal: true };
    } catch (err) {
      console.error("[ERROR] Production SMTP connection failed:", err.message);
      const error = new Error("Production SMTP connection failed: " + err.message);
      error.userMessage = "We could not send the email right now. Please try again in a minute.";
      throw error;
    }
  }

  // Non-production environment
  if (isRealSmtpConfigured()) {
    try {
      const transporter = nodemailer.createTransport({
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
        host: conf.host,
        port: conf.port,
        secure: conf.secure,
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 8000,
        auth: {
          user: conf.user,
          pass: conf.pass,
        },
      });

      await transporter.verify();
      return { transporter, isReal: true };
    } catch (err) {
      console.warn("[WARN] Real SMTP connection failed in dev, falling back to local test transporter:", err.message);
    }
  }

  // Use Ethereal test transporter strictly in development / testing
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return { transporter, isReal: false };
}

function getSender() {
  const fromAddress = process.env.EMAIL_FROM || EMAIL_FROM || SMTP_USER || "noreply@rca.ac.rw";
  if (fromAddress.includes("<")) return fromAddress;
  return `"RCA Archive" <${fromAddress}>`;
}

function getAttachments() {
  // Inbox placement optimization: no file attachments on transactional emails
  return [];
}

async function recordOutboxEntry(entry) {
  try {
    const { getEmailOutboxCollection } = require("../models");
    const col = getEmailOutboxCollection();
    if (col) {
      await col.insertOne({
        ...entry,
        createdAt: new Date(),
      });
    }
  } catch (err) {
    // Silent ignore if database is not initialized during unit tests
  }
}

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured in environment");
  const sender = getSender();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Resend API error: ${response.status}`);
  }

  return { id: data.id, isReal: true };
}

async function sendViaBrevo({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured in environment");

  const senderStr = getSender();
  let senderName = "RCA Archive";
  let senderEmail = "noreply@rca.ac.rw";
  const match = senderStr.match(/"?([^"<]+)"?\s*<([^>]+)>/);
  if (match) {
    senderName = match[1].trim();
    senderEmail = match[2].trim();
  } else if (senderStr.includes("@")) {
    senderEmail = senderStr.trim();
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Brevo API error: ${response.status}`);
  }

  return { id: data.messageId, isReal: true };
}

async function sendMailWithOptions({ to, subject, text, html }) {
  const messageId = generateMessageId();
  const provider = (process.env.MAIL_PROVIDER || "smtp").toLowerCase().trim();

  // 1. HTTP Provider: Resend
  if (provider === "resend") {
    try {
      const result = await sendViaResend({ to, subject, html, text });
      await recordOutboxEntry({
        to,
        subject,
        provider: "resend",
        status: "sent",
        attempts: 1,
        messageId: result.id,
        isReal: true,
        sentAt: new Date(),
      });
      return { info: result, previewUrl: null, isReal: true };
    } catch (err) {
      await recordOutboxEntry({
        to,
        subject,
        provider: "resend",
        status: "failed",
        attempts: 1,
        lastError: err.message,
        failedAt: new Date(),
      });
      throw err;
    }
  }

  // 2. HTTP Provider: Brevo
  if (provider === "brevo") {
    try {
      const result = await sendViaBrevo({ to, subject, html, text });
      await recordOutboxEntry({
        to,
        subject,
        provider: "brevo",
        status: "sent",
        attempts: 1,
        messageId: result.id,
        isReal: true,
        sentAt: new Date(),
      });
      return { info: result, previewUrl: null, isReal: true };
    } catch (err) {
      await recordOutboxEntry({
        to,
        subject,
        provider: "brevo",
        status: "failed",
        attempts: 1,
        lastError: err.message,
        failedAt: new Date(),
      });
      throw err;
    }
  }

  // 3. SMTP Provider (default)
  const replyTo = SMTP_USER || EMAIL_FROM || "support@rca.ac.rw";
  try {
    const { transporter, isReal } = await createMailTransporter();

    const mailOptions = {
      from: getSender(),
      to,
      replyTo,
      subject,
      text,
      html,
      messageId,
      headers: {
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "All",
        "Message-ID": messageId,
      },
      attachments: getAttachments(),
    };

    const info = await transporter.sendMail(mailOptions);
    let previewUrl = null;

    if (!isReal) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[INFO] Email preview (${subject}): ${previewUrl}`);
      }
    }

    await recordOutboxEntry({
      to,
      subject,
      provider: "smtp",
      status: "sent",
      attempts: 1,
      messageId,
      isReal,
      sentAt: new Date(),
    });

    return { info, previewUrl, isReal };
  } catch (err) {
    await recordOutboxEntry({
      to,
      subject,
      provider: "smtp",
      status: "failed",
      attempts: 1,
      lastError: err.message,
      failedAt: new Date(),
    });
    throw err;
  }
}

async function getEmailHealth() {
  const provider = (process.env.MAIL_PROVIDER || "smtp").toLowerCase();
  const configured = provider === "resend"
    ? Boolean(process.env.RESEND_API_KEY)
    : provider === "brevo"
    ? Boolean(process.env.BREVO_API_KEY)
    : isRealSmtpConfigured();

  let outboxStats = { total: 0, sent: 0, failed: 0 };
  let recentOutbox = [];

  try {
    const { getEmailOutboxCollection } = require("../models");
    const col = getEmailOutboxCollection();
    if (col) {
      const [total, sent, failed] = await Promise.all([
        col.countDocuments(),
        col.countDocuments({ status: "sent" }),
        col.countDocuments({ status: "failed" }),
      ]);
      outboxStats = { total, sent, failed };

      const docs = await col
        .find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      recentOutbox = docs.map((d) => {
        // Obfuscate recipient email local part for privacy in dashboard
        const emailParts = (d.to || "").split("@");
        const maskedTo = emailParts.length === 2
          ? `${emailParts[0].slice(0, 2)}***@${emailParts[1]}`
          : d.to;

        return {
          id: d._id?.toString(),
          to: maskedTo,
          subject: d.subject,
          status: d.status,
          provider: d.provider || "smtp",
          isReal: d.isReal,
          lastError: d.lastError || null,
          createdAt: d.createdAt,
          sentAt: d.sentAt || null,
          failedAt: d.failedAt || null,
        };
      });
    }
  } catch (err) {
    // Database check optional
  }

  return {
    status: configured ? "healthy" : "unconfigured",
    provider,
    isRealConfigured: configured,
    from: getSender(),
    outboxStats,
    recentOutbox,
  };
}

async function sendTestEmail(recipientEmail) {
  const t = {
    subject: "RCA Archive: Email Deliverability Test",
    text: `Hello,

This is an automated test message from your RCA Archive instance.
If you are seeing this message, your email transport settings and deliverability pipeline are operational.

Timestamp: ${new Date().toISOString()}
Provider: ${process.env.MAIL_PROVIDER || "smtp"}

Rwanda Coding Academy, Nyabihu Campus, Western Province, Rwanda.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1B2142;">
        <h2 style="color: #3F4FA8; margin-top: 0;">RCA Archive: Email Test</h2>
        <p>This is a verification message to confirm that your email provider and deliverability pipeline are functioning properly.</p>
        <div style="background: #F4F6FD; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <strong>Configuration Details:</strong>
          <ul style="margin: 8px 0 0 0; padding-left: 20px;">
            <li>Status: Connected and operational</li>
            <li>Provider: ${process.env.MAIL_PROVIDER || "smtp"}</li>
            <li>Timestamp: ${new Date().toISOString()}</li>
          </ul>
        </div>
        <p style="font-size: 13px; color: #6A7399;">Rwanda Coding Academy, Nyabihu Campus, Western Province, Rwanda.</p>
      </div>
    `,
  };

  return sendMailWithOptions({
    to: recipientEmail,
    subject: t.subject,
    text: t.text,
    html: t.html,
  });
}

async function sendVerificationEmail(email, otp) {
  const t = templates.getSignupVerificationTemplate({ code: otp, expiryMinutes: 15 });
  return sendMailWithOptions({
    to: email,
    subject: t.subject,
    text: t.text,
    html: t.html,
  });
}

async function sendSignupVerificationEmail({ email, code, expiryMinutes = 15 }) {
  const t = templates.getSignupVerificationTemplate({ code, expiryMinutes });
  return sendMailWithOptions({
    to: email,
    subject: t.subject,
    text: t.text,
    html: t.html,
  });
}

async function sendAccountInviteEmail(email, username, token, frontendBaseUrl, role = "teacher", temporaryPassword = null) {
  const signInUrl = `${frontendBaseUrl || FRONTEND_BASE_URL}/login`;
  const t = templates.getInvitationTemplate({
    name: username,
    role,
    email,
    temporaryPassword,
    signInUrl,
  });
  return sendMailWithOptions({
    to: email,
    subject: t.subject,
    text: t.text,
    html: t.html,
  });
}

async function sendTeacherInviteEmail(email, username, token, frontendBaseUrl, temporaryPassword = null) {
  return sendAccountInviteEmail(email, username, token, frontendBaseUrl, "teacher", temporaryPassword);
}

async function sendPasswordResetEmail(email, token, frontendBaseUrl, code = null) {
  const resetUrl = buildPasswordSetupUrl(frontendBaseUrl || FRONTEND_BASE_URL, token);
  const t = templates.getPasswordResetTemplate({
    name: email.split("@")[0],
    resetUrl,
    code,
  });
  return sendMailWithOptions({
    to: email,
    subject: t.subject,
    text: t.text,
    html: t.html,
  });
}

async function sendDeletionRequestDecisionEmail(email, paperTitle, status, notes = "") {
  const t = templates.getDeletionDecisionTemplate({
    name: email.split("@")[0],
    paperTitle,
    status,
    notes,
  });
  return sendMailWithOptions({
    to: email,
    subject: t.subject,
    text: t.text,
    html: t.html,
  });
}

async function sendSuspiciousLoginEmail(userOrEmail, ip) {
  const email = typeof userOrEmail === "string" ? userOrEmail : userOrEmail?.email;
  if (!email || typeof email !== "string") return;
  const name = typeof userOrEmail === "object" ? (userOrEmail.name || userOrEmail.username) : email.split("@")[0];
  const t = templates.getGenericNotificationTemplate({
    name,
    title: "Suspicious login attempt detected",
    message: `We observed multiple failed login attempts on your RCA Archive account${ip ? ` from IP address ${ip}` : ""}. If this was you, please reset your password. If not, your account remains secured.`,
    actionUrl: `${FRONTEND_BASE_URL}/reset-password`,
    actionText: "Secure Account",
  });
  return sendMailWithOptions({
    to: email,
    subject: t.subject || "Security Alert: Suspicious Login Attempts",
    text: t.text,
    html: t.html,
  });
}

async function cleanExpiredOtps() {
  try {
    const col = getOtpCollection();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    await col.deleteMany({
      createdAt: { $lt: tenMinutesAgo },
    });
  } catch (err) {
    console.warn("[WARN] Failed cleaning expired OTPs:", err.message);
  }
}

async function cleanExpiredPasswordResets() {
  try {
    const col = getPasswordResetCollection();
    await col.deleteMany({
      expiresAt: { $lt: Date.now() },
    });
  } catch (err) {
    console.warn("[WARN] Failed cleaning expired resets:", err.message);
  }
}

async function upsertTeacherInvite(email, token) {
  const col = getPasswordResetCollection();
  const normalizedEmail = email.toLowerCase().trim();
  await col.deleteMany({
    email: normalizedEmail,
    purpose: "teacher_setup",
  });
  await col.insertOne({
    email: normalizedEmail,
    token,
    purpose: "teacher_setup",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    createdAt: new Date().toISOString(),
  });
}

function renderAllEmailPreviews() {
  if (!fs.existsSync(PREVIEWS_DIR)) {
    fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
  }

  const sampleData = [
    {
      name: "signup-verification",
      data: templates.getSignupVerificationTemplate({ code: "482913", expiryMinutes: 15 }),
    },
    {
      name: "teacher-invitation",
      data: templates.getInvitationTemplate({
        name: "Teacher Mukamana",
        role: "teacher",
        setupUrl: "http://localhost:3074/reset-password/sample-teacher-token",
        temporaryPassword: "SampleTempPassword123",
      }),
    },
    {
      name: "student-invitation",
      data: templates.getInvitationTemplate({
        name: "Student Mugabo",
        role: "student",
        setupUrl: "http://localhost:3074/reset-password/sample-student-token",
      }),
    },
    {
      name: "password-reset",
      data: templates.getPasswordResetTemplate({
        name: "Jean Dupont",
        resetUrl: "http://localhost:3074/reset-password/sample-reset-token",
        code: "918234",
      }),
    },
    {
      name: "deletion-approved",
      data: templates.getDeletionDecisionTemplate({
        name: "Faculty Member",
        paperTitle: "Year 1 Term 2 Fundamentals of Programming CAT",
        status: "Approved",
        notes: "Verified that this file was superseded by a corrected examination scheme.",
      }),
    },
    {
      name: "deletion-rejected",
      data: templates.getDeletionDecisionTemplate({
        name: "Faculty Member",
        paperTitle: "Year 2 Data Structures Final Exam 2024",
        status: "Rejected",
        notes: "This exam paper is part of the accredited syllabus benchmark archives.",
      }),
    },
    {
      name: "generic-notification",
      data: templates.getGenericNotificationTemplate({
        name: "Student",
        title: "Assignment grades published",
        message: "Your instructor has reviewed and published grades for Database Systems Assignment 2.",
        actionUrl: "http://localhost:3074/student/assignments",
        actionText: "View Feedback",
      }),
    },
  ];

  const generatedPaths = [];
  for (const item of sampleData) {
    const filePath = path.join(PREVIEWS_DIR, `${item.name}.html`);
    fs.writeFileSync(filePath, item.data.html, "utf8");
    generatedPaths.push(filePath);
  }

  return generatedPaths;
}

module.exports = {
  isRealSmtpConfigured,
  createMailTransporter,
  generateOtp,
  sendVerificationEmail,
  sendSignupVerificationEmail,
  sendAccountInviteEmail,
  sendTeacherInviteEmail,
  sendPasswordResetEmail,
  sendDeletionRequestDecisionEmail,
  sendSuspiciousLoginEmail,
  cleanExpiredOtps,
  cleanExpiredPasswordResets,
  upsertTeacherInvite,
  renderAllEmailPreviews,
  getEmailHealth,
  sendTestEmail,
  templates,
};
