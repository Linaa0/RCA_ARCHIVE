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

    // Optional profile validation for signup
    if (req.body.password) {
      const passwordCheck = validatePasswordStrength(req.body.password);
      if (!passwordCheck.valid) {
        return res.status(400).json({ error: passwordCheck.message });
      }
    }

    if (req.body.gender && !["male", "female"].includes(String(req.body.gender).toLowerCase())) {
      return res.status(400).json({ error: "Gender must be either 'male' or 'female'." });
    }

    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const hashedPassword = req.body.password
      ? await bcrypt.hash(req.body.password, 10)
      : existingPending?.password || null;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const pendingDoc = {
      email: normalizedEmail,
      fullName: (req.body.fullName || req.body.name || existingPending?.fullName || "").trim(),
      username: (req.body.username || existingPending?.username || normalizedEmail.split("@")[0]).trim(),
      password: hashedPassword,
      class: normalizeClass(req.body.class || existingPending?.class || "Y1A"),
      gender: req.body.gender || existingPending?.gender || "female",
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

    // Keep legacy OTP collection updated as fallback
    const otpCollection = getOtpCollection();
    await otpCollection.deleteMany({ email: normalizedEmail, operation: "signup" });
    await otpCollection.insertOne({
      email: normalizedEmail,
      code: otp,
      operation: "signup",
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    try {
      const { previewUrl, isReal } = await sendVerificationEmail(normalizedEmail, otp);
      console.log(`[OTP] Generated signup OTP for ${normalizedEmail}: ${otp}`);

      return res.json({
        message: isReal
          ? "Verification code sent successfully. Check your email."
          : "Verification code sent! Check the server logs for the preview URL.",
        previewUrl,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err) {
      console.error("[OTP_ERROR] Failed to send signup OTP email:", err);
      if (NODE_ENV !== "production") {
        return res.json({
          message: "Verification email failed to send, but check server logs for the code.",
          error: err.message,
          previewUrl: null,
          expiresAt: expiresAt.toISOString(),
        });
      }
      return res.status(500).json({
        error: "Failed to send verification email. Please try again later.",
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
  const expiresAt = Date.now() + 10 * 60 * 1000;

  const otpCollection = getOtpCollection();
  await otpCollection.deleteMany({
    email: normalizedEmail,
    operation,
  });
  await otpCollection.insertOne({
    email: normalizedEmail,
    code: otp,
    operation,
    expiresAt,
  });

  try {
    const { previewUrl, isReal } = await sendVerificationEmail(normalizedEmail, otp);
    console.log(`[OTP] Generated OTP for ${normalizedEmail} (${operation}): ${otp}`);

    return res.json({
      message: isReal
        ? "OTP sent successfully. Check your email for the code."
        : "OTP sent successfully! Check the server logs for the preview URL.",
      previewUrl,
    });
  } catch (err) {
    console.error("[OTP_ERROR] Detailed OTP email error:", err);
    if (NODE_ENV !== "production") {
      return res.json({
        message: "OTP email failed to send, but check server logs for the code.",
        error: err.message,
      });
    }

    return res.status(500).json({
      error: "Failed to send OTP email. Please try again later.",
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
    console.error(" Password reset email failed:", err);
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

  if (pending) {
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

    const resolvedRole = resolveRole(normalizedEmail, "student");
    const user = {
      id: Date.now().toString(),
      email: normalizedEmail,
      name: pending.fullName || req.body.fullName || req.body.name || pending.username,
      username: pending.username || (username ? username.trim() : normalizedEmail.split("@")[0]),
      password: finalPasswordHash,
      role: resolvedRole,
      class: normalizeClass(pending.class || req.body.class || "Y1A"),
      gender: pending.gender || req.body.gender || undefined,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    await users.insertOne(user);
    await pendingSignups.deleteOne({ email: normalizedEmail });

    // Clean legacy OTP collection
    const otpCollection = getOtpCollection();
    await otpCollection.deleteMany({
      email: normalizedEmail,
      operation: "signup",
    });

    return res.json({
      message: "Account created successfully!",
      role: user.role,
      email: normalizedEmail,
      username: user.username,
    });
  }

  // Fallback for legacy OTP flow if pending_signups has no record
  const otpCollection = getOtpCollection();
  await cleanExpiredOtps();
  const otpRecord = await otpCollection.findOne({
    email: normalizedEmail,
    operation: "signup",
  });

  if (!otpRecord || otpRecord.code !== String(otp).trim()) {
    return res.status(400).json({
      error: "No pending registration found or code expired. Please request a new code.",
      requiresOtp: true,
      codeExpired: true,
    });
  }

  if (!password) {
    return res.status(400).json({ error: "Password is required to finish registration." });
  }

  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.message });
  }

  await otpCollection.deleteMany({
    email: normalizedEmail,
    operation: "signup",
  });

  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now().toString(),
    email: normalizedEmail,
    name: (req.body.fullName || req.body.name || username || "").trim(),
    username: (username || normalizedEmail.split("@")[0]).trim(),
    password: hashed,
    role: resolveRole(normalizedEmail, "student"),
    class: normalizeClass(req.body.class),
    gender: req.body.gender || undefined,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  await users.insertOne(user);

  res.json({
    message: "Account created successfully!",
    role: user.role,
    email: normalizedEmail,
    username: user.username,
  });
}

async function login(req, res) {
  const { password } = req.body;
  const email = req.body.email || req.body.identifier;

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

  if (user.status === "pending_password_setup" || !user.password) {
    return res.status(403).json({
      error: "Please set your password first using the link sent to your email.",
    });
  }

  const normalizedEmail = normalizeEmail(user.email);
  const initialAttempts = await checkFailedAttempts(normalizedEmail);

  if (initialAttempts >= 3) {
    return res.status(429).json({
      error:
        "Too many failed login attempts. Please try again later or check your email for further instructions.",
    });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    const { attemptsLeft } = await recordFailedAttempt(
      req,
      normalizedEmail,
      user,
      initialAttempts
    );

    return res.status(400).json({
      error: "Wrong password",
      attemptsLeft,
    });
  }

  await clearFailedAttemptsForEmail(normalizedEmail);

  // Role is decided by the email lists in config/roles.js
  const role = resolveRole(normalizedEmail, user.role);
  if (role !== user.role) {
    const users = getUsersCollection();
    await users.updateOne(
      { email: user.email },
      { $set: { role, updatedAt: new Date().toISOString() } }
    );
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.name || user.username,
      role,
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({
    token,
    email: user.email,
    username: user.name || user.username,
    role,
    user: {
      id: user.id,
      email: user.email,
      username: user.name || user.username,
      role,
    },
  });
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

async function makeAdmin(req, res) {
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
    }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ message: "User is now admin" });
}

async function clearFailedAttemptsTest(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const normalizedEmail = normalizeEmail(email);
  const deleteResult = await clearFailedAttemptsForEmail(normalizedEmail);

  res.json({
    message: `Cleared ${deleteResult.deletedCount} failed attempts for ${normalizedEmail}`,
  });
}

module.exports = {
  sendOtp,
  sendTeacherOtp,
  forgotPassword,
  resetPassword,
  signup,
  login,
  deleteAccount,
  makeAdmin,
  clearFailedAttemptsTest,
};
