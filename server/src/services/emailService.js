const nodemailer = require("nodemailer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
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

function isRealSmtpConfigured() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return false;
  }

  const lowerHost = SMTP_HOST.toLowerCase();
  const lowerUser = SMTP_USER.toLowerCase();
  const lowerPass = SMTP_PASS.toLowerCase();

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
  if (cachedTransporter) {
    return { transporter: cachedTransporter, isReal: cachedIsReal };
  }

  if (isRealSmtpConfigured()) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Boolean(SMTP_SECURE),
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.verify();
      console.log("[OK] SMTP connection verified successfully.");
      cachedTransporter = transporter;
      cachedIsReal = true;
      return { transporter, isReal: true };
    } catch (err) {
      console.warn("[WARN] Real SMTP connection failed, using local test transporter:", err.message);
    }
  }

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
  cachedTransporter = transporter;
  cachedIsReal = false;
  return { transporter, isReal: false };
}

function getSender() {
  const fromAddress = EMAIL_FROM || SMTP_USER || "noreply@rca.ac.rw";
  if (fromAddress.includes("<")) return fromAddress;
  return `"RCA Archive" <${fromAddress}>`;
}

function getAttachments() {
  if (fs.existsSync(LOGO_PATH)) {
    return [
      {
        filename: "rca-logo.png",
        path: LOGO_PATH,
        cid: "rcalogo",
      },
    ];
  }
  return [];
}

async function sendMailWithOptions({ to, subject, text, html }) {
  const { transporter, isReal } = await createMailTransporter();
  const messageId = generateMessageId();
  const replyTo = SMTP_USER || EMAIL_FROM || "support@rca.ac.rw";

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

  return { info, previewUrl, isReal };
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
  const setupUrl = buildPasswordSetupUrl(frontendBaseUrl || FRONTEND_BASE_URL, token);
  const t = templates.getInvitationTemplate({
    name: username,
    role,
    setupUrl,
    temporaryPassword,
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

async function sendSuspiciousLoginEmail(email, ip, userAgent) {
  const t = templates.getGenericNotificationTemplate({
    name: email.split("@")[0],
    title: "Suspicious login attempt detected",
    message: `We observed multiple failed login attempts on your RCA Archive account from IP address ${ip || "unknown"}. If this was you, please reset your password. If not, your account remains secured.`,
    actionUrl: `${FRONTEND_BASE_URL}/reset-password`,
    actionText: "Secure Account",
  });
  return sendMailWithOptions({
    to: email,
    subject: t.subject,
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
  templates,
};
