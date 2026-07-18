const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const fs = require("fs");
const {
  connectToMongo,
  getUsersCollection,
  getPapersCollection,
  getOtpCollection,
  getPasswordResetCollection,
  getDeletionRequestsCollection,
  getFailedLoginAttemptsCollection,
} = require("./db");

const app = express();
const PORT = process.env.PORT || 5077;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "http://localhost:3074";
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_not_secure";
const ADMIN_BOOTSTRAP_SECRET = process.env.ADMIN_BOOTSTRAP_SECRET || "";

const HARDCODED_ADMINS = [
  "deenovdunya01@gmail.com",
  "chretiensano@gmail.com",
  "mucyoasifiwe80@gmail.com",
];

if (!process.env.JWT_SECRET) {
  console.warn(
    "Warning: JWT_SECRET is not set. Using insecure fallback for development. Set `JWT_SECRET` in the environment for production.",
  );
}

async function initDB() {
  await connectToMongo();
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isRealSmtpConfigured() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    console.log("❌ SMTP not configured: SMTP_HOST not set");
    return false;
  }
  if (!user) {
    console.log("❌ SMTP not configured: SMTP_USER not set");
    return false;
  }
  if (!pass) {
    console.log("❌ SMTP not configured: SMTP_PASS not set");
    return false;
  }

  // Treat typical placeholders and examples as unconfigured
  const lowerHost = host.toLowerCase();
  const lowerUser = user.toLowerCase();
  const lowerPass = pass.toLowerCase();

  const placeholderChecks = [
    { key: "SMTP_HOST", value: lowerHost, checks: ["example.com"] },
    {
      key: "SMTP_PASS",
      value: lowerPass,
      checks: [
        "your-sendgrid-api-key",
        "your-smtp-password",
        "your-app-password",
      ],
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
          `❌ SMTP not configured: ${key} contains placeholder "${check}"`,
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
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        // Add these for Gmail-specific settings
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Verify connection
      await transporter.verify();
      console.log("✅ SMTP connection verified successfully!");
      return { transporter, isReal: true };
    } catch (err) {
      console.warn(
        "⚠️ Real SMTP failed, falling back to test account:",
        err.message,
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
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"RCA Archive" <no-reply@rcarchive.local>',
    to: email,
    subject: "RCA Archive Teacher Verification Code",
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

function getFrontendBaseUrl(req) {
  if (process.env.FRONTEND_BASE_URL) {
    return process.env.FRONTEND_BASE_URL.replace(/\/$/, "");
  }

  const origin = req?.get?.("origin") || req?.headers?.origin;
  if (origin) {
    return origin.replace(/\/$/, "");
  }

  const referer = req?.get?.("referer") || req?.headers?.referer;
  if (referer) {
    try {
      return new URL(referer).origin.replace(/\/$/, "");
    } catch (error) {
      // ignore invalid referer value
    }
  }

  return "http://localhost:3074";
}

function buildPasswordSetupUrl(frontendBaseUrl, token) {
  const baseUrl = (frontendBaseUrl || "http://localhost:3074").replace(
    /\/$/,
    "",
  );
  return `${baseUrl}/reset-password/${encodeURIComponent(token)}`;
}

async function sendTeacherInviteEmail(email, username, token, frontendBaseUrl) {
  const { transporter, isReal } = await createMailTransporter();
  const setupUrl = buildPasswordSetupUrl(frontendBaseUrl, token);
  const info = await transporter.sendMail({
    from: `"RCA Archive" <${process.env.SMTP_FROM || "no-reply@rca.ac.rw"}>`,
    to: email,
    subject: "Welcome to RCA Archive — Set up your teacher account",
    text:
      `Hello ${username || "Teacher"},\n\n` +
      `An RCA Archive teacher account has been created for you.\n` +
      `Please set your password using the link below (valid for 24 hours):\n\n${setupUrl}\n\n` +
      `After setting your password you can log in with your email and the password you chose.`,
    html: `
      <p>Hello <strong>${username || "Teacher"}</strong>,</p>
      <p>An <strong>RCA Archive</strong> teacher account has been created for you.</p>
      <p>Please set your password using the button below (link valid for 24 hours):</p>
      <p><a href="${setupUrl}" style="display:inline-block;padding:10px 18px;background:#0a7;color:#fff;border-radius:6px;text-decoration:none">Set your password</a></p>
      <p>Or open this link: <br><a href="${setupUrl}">${setupUrl}</a></p>
      <p>After setting your password, log in with your email and the password you chose.</p>
    `,
  });
  const previewUrl = !isReal ? nodemailer.getTestMessageUrl(info) : null;
  if (previewUrl) console.log("📧 Teacher invite preview:", previewUrl);
  return { previewUrl };
}

async function sendPasswordResetEmail(email, token, frontendBaseUrl) {
  const { transporter, isReal } = await createMailTransporter();
  const resetUrl = buildPasswordSetupUrl(
    frontendBaseUrl || FRONTEND_BASE_URL,
    token,
  );

  // Create beautiful email template
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

  const timestamp = new Date().toLocaleTimeString();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || "RCA Archive <no-reply@rcarchive.local>",
    to: email,
    subject: `Reset Your RCA Archive Password - ${timestamp}`,
    replyTo: process.env.EMAIL_FROM || "no-reply@rcarchive.local",
    text: emailContent.text,
    html: emailContent.html,
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      Importance: "High",
      "List-Unsubscribe":
        "<mailto:isabelleutuje12@gmail.com?subject=Unsubscribe>",
      Precedence: "bulk",
      "X-Mailer": "Node.js",
      "Content-Type": "text/html; charset=utf-8",
    },
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

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      ALLOWED_EXTENSIONS.includes(ext) &&
      ALLOWED_MIME_TYPES.includes(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only PDF and Word documents (.pdf, .doc, .docx) are allowed.",
        ),
      );
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

const defaultCorsOrigins = [
  "https://rcaarchive.innov.rw",
  "https://rca-archive.vercel.app",
  "http://localhost:3000",
  "http://localhost:3074",
];

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultCorsOrigins, ...corsOrigins])];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", async (_req, res) => {
  try {
    const papers = getPapersCollection();
    await papers.findOne({}, { projection: { _id: 1 } });
    res.json({ status: "ok", service: "rca-archive-backend" });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(503).json({ status: "error", message: "Database unavailable" });
  }
});

