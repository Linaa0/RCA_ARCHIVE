const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
  JWT_SECRET,
  ADMIN_BOOTSTRAP_SECRET,
  ADMIN_BOOTSTRAP_EMAILS,
  NODE_ENV,
} = require("../config/env");
const {
  getUsersCollection,
  getOtpCollection,
  getPasswordResetCollection,
  getPendingSignupsCollection,
} = require("../models");
const { findUserByEmail } = require("../middleware/authMiddleware");
const {
  checkFailedAttempts,
  recordFailedAttempt,
  clearFailedAttemptsForEmail,
} = require("../middleware/rateLimiter");
const {
  validatePasswordStrength,
  isValidEmail,
} = require("../middleware/validation");
const { normalizeEmail } = require("../utils/userUtils");
const { resolveRole } = require("../config/roles");
const { normalizeClass } = require("../config/classes");
const { getFrontendBaseUrl, buildPasswordSetupUrl } = require("../utils/urlUtils");
const {
  generateOtp,
  sendVerificationEmail,
  sendPasswordResetEmail,
  cleanExpiredOtps,
  cleanExpiredPasswordResets,
  isRealSmtpConfigured,
  createMailTransporter,
} = require("../services/emailService");

function canUseAdminBootstrapRoute(req) {
  if (NODE_ENV !== "production") {
    return true;
  }

  if (!ADMIN_BOOTSTRAP_SECRET) {
    return false;
  }

  const providedSecret = req.headers["x-admin-bootstrap-secret"];
  return providedSecret === ADMIN_BOOTSTRAP_SECRET;
}

const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

