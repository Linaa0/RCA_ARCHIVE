require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const { TEACHER_EMAILS } = require("./teacherEmails");
const {
  connectToMongo,
  getUsersCollection,
  getPapersCollection,
  getOtpCollection,
  getPasswordResetCollection,
} = require("./db");

const app = express();
const PORT = process.env.PORT || 5009;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "http://localhost:3074";
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_not_secure";
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

  if (!host || !user || !pass) {
    return false;
  }

  // Treat typical placeholders and examples as unconfigured
  const lowerHost = host.toLowerCase();
  const lowerUser = user.toLowerCase();
  const lowerPass = pass.toLowerCase();

  if (
    lowerHost.includes("example.com") ||
    lowerPass.includes("your-sendgrid-api-key") ||
    lowerPass.includes("your-smtp-password") ||
    lowerPass.includes("your-app-password") ||
    lowerUser.includes("your-smtp-user") ||
    lowerUser.includes("your-email@gmail.com")
  ) {
    return false;
  }

  return true;
}

async function createMailTransporter() {
  if (isRealSmtpConfigured()) {
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
    try {
      await transporter.verify();
      console.log("✅ SMTP connection verified successfully!");
    } catch (verifyErr) {
      console.error("❌ SMTP verification failed:", verifyErr);
    }

    return transporter;
  }

  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

async function sendVerificationEmail(email, otp) {
  const transporter = await createMailTransporter();
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

  if (!process.env.SMTP_HOST) {
    console.log(
      `OTP email preview URL for ${email}: ${nodemailer.getTestMessageUrl(info)}`,
    );
  }
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

async function sendPasswordResetEmail(email, token, frontendBaseUrl) {
  const transporter = await createMailTransporter();
  const baseUrl = (
    frontendBaseUrl ||
    FRONTEND_BASE_URL ||
    "http://localhost:3074"
  ).replace(/\/$/, "");
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"RCA Archive" <no-reply@rcarchive.local>',
    to: email,
    subject: "RCA Archive Password Reset",
    text: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour.`,
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour.</p>
    `,
  });

  const realSmtp = isRealSmtpConfigured();
  const previewUrl = !realSmtp ? nodemailer.getTestMessageUrl(info) : null;

  if (previewUrl) {
    console.log(`Password reset email preview URL for ${email}: ${previewUrl}`);
  }

  return { info, previewUrl, realSmtp };
}