app.get("/uploads/:filename", async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadDir, filename);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  try {
    const papers = getPapersCollection();
    const paper = await papers.findOne({ filename });
    if (paper) {
      const paperPath = path.join(uploadDir, paper.filename);
      if (fs.existsSync(paperPath)) {
        return res.sendFile(paperPath);
      }
    }
  } catch (err) {
    console.error("Error resolving upload file:", err);
  }

  return res.status(404).json({ error: "File not found" });
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
}

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one letter",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one number",
    };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      valid: false,
      message:
        "Password must contain at least one special character (!@#$%^&*()_+-=[]{};':\"\\|,.<>/?)",
    };
  }

  return { valid: true };
}

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const users = getUsersCollection();
  let user = await users.findOne({ email: normalizedEmail });
  if (user) return user;
  return users.findOne({
    email: { $regex: new RegExp(`^${escapeRegExp(normalizedEmail)}$`, "i") },
  });
}

async function findUserById(id) {
  const users = getUsersCollection();
  return users.findOne({ id: String(id) });
}

app.get("/api/papers", async (req, res) => {
  const papers = getPapersCollection();
  const { subject, year, type, search, sort, limit } = req.query;
  const filter = {};

  if (subject) filter.subject = subject;
  if (year) filter.year = year;
  if (type && type !== "All Types") filter.type = type;
  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    filter.$or = [{ title: regex }, { subject: regex }, { type: regex }];
  }

  const paperDocs = await papers.find(filter).toArray();
  let result = paperDocs.map(buildRatingSummary);

  if (sort === "top") {
    result.sort((a, b) => {
      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }
      return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    });
  } else if (sort === "recent") {
    result.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  const parsedLimit = Number(limit);
  if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
    result = result.slice(0, parsedLimit);
  }

  res.json(result);
});

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch?.[1];

  if (!token) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (
      !payload ||
      typeof payload.id !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string"
    ) {
      throw new Error("Invalid token payload");
    }

    findUserByEmail(payload.email)
      .then((user) => {
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }

        if (user.status === "disabled") {
          return res.status(403).json({ error: "Account is disabled" });
        }

        req.user = {
          id: user.id || payload.id,
          email: user.email,
          username: user.name || user.username || payload.username,
          name: user.name || user.username || payload.username,
          role: user.role,
          status: user.status || "active",
        };
        next();
        return null;
      })
      .catch((error) => {
        console.error("Auth lookup failed:", error);
        return res.status(500).json({ error: "Authentication failed" });
      });
  } catch (err) {
    console.error("Auth failed:", err.message || err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function getDisplayName(user) {
  return user?.name || user?.username || user?.email || "Unknown user";
}

function safeUserFields(user) {
  if (!user) return null;

  return {
    id: user.id || String(user._id || ""),
    name: user.name || user.username || "",
    username: user.username || user.name || "",
    email: user.email,
    role: user.role,
    status: user.status || "active",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    createdBy: user.createdBy,
    disabledAt: user.disabledAt,
  };
}

async function getPaperById(paperId) {
  const papers = getPapersCollection();
  return papers.findOne({ id: paperId });
}

async function permanentlyDeletePaperRecord(paper, reason, actor) {
  if (!paper) return;

  const filePath = path.join(uploadDir, paper.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  const papers = getPapersCollection();
  await papers.deleteOne({ id: paper.id });

  console.log(
    `[PAPER_DELETE] id=${paper.id} title="${paper.title}" actor=${actor?.email || "system"} role=${actor?.role || "system"} reason="${reason || "n/a"}"`,
  );
}

function canUseAdminBootstrapRoute(req) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  if (!ADMIN_BOOTSTRAP_SECRET) {
    return false;
  }

  const providedSecret = req.headers["x-admin-bootstrap-secret"];
  return providedSecret === ADMIN_BOOTSTRAP_SECRET;
}

function hashFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function buildRatingSummary(paper) {
  const ratings = paper.ratings || [];
  const ratingCount = ratings.length;
  const averageRating = ratingCount
    ? Number(
        (ratings.reduce((sum, r) => sum + r.value, 0) / ratingCount).toFixed(1),
      )
    : 0;

  return {
    ...paper,
    ratings,
    ratingCount,
    averageRating,
    viewUrl: `${BASE_URL}/api/papers/${paper.id}/view`,
    downloadUrl: `${BASE_URL}/api/papers/${paper.id}/download`,
  };
}

// Send OTP for ANY operation (signup, login, password reset)
app.post("/api/send-otp", async (req, res) => {
  const { email, operation } = req.body;

  if (!email || !operation) {
    return res.status(400).json({ error: "Email and operation are required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const users = getUsersCollection();
  const otpCollection = getOtpCollection();

  // Check if email exists for login/password reset, or doesn't exist for signup
  const userExists = await findUserByEmail(email);
  if (operation === "signup") {
    if (userExists) {
      return res.status(400).json({ error: "Email already registered" });
    }
  } else if (operation === "login" || operation === "reset-password") {
    if (!userExists) {
      return res.json({
        message: "If this email is registered, you'll receive an OTP shortly.",
      });
    }
  }

  await cleanExpiredOtps();
  const otp = generateOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  await otpCollection.deleteMany({
    email: email.toLowerCase(),
    operation,
  });
  await otpCollection.insertOne({
    email: email.toLowerCase(),
    code: otp,
    operation,
    expiresAt,
  });

  try {
    console.log("📧 Starting send-otp process...");
    console.log("📧 Email to send to:", email);
    console.log("📧 Operation type:", operation);

    // Create beautiful email template
    const createEmailTemplate = (operation, otpCode) => {
      let title, subtitle;
      if (operation === "signup") {
        title = "Verify Your Account";
        subtitle =
          "Welcome to RCA Archive! Please use the verification code below to complete your signup.";
      } else if (operation === "login") {
        title = "Login Verification";
        subtitle = "Use this code to log in to your RCA Archive account.";
      } else if (operation === "reset-password") {
        title = "Reset Your Password";
        subtitle = "Use this verification code to reset your password.";
      }

      console.log("📧 Email template created with OTP:", otpCode);

      return {
        text: `${title}\n\n${subtitle}\n\nYour verification code: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
    .otp-card {
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 14px 16px;
      text-align: center;
      margin-bottom: 20px;
      display: inline-block;
    }
    .otp-label {
      color: #666666;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .otp-code {
      color: #111111;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 4px;
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
      .otp-code { font-size: 20px; letter-spacing: 3px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-body">
      <div class="email-logo">RCA ARCHIVE</div>
      <h1 class="email-title">${title}</h1>
      <p class="email-subtitle">${subtitle}</p>
      <div class="otp-card">
        <div class="otp-label">Verification Code</div>
        <div class="otp-code">${otpCode}</div>
      </div>
      <p class="expiry-note">Expires in 10 minutes</p>
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
    };

    // Determine subject and generate email content
    let subject;
    if (operation === "signup") {
      const timestamp = new Date().toLocaleTimeString();
      subject = `Verify your RCA Archive account - ${timestamp}`;
    } else if (operation === "login") {
      const timestamp = new Date().toLocaleTimeString();
      subject = `Your RCA Archive login code - ${timestamp}`;
    } else if (operation === "reset-password") {
      const timestamp = new Date().toLocaleTimeString();
      subject = `Your RCA Archive password reset code - ${timestamp}`;
    }
    console.log("📧 Email subject:", subject);

    const emailContent = createEmailTemplate(operation, otp);
    console.log("📧 Email content generated successfully");

    console.log("📧 Getting mail transporter...");
    const { transporter, isReal } = await createMailTransporter();
    console.log("📧 Transporter obtained. isReal:", isReal);

    const mailOptions = {
      from: process.env.EMAIL_FROM || "RCA Archive <no-reply@rcarchive.local>",
      to: email,
      subject: subject,
      replyTo: process.env.EMAIL_FROM || "no-reply@rcarchive.local",
      text: emailContent.text,
      html: emailContent.html,
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        Importance: "High",
        "List-Unsubscribe":
          "<mailto:isabelleutuje12@gmail.com?subject=Unsubscribe>",
        Precedence: "bulk",
        "X-Mailer": "Node.js",
        "Content-Type": "text/html; charset=utf-8",
      },
    };
    console.log("📧 Mail options:", mailOptions);

    console.log("📧 Sending email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("📧 Email sent successfully! Info:", info);

    let previewUrl = null;
    if (!isReal) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("======================================");
      console.log("📧 OTP Email Preview URL:");
      console.log(previewUrl);
      console.log("======================================");
    }

    // Log OTP in dev for testing, but don't send to client
    console.log(`🔐 OTP for ${email} (${operation}): ${otp}`);

    res.json({
      message: isReal
        ? "OTP sent successfully. Check your email for the code."
        : "OTP sent successfully! Check the server logs for the preview URL.",
      previewUrl,
    });
  } catch (err) {
    console.error("❌ Detailed OTP email error:", {
      message: err.message,
      code: err.code,
      stack: err.stack,
    });
    // Still log OTP in dev even if email fails
    console.log(`🔐 OTP for ${email} (${operation}): ${otp}`);
    if (process.env.NODE_ENV !== "production") {
      return res.json({
        message: `OTP email failed to send, but check server logs for the code.`,
        error: err.message,
      });
    }
    return res.status(500).json({
      error: "Failed to send OTP email. Please try again later.",
    });
  }
});

// Keep the old endpoint for backward compatibility
app.post("/api/send-teacher-otp", async (req, res) => {
  req.body.operation = "signup";
  // Call the new send-otp endpoint handler
  const handler = app._router.stack.find(
    (layer) => layer.route && layer.route.path === "/api/send-otp",
  ).handle;
  return handler(req, res);
});

app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const user = await findUserByEmail(email);

  if (!user) {
    return res.json({
      message:
        "If this email is registered, you'll receive a password reset link shortly.",
    });
  }

  const resetCollection = getPasswordResetCollection();
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 60 * 60 * 1000;

  await cleanExpiredPasswordResets();
  await resetCollection.deleteMany({
    email: normalizedEmail,
    purpose: "password_reset",
  });
  await resetCollection.insertOne({
    email: normalizedEmail,
    token,
    expiresAt,
    purpose: "password_reset",
    createdAt: new Date().toISOString(),
  });

  try {
    const frontendBaseUrl = getFrontendBaseUrl(req);
    const { previewUrl } = await sendPasswordResetEmail(
      email,
      token,
      frontendBaseUrl,
    );

    return res.json({
      message:
        "If this email is registered, you'll receive a password reset link shortly.",
      previewUrl,
    });
  } catch (err) {
    console.error("❌ Password reset email failed:", err);
    console.error(
      "👉 Troubleshooting: If you intended to send real emails, verify your SMTP credentials in `rcabackend/.env`. " +
        "If you are developing locally, you can clear the placeholder values (SMTP_HOST, SMTP_USER, SMTP_PASS) to enable the instant development fallback reset link.",
    );
    if (!isRealSmtpConfigured()) {
      const resetUrl = buildPasswordSetupUrl(getFrontendBaseUrl(req), token);
      return res.json({
        message:
          "If this email is registered, you'll receive a password reset link shortly.",
        previewUrl: resetUrl,
      });
    }
    return res.status(500).json({
      error:
        "Failed to send password reset email. Please try again later. Verify server SMTP logs for details.",
    });
  }
});

app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword, otp } = req.body;

  // Allow both token-based and OTP-based reset
  if ((!token && !otp) || !newPassword) {
    return res.status(400).json({
      error:
        "Either token and new password or OTP, email and new password are required.",
    });
  }

  // Validate password strength
  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.message });
  }

  if (token) {
    const resetCollection = getPasswordResetCollection();
    const resetRecord = await resetCollection.findOne({ token });

    if (!resetRecord || resetRecord.expiresAt <= Date.now()) {
      return res.status(400).json({ error: "Token is invalid or expired." });
    }

    const users = getUsersCollection();
    const user = await users.findOne({
      email: normalizeEmail(resetRecord.email),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const shouldActivateAccount =
      resetRecord.purpose === "teacher_setup" ||
      user.status === "pending_password_setup" ||
      !user.password;

    const update = {
      password: hashedPassword,
      updatedAt: new Date().toISOString(),
    };

    if (shouldActivateAccount) {
      update.status = "active";
    }

    await users.updateOne(
      { email: normalizeEmail(resetRecord.email) },
      {
        $set: update,
      },
    );

    await resetCollection.deleteMany({
      email: normalizeEmail(resetRecord.email),
    });

    return res.json({ message: "Password has been reset successfully." });
  }

  if (otp) {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ error: "Email is required for OTP-based reset." });
    }

    const normalizedEmail = normalizeEmail(email);
    const otpCollection = getOtpCollection();
    const otpRecord = await otpCollection.findOne({
      email: normalizedEmail,
      operation: "reset-password",
    });

    if (
      !otpRecord ||
      otpRecord.code !== otp ||
      otpRecord.expiresAt <= Date.now()
    ) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    const users = getUsersCollection();
    const user = await users.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const update = {
      password: hashedPassword,
      updatedAt: new Date().toISOString(),
    };
    if (user.status === "pending_password_setup" || !user.password) {
      update.status = "active";
    }

    await users.updateOne({ email: normalizedEmail }, { $set: update });

    await otpCollection.deleteMany({
      email: normalizedEmail,
      operation: "reset-password",
    });

    return res.json({ message: "Password has been reset successfully." });
  }

  return res.status(400).json({ error: "Invalid reset request." });
});

app.post("/api/signup", async (req, res) => {
  const { email, password, otp, role, username } = req.body;

  if (!email || !password || !username) {
    return res
      .status(400)
      .json({ error: "Email, password, and username are required" });
  }

  // Validate password strength
  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.message });
  }

  if (role === "teacher") {
    return res.status(403).json({
      error: "Teacher accounts can only be created by an administrator.",
    });
  }

  const normalizedEmail = normalizeEmail(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const users = getUsersCollection();
  const otpCollection = getOtpCollection();

  const exists = await findUserByEmail(email);
  if (exists) {
    return res.status(400).json({ error: "Email already registered" });
  }

  await cleanExpiredOtps();
  const otpRecord = await otpCollection.findOne({
    email: normalizedEmail,
    operation: "signup",
  });

  if (!otpRecord || !otp || otpRecord.code !== otp) {
    return res.status(400).json({
      error: "Invalid or expired OTP. Please request a new verification code.",
      requiresOtp: true,
    });
  }

  await otpCollection.deleteMany({
    email: normalizedEmail,
    operation: "signup",
  });

  const hashed = await bcrypt.hash(password, 10);

  const user = {
    id: Date.now().toString(),
    email: normalizedEmail,
    username: username.trim() || normalizedEmail.split("@")[0],
    password: hashed,
    role: "student",
    status: "active",
    createdAt: new Date().toISOString(),
  };

  await users.insertOne(user);

  res.json({
    message: "Account created successfully!",
    role: "student",
    email,
    username: user.username,
  });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  if (user.status === "disabled") {
    return res.status(403).json({ error: "This account is disabled." });
  }

  // Block invited teachers who haven't set their password yet
  if (user.status === "pending_password_setup" || !user.password) {
    return res.status(403).json({
      error:
        "Please set your password first using the link sent to your email.",
    });
  }

  const normalizedEmail = normalizeEmail(email);
  const failedAttemptsCollection = getFailedLoginAttemptsCollection();

  // Clean up old failed attempts (older than 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await failedAttemptsCollection.deleteMany({
    email: normalizedEmail,
    createdAt: { $lt: oneHourAgo },
  });

  // Get current failed attempts count
  const initialAttempts = await failedAttemptsCollection.countDocuments({
    email: normalizedEmail,
    createdAt: { $gte: oneHourAgo },
  });

  console.log("Initial failed attempts count:", initialAttempts);

  if (initialAttempts >= 3) {
    return res.status(429).json({
      error:
        "Too many failed login attempts. Please try again later or check your email for further instructions.",
    });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    // Increment failed attempts
    await failedAttemptsCollection.insertOne({
      email: normalizedEmail,
      ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      createdAt: new Date().toISOString(),
    });

    const newAttemptsCount = initialAttempts + 1;
    const attemptsLeft = 3 - newAttemptsCount;
    console.log(
      "New attempts count:",
      newAttemptsCount,
      "Attempts left:",
      attemptsLeft,
    );

    // If this is the 3rd failed attempt, send an email
    if (newAttemptsCount === 3) {
      try {
        const { transporter } = await createMailTransporter();
        const emailSubject =
          "Suspicious Login Attempts on Your RCA Archive Account";
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
          from:
            process.env.EMAIL_FROM || "RCA Archive <no-reply@rcarchive.local>",
          to: user.email,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error("Error sending suspicious login email:", emailError);
      }
    }

    return res.status(400).json({
      error: "Wrong password",
      attemptsLeft: attemptsLeft,
    });
  }

  // Reset failed attempts on successful login
  await failedAttemptsCollection.deleteMany({ email: normalizedEmail });

  // Check if user is hardcoded admin and update role if needed
  let role = user.role;
  if (HARDCODED_ADMINS.includes(normalizedEmail) && role !== "admin") {
    const users = getUsersCollection();
    await users.updateOne(
      { email: normalizedEmail },
      { $set: { role: "admin", updatedAt: new Date().toISOString() } },
    );
    role = "admin";
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.name || user.username,
      role: role,
    },
    JWT_SECRET,
    { expiresIn: "12h" },
  );

  res.json({
    token,
    email: user.email,
    username: user.username,
    role: role,
  });
});

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

async function storePendingDeletionRequest(request) {
  const deletionRequests = getDeletionRequestsCollection();
  await deletionRequests.insertOne(request);
  return request;
}

// Admin creates a teacher account (no password, sends setup email)
app.post("/api/admin/teachers", requireAuth, requireAdmin, async (req, res) => {
  const { email, name, username } = req.body;
  const teacherName = (name || username || "").trim();

  if (!email || !teacherName) {
    return res
      .status(400)
      .json({ error: "Teacher name and email are required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalizedEmail = normalizeEmail(email);
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  const users = getUsersCollection();

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    return res
      .status(400)
      .json({ error: "A user with this email already exists" });
  }

  const teacher = {
    id: Date.now().toString(),
    email: normalizedEmail,
    name: teacherName,
    username: teacherName,
    password: null,
    role: "teacher",
    status: "pending_password_setup",
    createdAt: new Date().toISOString(),
    createdBy: req.user.email,
  };
  await users.insertOne(teacher);

  try {
    const { token } = await upsertTeacherInvite(
      normalizedEmail,
      "teacher_setup",
    );
    const { previewUrl } = await sendTeacherInviteEmail(
      normalizedEmail,
      teacherName,
      token,
      getFrontendBaseUrl(req),
    );
    return res.json({
      message: "Teacher created. Setup email sent.",
      teacher: safeUserFields(teacher),
      previewUrl,
    });
  } catch (err) {
    console.error("❌ Teacher invite email failed:", err);
    // Account exists; admin can resend
    return res.status(500).json({
      error:
        "Teacher created but email failed to send. Use 'Resend invite' to retry.",
    });
  }
});

// Optional: resend invite
app.post(
  "/api/admin/teachers/resend-invite",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByEmail(email);
    if (!user || user.role !== "teacher")
      return res.status(404).json({ error: "Teacher not found" });
    if (user.status !== "pending_password_setup") {
      return res.status(400).json({ error: "Teacher already activated" });
    }
    const resetCollection = getPasswordResetCollection();
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    await cleanExpiredPasswordResets();
    await resetCollection.deleteMany({
      email: normalizedEmail,
      purpose: "teacher_setup",
    });
    await resetCollection.insertOne({
      email: normalizedEmail,
      token,
      expiresAt,
      purpose: "teacher_setup",
      createdAt: new Date().toISOString(),
    });
    const { previewUrl } = await sendTeacherInviteEmail(
      normalizedEmail,
      user.name || user.username || "Teacher",
      token,
      getFrontendBaseUrl(req),
    );
    res.json({ message: "Invite resent", previewUrl });
  },
);

// Optional: list teachers
app.get("/api/admin/teachers", requireAuth, requireAdmin, async (_req, res) => {
  const users = getUsersCollection();
  const teachers = await users
    .find({ role: "teacher" }, { projection: { password: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  res.json({ teachers: teachers.map(safeUserFields) });
});

app.put(
  "/api/admin/teachers/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const users = getUsersCollection();
    const currentTeacher = await findUserById(id);

    if (!currentTeacher || currentTeacher.role !== "teacher") {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const { name, email, status } = req.body;
    const update = {};

    if (typeof name === "string") {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ error: "Teacher name cannot be empty" });
      }
      update.name = trimmedName;
      update.username = trimmedName;
    }

    let normalizedEmail = currentTeacher.email;
    const emailChanged =
      typeof email === "string" &&
      normalizeEmail(email) !== currentTeacher.email;

    if (typeof email === "string") {
      normalizedEmail = normalizeEmail(email);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const existing = await findUserByEmail(normalizedEmail);
      if (existing && existing.id !== currentTeacher.id) {
        return res
          .status(400)
          .json({ error: "A user with this email already exists" });
      }

      update.email = normalizedEmail;
    }

    if (typeof status === "string") {
      const allowedStatuses = ["active", "pending_password_setup", "disabled"];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid teacher status" });
      }
      update.status = status;
      update.disabledAt =
        status === "disabled" ? new Date().toISOString() : null;
    }

    update.updatedAt = new Date().toISOString();

    await users.updateOne({ id: currentTeacher.id }, { $set: update });

    let previewUrl = null;
    const refreshedTeacher = await findUserById(currentTeacher.id);
    if (emailChanged && refreshedTeacher.status === "pending_password_setup") {
      const { token } = await upsertTeacherInvite(
        normalizedEmail,
        "teacher_setup",
      );
      const invite = await sendTeacherInviteEmail(
        normalizedEmail,
        getDisplayName(refreshedTeacher),
        token,
        getFrontendBaseUrl(req),
      );
      previewUrl = invite.previewUrl;
    }

    console.log(
      `[TEACHER_UPDATE] id=${currentTeacher.id} actor=${req.user.email} changes=${Object.keys(update).join(",")}`,
    );

    return res.json({
      message: "Teacher updated successfully.",
      teacher: safeUserFields(await findUserById(currentTeacher.id)),
      previewUrl,
    });
  },
);

app.delete(
  "/api/admin/teachers/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const users = getUsersCollection();
    const teacher = await findUserById(id);

    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({ error: "Teacher not found" });
    }

    await users.deleteOne({ id: teacher.id });
    await getPasswordResetCollection().deleteMany({
      email: teacher.email,
      purpose: "teacher_setup",
    });

    console.log(
      `[TEACHER_DELETE] id=${teacher.id} email=${teacher.email} actor=${req.user.email}`,
    );

    return res.json({ message: "Teacher account deleted successfully." });
  },
);

app.get("/api/admin/stats", requireAuth, requireAdmin, async (_req, res) => {
  const users = getUsersCollection();
  const papers = getPapersCollection();
  const deletionRequests = getDeletionRequestsCollection();

  const [
    totalUsers,
    totalStudents,
    totalTeachers,
    totalPapers,
    pendingDeletionRequests,
  ] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ role: "student" }),
    users.countDocuments({ role: "teacher" }),
    papers.countDocuments(),
    deletionRequests.countDocuments({ status: "Pending" }),
  ]);

  res.json({
    totalUsers,
    totalStudents,
    totalTeachers,
    totalPapers,
    pendingDeletionRequests,
  });
});

app.post("/api/papers/:id/request-delete", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const trimmedReason = (reason || "").trim();

  if (!trimmedReason) {
    return res
      .status(400)
      .json({ error: "A reason is required for deletion requests." });
  }

  const paper = await getPaperById(id);
  if (!paper) {
    return res.status(404).json({ error: "Paper not found" });
  }

  const deletionRequests = getDeletionRequestsCollection();
  const existingPending = await deletionRequests.findOne({
    paperId: paper.id,
    status: "Pending",
  });

  if (existingPending) {
    return res.status(409).json({
      error: "A pending deletion request already exists for this paper.",
    });
  }

  const request = {
    id: `del-${Date.now().toString()}`,
    paperId: paper.id,
    paperTitle: paper.title,
    requestedBy: getDisplayName(req.user),
    requestedByEmail: req.user.email,
    requesterRole: req.user.role,
    reason: trimmedReason,
    status: "Pending",
    requestedAt: new Date().toISOString(),
    processedAt: null,
    processedBy: null,
  };

  await storePendingDeletionRequest(request);

  console.log(
    `[DELETE_REQUEST] id=${request.id} paperId=${paper.id} by=${req.user.email} role=${req.user.role}`,
  );

  return res.json({
    message: "Deletion request submitted successfully.",
    request,
  });
});

app.get(
  "/api/admin/deletion-requests",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const deletionRequests = getDeletionRequestsCollection();
    const papers = getPapersCollection();
    const users = getUsersCollection();
    const status = (req.query.status || "").trim();
    const filter = {};

    if (status) {
      filter.status = status;
    }

    const requests = await deletionRequests
      .find(filter)
      .sort({ requestedAt: -1 })
      .toArray();

    const enriched = await Promise.all(
      requests.map(async (request) => {
        const [paper, requester] = await Promise.all([
          papers.findOne({ id: request.paperId }),
          request.requestedByEmail
            ? users.findOne({ email: request.requestedByEmail })
            : Promise.resolve(null),
        ]);

        return {
          ...request,
          paper: paper
            ? {
                id: paper.id,
                title: paper.title,
                subject: paper.subject,
                year: paper.year,
                type: paper.type,
                uploadedBy: paper.uploadedBy,
                uploadedAt: paper.uploadedAt,
                originalName: paper.originalName,
              }
            : null,
          requester: requester ? safeUserFields(requester) : null,
        };
      }),
    );

    res.json({ deletionRequests: enriched });
  },
);

app.patch(
  "/api/admin/deletion-requests/:id/approve",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const deletionRequests = getDeletionRequestsCollection();
    const request = await deletionRequests.findOne({ id });

    if (!request) {
      return res.status(404).json({ error: "Deletion request not found" });
    }

    if (request.status !== "Pending") {
      return res
        .status(400)
        .json({ error: "This request has already been processed." });
    }

    const paper = await getPaperById(request.paperId);
    if (paper) {
      await permanentlyDeletePaperRecord(paper, request.reason, req.user);
    }

    const processedAt = new Date().toISOString();
    await deletionRequests.updateOne(
      { id },
      {
        $set: {
          status: "Approved",
          processedAt,
          processedBy: req.user.email,
        },
      },
    );

    console.log(
      `[DELETE_APPROVE] requestId=${id} paperId=${request.paperId} approvedBy=${req.user.email}`,
    );

    return res.json({
      message: "Deletion request approved and paper removed.",
    });
  },
);

app.patch(
  "/api/admin/deletion-requests/:id/reject",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const deletionRequests = getDeletionRequestsCollection();
    const request = await deletionRequests.findOne({ id });

    if (!request) {
      return res.status(404).json({ error: "Deletion request not found" });
    }

    if (request.status !== "Pending") {
      return res
        .status(400)
        .json({ error: "This request has already been processed." });
    }

    const processedAt = new Date().toISOString();
    await deletionRequests.updateOne(
      { id },
      {
        $set: {
          status: "Rejected",
          processedAt,
          processedBy: req.user.email,
        },
      },
    );

    console.log(
      `[DELETE_REJECT] requestId=${id} paperId=${request.paperId} rejectedBy=${req.user.email}`,
    );

    return res.json({
      message: "Deletion request rejected.",
    });
  },
);

app.post(
  "/api/upload",
  requireAuth,
  (req, res, next) => {
    // Run multer and surface file-type errors cleanly
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res
          .status(400)
          .json({ error: err.message || "File upload failed." });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { title, subject, year, type } = req.body;
    if (!title || !subject || !year || !type) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Please fill in all fields" });
    }

    const papers = getPapersCollection();
    const hash = hashFile(req.file.path);
    const duplicate = await papers.findOne({ hash });
    if (duplicate) {
      fs.unlinkSync(req.file.path);
      return res.status(409).json({
        error: "duplicate",
        message: `This paper already exists! It was uploaded as "${duplicate.title}" by ${duplicate.uploadedBy}.`,
      });
    }

    const paper = {
      id: Date.now().toString(),
      title,
      subject,
      year,
      type,
      filename: req.file.filename,
      originalName: req.file.originalname,
      hash,
      uploadedBy: req.user.username,
      uploadedAt: new Date().toISOString(),
      ratings: [],
    };

    await papers.insertOne(paper);
    res.json({
      message: "Paper uploaded successfully!",
      paper: buildRatingSummary(paper),
    });
  },
);

app.get("/api/papers/:id/file", async (req, res) => {
  const papers = getPapersCollection();
  const paper = await papers.findOne({ id: req.params.id });
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const filePath = path.join(uploadDir, paper.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  if (req.query.download === "1") {
    return res.download(filePath, paper.originalName);
  }

  res.setHeader(
    "Content-Disposition",
    `inline; filename="${paper.originalName}"`,
  );
  return res.sendFile(filePath);
});

app.get("/api/papers/:id/view", async (req, res) => {
  const papers = getPapersCollection();
  const paper = await papers.findOne({ id: req.params.id });
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const filePath = path.join(uploadDir, paper.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const ext = path.extname(paper.originalName).toLowerCase();
  const mimeTypes = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".json": "application/json",
    ".html": "text/html",
    ".htm": "text/html",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".zip": "application/zip",
    ".rar": "application/vnd.rar",
    ".7z": "application/x-7z-compressed",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${paper.originalName}"`,
  );
  return res.sendFile(filePath, { headers: { "Content-Type": contentType } });
});

app.get("/api/papers/:id/download", async (req, res) => {
  const papers = getPapersCollection();
  const paper = await papers.findOne({ id: req.params.id });
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const filePath = path.join(uploadDir, paper.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  return res.download(filePath, paper.originalName);
});

app.get("/api/stats", async (req, res) => {
  const users = getUsersCollection();
  const papers = getPapersCollection();
  const totalPapers = await papers.countDocuments();
  const totalUsers = await users.countDocuments();
  res.json({
    totalPapers,
    totalUsers,
  });
});

app.post("/api/papers/:id/rate", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;

  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    return res
      .status(400)
      .json({ error: "Rating must be a number between 1 and 5" });
  }

  const papers = getPapersCollection();
  const paper = await papers.findOne({ id });
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const ratings = paper.ratings || [];
  const existing = ratings.find((r) => r.username === req.user.username);
  if (existing) {
    existing.value = rating;
  } else {
    ratings.push({ username: req.user.username, value: rating });
  }

  await papers.updateOne({ id }, { $set: { ratings } });
  res.json({
    message: "Rating saved",
    paper: buildRatingSummary({ ...paper, ratings }),
  });
});

app.put("/api/papers/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const papers = getPapersCollection();
  const paper = await papers.findOne({ id });

  if (!paper) {
    return res.status(404).json({ error: "Paper not found" });
  }

  if (req.user.role !== "admin" && paper.uploadedBy !== req.user.username) {
    return res.status(403).json({
      error: "You can only edit papers that you uploaded.",
    });
  }

  const { title, subject, year, type } = req.body;
  const update = {};

  if (typeof title === "string" && title.trim()) update.title = title.trim();
  if (typeof subject === "string" && subject.trim())
    update.subject = subject.trim();
  if (typeof year === "string" && year.trim()) update.year = year.trim();
  if (typeof type === "string" && type.trim()) update.type = type.trim();

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: "No changes were provided." });
  }

  update.updatedAt = new Date().toISOString();

  await papers.updateOne({ id }, { $set: update });
  const updatedPaper = await papers.findOne({ id });

  return res.json({
    message: "Paper updated successfully.",
    paper: buildRatingSummary(updatedPaper),
  });
});

app.delete("/api/papers/:id", requireAuth, requireAdmin, async (req, res) => {
  const papers = getPapersCollection();
  const paper = await papers.findOne({ id: req.params.id });
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  await permanentlyDeletePaperRecord(paper, "admin direct delete", req.user);
  res.json({ message: "Paper deleted successfully" });
});

app.delete("/api/account", requireAuth, async (req, res) => {
  const users = getUsersCollection();

  // Find user
  const user = await users.findOne({ email: normalizeEmail(req.user.email) });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Delete the user only (keep papers)
  await users.deleteOne({ email: normalizeEmail(req.user.email) });

  res.json({ message: "Account deleted successfully" });
});

function mountFrontendIfAvailable() {
  if (process.env.SERVE_FRONTEND === "false") {
    return;
  }

  const buildDir = path.join(__dirname, "..", "build");
  const indexHtml = path.join(buildDir, "index.html");

  if (!fs.existsSync(indexHtml)) {
    console.log(
      "ℹ️ Frontend build not found — running API-only mode (no static files).",
    );
    return;
  }

  app.use(express.static(buildDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.sendFile(indexHtml);
  });
}

mountFrontendIfAvailable();

initDB().then(async () => {
  // Print environment status (redacted for security)
  console.log("📋 Server Configuration:");
  console.log(`   - PORT: ${PORT}`);
  console.log(`   - .env path: ${path.join(__dirname, ".env")}`);
  console.log(`   - SMTP_HOST: ${process.env.SMTP_HOST}`);
  console.log(`   - SMTP_PORT: ${process.env.SMTP_PORT}`);
  console.log(`   - SMTP_USER: ${process.env.SMTP_USER}`);
  console.log(
    `   - SMTP_PASS: ${process.env.SMTP_PASS ? "(set)" : "(not set)"}`,
  );
  console.log(`   - EMAIL_FROM: ${process.env.EMAIL_FROM}`);
  console.log(
    `   - Real SMTP configured: ${isRealSmtpConfigured() ? "✅ Yes" : "❌ No"}`,
  );

  // Test SMTP connection immediately
  if (isRealSmtpConfigured()) {
    try {
      console.log("🔍 Testing SMTP connection...");
      const { transporter } = await createMailTransporter();
      await transporter.verify();
      console.log("✅ SMTP test passed! Server is ready to send emails!");
    } catch (smtpErr) {
      console.error("❌ SMTP Test FAILED:", smtpErr);
    }
  }

  // Test endpoint to clear failed login attempts (for development)
  app.post("/api/test/clear-failed-attempts", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const normalizedEmail = normalizeEmail(email);
    const failedAttemptsCollection = getFailedLoginAttemptsCollection();
    const deleteResult = await failedAttemptsCollection.deleteMany({
      email: normalizedEmail,
    });
    res.json({
      message: `Cleared ${deleteResult.deletedCount} failed attempts for ${normalizedEmail}`,
    });
  });

  const server = app.listen(PORT, () => {
    console.log(`\n✅ RCA Backend running on http://localhost:${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ Port ${PORT} is already in use.`);
      console.error(
        `   Stop the existing process first, then restart the backend.`,
      );
      console.error(`   Tip: Run this to free the port on Windows:`);
      console.error(
        `   for /f "tokens=5" %a in ('netstat -aon ^| findstr :${PORT}') do taskkill /F /PID %a\n`,
      );
      process.exit(1);
    } else {
      throw err;
    }
  });
});