async function sendOtp(req, res) {
  const { email, operation } = req.body;

  if (!email || !operation) {
    return res.status(400).json({ error: "Email and operation are required" });
  }

  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const userExists = await findUserByEmail(normalizedEmail);

  if (operation === "signup") {
    if (userExists) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const { fullName, name, username, gender, password } = req.body;
    const studentName = (fullName || name || "").trim();
    if (!studentName || studentName.length < 2 || studentName.length > 60) {
      return res.status(400).json({ error: "Full name is required (2 to 60 characters)." });
    }

    const studentUsername = (username || "").trim().toLowerCase();
    if (!studentUsername || !/^[a-z][a-z0-9_.]{2,23}$/.test(studentUsername)) {
      return res.status(400).json({
        error: "Username must be 3 to 24 characters, start with a letter, and contain only lowercase letters, digits, underscores, or dots.",
      });
    }

    const reservedUsernames = ["admin", "root", "support", "rca", "moderator", "system", "teacher", "student", "faculty"];
    if (reservedUsernames.includes(studentUsername)) {
      return res.status(400).json({ error: "This username is reserved. Please choose another." });
    }

    if (!gender || !["male", "female"].includes(String(gender).toLowerCase())) {
      return res.status(400).json({ error: "Gender is required and must be either 'male' or 'female'." });
    }

    if (!req.body.class) {
      return res.status(400).json({ error: "Class is required." });
    }

    const normalizedClass = normalizeClass(req.body.class);
    if (!normalizedClass) {
      return res.status(400).json({ error: "Invalid cohort class selected." });
    }

    if (password) {
      const passwordCheck = validatePasswordStrength(password);
      if (!passwordCheck.valid) {
        return res.status(400).json({ error: passwordCheck.message });
      }
    }

    const pendingSignups = getPendingSignupsCollection();
    const existingPending = await pendingSignups.findOne({ email: normalizedEmail });

    // 60-second cooldown enforcement
    if (existingPending && existingPending.lastSentAt) {
      const elapsed = Date.now() - existingPending.lastSentAt;
      if (elapsed < 60 * 1000) {
        const remainingSec = Math.ceil((60 * 1000 - elapsed) / 1000);
        return res.status(429).json({
          error: `Please wait ${remainingSec}s before requesting a new code.`,
          retryAfter: remainingSec,
        });
      }
    }

    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : existingPending?.password || null;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const pendingDoc = {
      email: normalizedEmail,
      fullName: studentName,
      username: studentUsername,
      password: hashedPassword,
      class: normalizedClass,
      gender: String(gender).toLowerCase(),
      hashedOtp,
      attempts: 0,
      expiresAt,
      lastSentAt: Date.now(),
      createdAt: new Date(),
    };

    await pendingSignups.updateOne(
      { email: normalizedEmail },
      { $set: pendingDoc },
      { upsert: true }
    );

    try {
      const { previewUrl, isReal } = await sendVerificationEmail(normalizedEmail, otp);

      return res.json({
        message: isReal
          ? "Verification code sent successfully. Check your email."
          : "Verification code sent! Check the server logs for the preview URL.",
        previewUrl,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err) {
      console.error("[OTP_ERROR] Failed to send signup OTP email:", err.message);
      const currentEnv = process.env.NODE_ENV || NODE_ENV || "production";
      if (currentEnv !== "production") {
        return res.json({
          message: "Verification email failed to send, but check server logs for the code.",
          error: err.message,
          previewUrl: null,
          expiresAt: expiresAt.toISOString(),
        });
      }
      return res.status(500).json({
        error: "We could not send the email right now. Please try again in a minute.",
      });
    }
  }

  // Operation is login or reset-password
  if (!userExists) {
    return res.json({
      message: "If this email is registered, you will receive an OTP shortly.",
    });
  }

  await cleanExpiredOtps();
  const otp = generateOtp();
  const hashedCode = await bcrypt.hash(otp, 10);
  const expiresAt = Date.now() + 10 * 60 * 1000;

  const otpCollection = getOtpCollection();
  await otpCollection.deleteMany({
    email: normalizedEmail,
    operation,
  });
  await otpCollection.insertOne({
    email: normalizedEmail,
    hashedCode,
    operation,
    expiresAt,
  });

  try {
    const { previewUrl, isReal } = await sendVerificationEmail(normalizedEmail, otp);

    return res.json({
      message: isReal
        ? "OTP sent successfully. Check your email for the code."
        : "OTP sent successfully! Check the server logs for the preview URL.",
      previewUrl,
    });
  } catch (err) {
    console.error("[OTP_ERROR] Failed to send OTP email:", err.message);
    const currentEnv = process.env.NODE_ENV || NODE_ENV || "production";
    if (currentEnv !== "production") {
      return res.json({
        message: "OTP email failed to send in dev mode.",
        error: err.message,
      });
    }

    return res.status(500).json({
      error: "We could not send the email right now. Please try again in a minute.",
    });
  }
}

async function sendTeacherOtp(req, res) {
  req.body.operation = "signup";
  return sendOtp(req, res);
}

async function forgotPassword(req, res) {
  const { email } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    // Timing defense: perform dummy comparison so response time matches active user lookup
    await bcrypt.compare("dummy_password", DUMMY_HASH);
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
      frontendBaseUrl
    );

    return res.json({
      message:
        "If this email is registered, you'll receive a password reset link shortly.",
      previewUrl,
    });
  } catch (err) {
    console.error("[RESET_ERROR] Password reset email failed:", err.message);
    const currentEnv = process.env.NODE_ENV || NODE_ENV || "production";
    if (currentEnv !== "production") {
      const resetUrl = buildPasswordSetupUrl(getFrontendBaseUrl(req), token);
      return res.json({
        message:
          "If this email is registered, you'll receive a password reset link shortly.",
        previewUrl: resetUrl,
      });
    }
    return res.status(500).json({
      error: "We could not send the email right now. Please try again in a minute.",
    });
  }
}

async function resetPassword(req, res) {
  const { token: rawToken, newPassword, otp } = req.body;
  const token =
    typeof rawToken === "string" ? decodeURIComponent(rawToken).trim() : rawToken;

  if ((!token && !otp) || !newPassword) {
    return res.status(400).json({
      error:
        "Either token and new password or OTP, email and new password are required.",
    });
  }

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
      { $set: update }
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

    // The code is stored hashed (hashedCode), so it must be compared with bcrypt
    if (!otpRecord || otpRecord.expiresAt <= Date.now()) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }
    if ((otpRecord.attempts || 0) >= 5) {
      await otpCollection.deleteMany({ email: normalizedEmail, operation: "reset-password" });
      return res.status(400).json({ error: "Too many invalid attempts. Please request a new code." });
    }
    const otpMatches = await bcrypt.compare(String(otp).trim(), otpRecord.hashedCode || "");
    if (!otpMatches) {
      await otpCollection.updateOne(
        { email: normalizedEmail, operation: "reset-password" },
        { $inc: { attempts: 1 } }
      );
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
}

