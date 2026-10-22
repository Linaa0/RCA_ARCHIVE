const nodemailer = require("nodemailer");
const crypto = require("crypto");
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

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isRealSmtpConfigured() {
  if (!SMTP_HOST) {
    console.log("❌ SMTP not configured: SMTP_HOST not set");
    return false;
  }
  if (!SMTP_USER) {
    console.log("❌ SMTP not configured: SMTP_USER not set");
    return false;
  }
  if (!SMTP_PASS) {
    console.log("❌ SMTP not configured: SMTP_PASS not set");
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

  for (const { key, value, checks } of placeholderChecks) {
    for (const check of checks) {
      if (value.includes(check)) {
        console.log(
          `❌ SMTP not configured: ${key} contains placeholder "${check}"`
        );
        return false;
      }
    }
  }

  return true;
}

async function createMailTransporter() {
  if (isRealSmtpConfigured()) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.verify();
      console.log("✅ SMTP connection verified successfully!");
      return { transporter, isReal: true };
    } catch (err) {
      console.warn(
        "⚠️ Real SMTP failed, falling back to test account:",
        err.message
      );
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
  return { transporter, isReal: false };
}

async function sendVerificationEmail(email, otp) {
  const { transporter, isReal } = await createMailTransporter();
  const sender = EMAIL_FROM || `"RCA Archive" <${SMTP_USER}>`;
  const info = await transporter.sendMail({
    from: sender,
    replyTo: SMTP_USER,
    to: email,
    subject: "Your RCA Archive verification code",
    text: `Your RCA teacher verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
    html: `
      <p>Your RCA teacher verification code is: <strong>${otp}</strong></p>
      <p>This code expires in 10 minutes.</p>
    `,
  });

  if (!isReal) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log("======================================");
    console.log("📧 OTP Email Preview URL:");
    console.log(previewUrl);
    console.log("======================================");
    return { info, previewUrl };
  }

  return { info, previewUrl: null };
}

async function sendAccountInviteEmail(
  email,
  username,
  token,
  frontendBaseUrl,
  role
) {
  const { transporter, isReal } = await createMailTransporter();
  const setupUrl = buildPasswordSetupUrl(frontendBaseUrl, token);
  const roleLabel = role === "student" ? "student" : "teacher";
  const sender = EMAIL_FROM || `"RCA Archive" <${SMTP_USER}>`;
  const info = await transporter.sendMail({
    from: sender,
    replyTo: SMTP_USER,
    to: email,
    subject: `Welcome to RCA Archive - Set up your ${roleLabel} account`,
    text:
      `Hello ${username || roleLabel},\n\n` +
      `An RCA Archive ${roleLabel} account has been created for you.\n` +
      `Please set your password using the link below (valid for 24 hours):\n\n${setupUrl}\n\n` +
      `After setting your password you can log in with your email and the password you chose.`,
    html: `
      <p>Hello <strong>${username || roleLabel}</strong>,</p>
      <p>An <strong>RCA Archive</strong> ${roleLabel} account has been created for you.</p>
      <p>Please set your password using the button below (link valid for 24 hours):</p>
      <p><a href="${setupUrl}" style="display:inline-block;padding:10px 18px;background:#0a7;color:#fff;border-radius:6px;text-decoration:none">Set your password</a></p>
      <p>Or open this link: <br><a href="${setupUrl}">${setupUrl}</a></p>
      <p>After setting your password, log in with your email and the password you chose.</p>
    `,
  });
  const previewUrl = !isReal ? nodemailer.getTestMessageUrl(info) : null;
  if (previewUrl) console.log(`📧 ${roleLabel} invite preview:`, previewUrl);
  return { previewUrl };
}

async function sendTeacherInviteEmail(email, username, token, frontendBaseUrl) {
  return sendAccountInviteEmail(
    email,
    username,
    token,
    frontendBaseUrl,
    "teacher"
  );
}

async function sendPasswordResetEmail(email, token, frontendBaseUrl) {
  const { transporter, isReal } = await createMailTransporter();
  const resetUrl = buildPasswordSetupUrl(
    frontendBaseUrl || FRONTEND_BASE_URL,
    token
  );

  const emailContent = {
    text: `Reset Your Password\n\nUse this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background: #f5f5f5;
      padding: 20px 12px;
    }
    .email-container {
      max-width: 360px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }
    .email-body {
      padding: 24px 20px;
      text-align: center;
    }
    .email-logo {
      color: #111111;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 20px;
    }
    .email-title {
      color: #111111;
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .email-subtitle {
      color: #666666;
      font-size: 12px;
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .reset-button {
      background: #111111;
      color: white;
      text-decoration: none;
      padding: 10px 32px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      display: inline-block;
      margin-bottom: 20px;
    }
    .expiry-note {
      color: #c53030;
      font-size: 11px;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .info-note {
      color: #888888;
      font-size: 11px;
      line-height: 1.5;
    }
    .email-footer {
      background: #f9f9f9;
      padding: 14px 20px;
      text-align: center;
      border-top: 1px solid #e0e0e0;
    }
    .footer-text {
      color: #aaaaaa;
      font-size: 10px;
      line-height: 1.5;
    }
    @media only screen and (max-width: 400px) {
      body { padding: 16px 10px; }
      .email-body { padding: 20px 16px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-body">
      <div class="email-logo">RCA ARCHIVE</div>
      <h1 class="email-title">Reset Your Password</h1>
      <p class="email-subtitle">Click the button below to reset your password.</p>
      <a class="reset-button" href="${resetUrl}" target="_blank" rel="noopener noreferrer">Reset Password</a>
      <p class="expiry-note">Expires in 1 hour</p>
      <p class="info-note">If you didn't request this, please ignore this email.</p>
    </div>
    <div class="email-footer">
      <p class="footer-text">
        &copy; ${new Date().getFullYear()} RCA Archive. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `,
  };

  const info = await transporter.sendMail({
    from: EMAIL_FROM || `"RCA Archive" <${SMTP_USER}>`,
    to: email,
    subject: "Reset your RCA Archive password",
    replyTo: SMTP_USER,
    text: emailContent.text,
    html: emailContent.html,
  });

  const previewUrl = !isReal ? nodemailer.getTestMessageUrl(info) : null;

  if (previewUrl) {
    console.log("======================================");
    console.log("📧 Password Reset Email Preview URL:");
    console.log(previewUrl);
    console.log("======================================");
  }

  return { info, previewUrl, realSmtp: isReal };
}

async function sendSuspiciousLoginEmail(user) {
  try {
    const { transporter } = await createMailTransporter();
    const emailSubject = "Suspicious Login Attempts on Your RCA Archive Account";
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">RCA Archive: Multiple Failed Login Attempts</h2>
        <p>Hi ${user.username || user.name || "there"},</p>
        <p>We noticed 3 failed login attempts to your RCA Archive account in the last hour. If this was you, you can try again in a little while.</p>
        <p>If this wasn't you, we recommend:</p>
        <ul>
          <li>Changing your password immediately</li>
          <li>Checking if your email account has been compromised</li>
          <li>Contacting support if you need further assistance</li>
        </ul>
        <p>Best regards,<br>RCA Archive Team</p>
      </div>
    `;
    const emailText = `
Hi ${user.username || user.name || "there"},

We noticed 3 failed login attempts to your RCA Archive account in the last hour. If this was you, you can try again in a little while.

If this wasn't you, we recommend:
- Changing your password immediately
- Checking if your email account has been compromised
- Contacting support if you need further assistance

Best regards,
RCA Archive Team
    `;

    await transporter.sendMail({
      from: EMAIL_FROM || "RCA Archive <no-reply@rcarchive.local>",
      to: user.email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });
  } catch (emailError) {
    console.error("Error sending suspicious login email:", emailError);
  }
}

async function cleanExpiredOtps() {
  const otpCollection = getOtpCollection();
  const now = Date.now();
  await otpCollection.deleteMany({ expiresAt: { $lte: now } });
}

async function cleanExpiredPasswordResets() {
  const resetCollection = getPasswordResetCollection();
  const now = Date.now();
  await resetCollection.deleteMany({ expiresAt: { $lte: now } });
}

function buildTeacherInviteRecord(email, token, purpose = "teacher_setup") {
  return {
    id: `${purpose}-${Date.now().toString()}`,
    email,
    token,
    purpose,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    createdAt: new Date().toISOString(),
  };
}

async function upsertTeacherInvite(email, purpose = "teacher_setup") {
  const resetCollection = getPasswordResetCollection();
  const token = crypto.randomBytes(24).toString("hex");
  const inviteRecord = buildTeacherInviteRecord(email, token, purpose);

  await cleanExpiredPasswordResets();
  await resetCollection.deleteMany({ email, purpose });
  await resetCollection.insertOne(inviteRecord);

  return { token, inviteRecord };
}

module.exports = {
  generateOtp,
  isRealSmtpConfigured,
  createMailTransporter,
  sendVerificationEmail,
  sendAccountInviteEmail,
  sendTeacherInviteEmail,
  sendPasswordResetEmail,
  sendSuspiciousLoginEmail,
  cleanExpiredOtps,
  cleanExpiredPasswordResets,
  buildTeacherInviteRecord,
  upsertTeacherInvite,
};