async function cleanExpiredOtps() {
  const otpCollection = getOtpCollection();
  const now = Date.now();
  await otpCollection.deleteMany({ expiresAt: { $lte: now } });
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

const upload = multer({
  storage,
  fileFilter: (_req, _file, cb) => cb(null, true),
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

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const users = getUsersCollection();
  let user = await users.findOne({ email: normalizedEmail });
  if (user) return user;
  return users.findOne({
    email: { $regex: new RegExp(`^${escapeRegExp(normalizedEmail)}$`, "i") },
  });
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

if (process.env.NODE_ENV === "production") {
  const buildDir = path.join(__dirname, "../build");
  app.use(express.static(buildDir));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }

    res.sendFile(path.join(buildDir, "index.html"));
  });
}

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
    req.user = payload;
    next();
  } catch (err) {
    console.error("Auth failed:", err.message || err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
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
    // Send appropriate email based on operation
    let subject, text, html;
    if (operation === "signup") {
      subject = "RCA Archive Verification Code";
      text = `Your RCA verification code is: ${otp}\n\nThis code expires in 10 minutes.`;
      html = `<p>Your RCA verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`;
    } else if (operation === "login") {
      subject = "RCA Archive Login Verification Code";
      text = `Your RCA login verification code is: ${otp}\n\nThis code expires in 10 minutes.`;
      html = `<p>Your RCA login verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`;
    } else if (operation === "reset-password") {
      subject = "RCA Archive Password Reset Verification Code";
      text = `Your RCA password reset verification code is: ${otp}\n\nThis code expires in 10 minutes.`;
      html = `<p>Your RCA password reset verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`;
    }

    const transporter = await createMailTransporter();
    const info = await transporter.sendMail({
      from:
        process.env.EMAIL_FROM || '"RCA Archive" <no-reply@rcarchive.local>',
      to: email,
      subject,
      text,
      html,
    });

    // Log test email URL for development
    if (!isRealSmtpConfigured()) {
      const testUrl = nodemailer.getTestMessageUrl(info);
      console.log("======================================");
      console.log("📧 OTP Email Preview URL:");
      console.log(testUrl);
      console.log("======================================");
      // Also return the OTP and preview URL in dev mode for easy testing
      return res.json({
        message:
          "OTP sent successfully! Check the server logs for the preview URL.",
        otp,
        previewUrl: testUrl,
      });
    }

    res.json({
      message: "OTP sent successfully. Check your email for the code.",
    });
  } catch (err) {
    console.error("❌ Detailed OTP email error:", {
      message: err.message,
      code: err.code,
      stack: err.stack,
    });
    if (process.env.NODE_ENV !== "production") {
      return res.json({
        message: `OTP email failed to send, but here's your code for development: ${otp}`,
        otp,
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

  await resetCollection.deleteMany({ email: normalizedEmail });
  await resetCollection.insertOne({
    email: normalizedEmail,
    token,
    expiresAt,
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
      const resetUrl = `${getFrontendBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;
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

  if (token) {
    // Original token-based flow
    const resetCollection = getPasswordResetCollection();
    const resetRecord = await resetCollection.findOne({ token });

    if (!resetRecord || resetRecord.expiresAt <= Date.now()) {
      return res.status(400).json({ error: "Token is invalid or expired." });
    }

    const users = getUsersCollection();
    const user = await users.findOne({ email: resetRecord.email });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await users.updateOne(
      { email: resetRecord.email },
      { $set: { password: hashedPassword } },
    );

    await resetCollection.deleteMany({ email: resetRecord.email });

    return res.json({ message: "Password has been reset successfully." });
  } else if (otp) {
    // New OTP-based flow
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
    await users.updateOne(
      { email: normalizedEmail },
      { $set: { password: hashedPassword } },
    );

    await otpCollection.deleteMany({
      email: normalizedEmail,
      operation: "reset-password",
    });

    return res.json({ message: "Password has been reset successfully." });
  }
});

app.post("/api/signup", async (req, res) => {
  const { email, password, otp, role, username } = req.body;

  if (!email || !password || !username) {
    return res
      .status(400)
      .json({ error: "Email, password, and username are required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const users = getUsersCollection();
  const otpCollection = getOtpCollection();

  const exists = await findUserByEmail(email);
  if (exists) {
    return res.status(400).json({ error: "Email already registered" });
  }

  let finalRole = "student";

  // Verify OTP for ALL signups
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

  // Check for teacher role
  if (role === "teacher") {
    const isTeacherEmail = TEACHER_EMAILS.some(
      (teacherEmail) => teacherEmail.toLowerCase() === normalizedEmail,
    );

    if (!isTeacherEmail) {
      return res
        .status(400)
        .json({ error: "This email is not a recognized teacher email" });
    }
    finalRole = "teacher";
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = {
    id: Date.now().toString(),
    email: normalizedEmail,
    username: username.trim() || normalizedEmail.split("@")[0],
    password: hashed,
    role: finalRole,
    createdAt: new Date().toISOString(),
  };

  await users.insertOne(user);

  res.json({
    message: "Account created successfully!",
    role: finalRole,
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

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(400).json({ error: "Wrong password" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "30d" },
  );

  res.json({
    token,
    email: user.email,
    username: user.username,
    role: user.role,
  });
});

app.post(
  "/api/upload",
  requireAuth,
  upload.single("file"),
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

app.delete("/api/papers/:id", requireAuth, async (req, res) => {
  const papers = getPapersCollection();
  const paper = await papers.findOne({ id: req.params.id });
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  if (paper.uploadedBy !== req.user.username && req.user.role !== "teacher")
    return res.status(403).json({ error: "Not allowed to delete this paper" });

  const filePath = path.join(uploadDir, paper.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await papers.deleteOne({ id: req.params.id });
  res.json({ message: "Paper deleted successfully" });
});

initDB().then(async () => {
  // Print environment status (redacted for security)
  console.log("📋 Server Configuration:");
  console.log(`   - PORT: ${PORT}`);
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
      const transporter = await createMailTransporter();
      console.log("✅ SMTP test passed! Server is ready to send emails!");
    } catch (smtpErr) {
      console.error("❌ SMTP Test FAILED:", smtpErr);
    }
  }

  app.listen(PORT, () => {
    console.log(`\n✅ RCA Backend running on http://localhost:${PORT}`);
  });
});