app.put("/api/make-admin", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  if (!canUseAdminBootstrapRoute(req)) {
    return res.status(403).json({
      error:
        "Admin bootstrap is disabled. Set ADMIN_BOOTSTRAP_SECRET in production to enable it.",
    });
  }

  const users = getUsersCollection();

  const result = await users.updateOne(
    { email: normalizeEmail(email) },
    {
      $set: {
        role: "admin",
        status: "active",
        updatedAt: new Date().toISOString(),
      },
    },
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({
      error: "User not found",
    });
  }

  res.json({
    message: "User is now admin",
  });
});
// Admin flow enhancements are appended below the existing route table.

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const usersCollection = getUsersCollection();
    const users = await usersCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      users: users.map((user) => safeUserFields(user)),
    });
  } catch (error) {
    console.error("Failed to load admin users:", error);
    res.status(500).json({ message: "Failed to load users." });
  }
});

app.post(
  "/api/admin/teachers/direct",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { name, email, password } = req.body || {};
      const normalizedName = typeof name === "string" ? name.trim() : "";
      const normalizedEmail =
        typeof email === "string" ? email.trim().toLowerCase() : "";
      const rawPassword = typeof password === "string" ? password : "";

      if (!normalizedName || !normalizedEmail || !rawPassword) {
        return res.status(400).json({
          message:
            "Name, email, and password are required to create a teacher account.",
        });
      }

      if (rawPassword.length < 8) {
        return res.status(400).json({
          message: "Password must be at least 8 characters long.",
        });
      }

      const existingUser = await findUserByEmail(normalizedEmail);
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "A user with this email already exists." });
      }

      const passwordHash = await bcrypt.hash(rawPassword, 12);
      const now = new Date().toISOString();
      const teacherId = Date.now().toString();
      const teacherRecord = {
        id: teacherId,
        name: normalizedName,
        username: normalizedName,
        email: normalizedEmail,
        password: passwordHash,
        role: "teacher",
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdBy: req.user.email,
      };

      await getUsersCollection().insertOne(teacherRecord);

      res.status(201).json({
        message: "Teacher account created successfully.",
        teacher: safeUserFields(teacherRecord),
      });
    } catch (error) {
      console.error("Failed to create teacher:", error);
      res.status(500).json({ message: "Failed to create teacher account." });
    }
  },
);