async function signup(req, res) {
  const { email, otp, password, role, username } = req.body;

  if (!email || !otp) {
    return res
      .status(400)
      .json({ error: "Email and verification code are required" });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (role === "teacher") {
    return res.status(403).json({
      error: "Teacher accounts can only be created by an administrator.",
    });
  }

  const users = getUsersCollection();
  const exists = await findUserByEmail(normalizedEmail);
  if (exists) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const pendingSignups = getPendingSignupsCollection();
  const pending = await pendingSignups.findOne({ email: normalizedEmail });

  if (!pending) {
    return res.status(400).json({
      error: "No pending registration found or code expired. Please request a new code.",
      requiresOtp: true,
      codeExpired: true,
    });
  }

  if (pending.expiresAt && new Date(pending.expiresAt) <= new Date()) {
    return res.status(400).json({
      error: "Verification code has expired. Please request a new code.",
      codeExpired: true,
    });
  }

  if (pending.attempts >= 5) {
    await pendingSignups.deleteOne({ email: normalizedEmail });
    return res.status(400).json({
      error: "Too many invalid attempts. This code has been invalidated. Please request a new code.",
      codeInvalidated: true,
    });
  }

  const match = await bcrypt.compare(String(otp).trim(), pending.hashedOtp);
  if (!match) {
    await pendingSignups.updateOne(
      { email: normalizedEmail },
      { $inc: { attempts: 1 } }
    );
    const remaining = 5 - (pending.attempts + 1);
    if (remaining <= 0) {
      await pendingSignups.deleteOne({ email: normalizedEmail });
      return res.status(400).json({
        error: "Too many invalid attempts. This code has been invalidated. Please request a new code.",
        codeInvalidated: true,
        remainingAttempts: 0,
      });
    }
    return res.status(400).json({
      error: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
      remainingAttempts: remaining,
    });
  }

  // Hash password from request if pending had no password yet
  let finalPasswordHash = pending.password;
  if (!finalPasswordHash && password) {
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.message });
    }
    finalPasswordHash = await bcrypt.hash(password, 10);
  }

  if (!finalPasswordHash) {
    return res.status(400).json({ error: "Password is required for registration." });
  }

  const finalClass = pending.class || normalizeClass(req.body.class);
  if (!finalClass) {
    return res.status(400).json({ error: "Cohort class is required." });
  }

  const finalGender = pending.gender || req.body.gender;
  if (!finalGender || !["male", "female"].includes(String(finalGender).toLowerCase())) {
    return res.status(400).json({ error: "Gender is required and must be either 'male' or 'female'." });
  }

  const resolvedRole = resolveRole(normalizedEmail, "student");
  const user = {
    id: Date.now().toString(),
    email: normalizedEmail,
    name: pending.fullName || (req.body.fullName || req.body.name || "").trim() || pending.username,
    username: pending.username || (username ? username.trim().toLowerCase() : normalizedEmail.split("@")[0]),
    password: finalPasswordHash,
    role: resolvedRole,
    class: finalClass,
    gender: String(finalGender).toLowerCase(),
    status: "active",
    createdAt: new Date().toISOString(),
  };

  await users.insertOne(user);
  await pendingSignups.deleteOne({ email: normalizedEmail });

  return res.json({
    message: "Account created successfully!",
    role: user.role,
    email: normalizedEmail,
    username: user.username,
  });
}