app.get(
  "/api/admin/users/:id/resources",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const user = await findUserById(id);

      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      const papersCollection = getPapersCollection();
      const searchTerms = [
        user._id?.toString(),
        user.email,
        user.name,
        user.username,
      ].filter(Boolean);
      const resources = await papersCollection
        .find({
          $or: [
            { uploadedBy: { $in: searchTerms } },
            { createdBy: { $in: searchTerms } },
            { userEmail: { $in: searchTerms } },
            { ownerEmail: { $in: searchTerms } },
            { uploaderEmail: { $in: searchTerms } },
            { uploadedById: { $in: searchTerms } },
            { createdById: { $in: searchTerms } },
            { ownerId: { $in: searchTerms } },
            { userId: { $in: searchTerms } },
          ],
        })
        .sort({ createdAt: -1 })
        .toArray();

      res.json({
        user: safeUserFields(user),
        resources,
      });
    } catch (error) {
      console.error("Failed to load admin user resources:", error);
      res.status(500).json({ message: "Failed to load user resources." });
    }
  },
);

app.delete(
  "/api/admin/users/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const user = await findUserById(id);

      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (user.role === "admin") {
        return res.status(400).json({
          message: "Admin accounts cannot be deleted from this screen.",
        });
      }

      const usersCollection = getUsersCollection();
      // Delete by our custom id field first, then fall back to email
      let result = await usersCollection.deleteOne({ id: String(id) });
      if (!result.deletedCount && user.email) {
        result = await usersCollection.deleteOne({ email: user.email });
      }

      if (!result.deletedCount) {
        return res.status(404).json({ message: "User not found." });
      }

      res.json({
        message: "User deleted successfully.",
        user: safeUserFields(user),
      });
    } catch (error) {
      console.error("Failed to delete user:", error);
      res.status(500).json({ message: "Failed to delete user." });
    }
  },
);