async function login(req, res) {
  const { password } = req.body;
  const identifier = (req.body.email || req.body.identifier || "").trim().toLowerCase();

  if (!identifier || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";

  // Lockout check (15 minutes, 5 attempts, per email and IP)
  const lockout = await checkFailedAttempts(identifier, clientIp);
  if (lockout.locked) {
    res.set("Retry-After", String(lockout.retryAfterSeconds));
    return res.status(429).json({
      error: `Too many failed login attempts. Please try again in ${lockout.remainingMinutes} minute(s).`,
      retryAfter: lockout.retryAfterSeconds,
    });
  }

  const user = await findUserByEmail(identifier);
  if (!user) {
    // Timing defense: run dummy comparison so execution time matches real bcrypt hash
    await bcrypt.compare(password, DUMMY_HASH);
    const failure = await recordFailedAttempt(req, identifier, clientIp, null);
    if (failure.locked) {
      res.set("Retry-After", String(failure.retryAfterSeconds));
      return res.status(429).json({
        error: `Account locked. Too many failed login attempts. Please try again in ${failure.remainingMinutes} minute(s).`,
        retryAfter: failure.retryAfterSeconds,
      });
    }
    return res.status(400).json({
      error: "Incorrect email or password",
      attemptsLeft: failure.attemptsLeft,
    });
  }

  if (user.status === "disabled") {
    return res.status(403).json({ error: "This account is disabled." });
  }

  if (user.status === "pending_password_setup" || !user.password) {
    return res.status(403).json({
      error: "Please set your password first using the link sent to your email.",
    });
  }

  if (user.invitedNotSignedIn && user.tempPasswordExpiresAt && Date.now() > user.tempPasswordExpiresAt) {
    return res.status(403).json({
      error: "Your temporary credentials have expired. Please ask an administrator to resend your credentials.",
    });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    const failure = await recordFailedAttempt(req, user.email, clientIp, user);
    if (failure.locked) {
      res.set("Retry-After", String(failure.retryAfterSeconds));
      return res.status(429).json({
        error: `Account locked. Too many failed login attempts. Please try again in ${failure.remainingMinutes} minute(s).`,
        retryAfter: failure.retryAfterSeconds,
      });
    }
    return res.status(400).json({
      error: "Incorrect email or password",
      attemptsLeft: failure.attemptsLeft,
    });
  }

  await clearFailedAttemptsForEmail(user.email, clientIp);

  const users = getUsersCollection();
  if (user.invitedNotSignedIn) {
    await users.updateOne({ id: user.id }, { $set: { invitedNotSignedIn: false } });
  }

  // Role resolution
  const role = resolveRole(user.email, user.role);
  if (role !== user.role) {
    await users.updateOne(
      { email: user.email },
      { $set: { role, updatedAt: new Date().toISOString() } }
    );
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username || user.name,
      role,
    },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "12h" }
  );

  return res.json({
    token,
    email: user.email,
    username: user.username || user.name,
    name: user.name || user.username,
    role,
    mustChangePassword: Boolean(user.mustChangePassword),
    user: {
      id: user.id,
      email: user.email,
      username: user.username || user.name,
      name: user.name || user.username,
      role,
      mustChangePassword: Boolean(user.mustChangePassword),
    },
  });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required." });
  }

  const { validatePassword } = require("../utils/validation");
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const users = getUsersCollection();
  const user = await users.findOne({ id: req.user.id });
  if (!user || !user.password) {
    return res.status(404).json({ error: "User account not found." });
  }

  const matches = await bcrypt.compare(currentPassword, user.password);
  if (!matches) {
    return res.status(400).json({ error: "Current password does not match." });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await users.updateOne(
    { id: user.id },
    {
      $set: {
        password: hashedPassword,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        updatedAt: new Date().toISOString(),
      },
    }
  );

  return res.json({ message: "Password updated successfully." });
}

async function deleteAccount(req, res) {
  const users = getUsersCollection();
  const normalizedEmail = normalizeEmail(req.user.email);

  const user = await users.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  await users.deleteOne({ email: normalizedEmail });
  res.json({ message: "Account deleted successfully" });
}

module.exports = {
  sendOtp,
  sendTeacherOtp,
  forgotPassword,
  resetPassword,
  signup,
  login,
  changePassword,
  deleteAccount,
};
