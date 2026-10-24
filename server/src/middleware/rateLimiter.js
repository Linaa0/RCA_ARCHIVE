const rateLimit = require("express-rate-limit");
const { getFailedLoginAttemptsCollection, getSecurityLogsCollection } = require("../models");
const { sendSuspiciousLoginEmail } = require("../services/emailService");

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

function normalizeKey(value) {
  return (value || "").toString().trim().toLowerCase();
}

function getClientIp(req) {
  return (
    req?.ip ||
    req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req?.socket?.remoteAddress ||
    "127.0.0.1"
  );
}

function createLimiter({ windowMs, max, message, logType = "rate_limit_hit", keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => getClientIp(req)),
    skip: () => {
      // Allow testing environments to bypass global limiter if explicitly set
      if (process.env.DISABLE_RATE_LIMIT === "true") return true;
      return false;
    },
    handler: async (req, res, _next, options) => {
      const retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
      const retryMinutes = Math.max(1, Math.ceil(options.windowMs / (60 * 1000)));

      try {
        const securityLogs = getSecurityLogsCollection();
        if (securityLogs) {
          await securityLogs.insertOne({
            type: logType,
            ip: getClientIp(req),
            path: req.originalUrl || req.path,
            method: req.method,
            userAgent: req.headers["user-agent"] || "",
            createdAt: new Date(),
          });
        }
      } catch (err) {
        // Non-blocking log persistence
      }

      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error:
          message ||
          `Too many requests. Please try again in ${retryMinutes} minute${
            retryMinutes > 1 ? "s" : ""
          }.`,
        retryAfter: retryAfterSeconds,
      });
    },
  });
}

// 1. Global rate limiter: 1000 requests per 15 minutes per IP (3000 in development)
// Sized for educational institutions where multiple active users share a campus NAT gateway
const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || (process.env.NODE_ENV === "development" ? 3000 : 1000),
  logType: "global_rate_limit",
  message: "Too many requests from this network. Please try again in 15 minutes.",
});

// 2. Signup limiter: 5 per hour per IP
const signupLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  logType: "signup_rate_limit",
  message: "Too many sign-up attempts from this network. Please try again in an hour.",
});

// 3. Send OTP limiter: 3 per 10 minutes per email and per IP
const sendOtpLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => {
    const email = (req.body?.email || "").toLowerCase().trim();
    return `${getClientIp(req)}_${email}`;
  },
  logType: "otp_rate_limit",
  message: "Too many verification code requests for this address. Please try again in 10 minutes.",
});

// 4. Forgot password limiter: 3 per hour per email and IP
const forgotPasswordLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => {
    const email = (req.body?.email || "").toLowerCase().trim();
    return `${getClientIp(req)}_${email}`;
  },
  logType: "forgot_password_rate_limit",
  message: "Too many password reset requests. Please try again in an hour.",
});

// 5. Uploads limiter: 20 per hour per user / IP
const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
  logType: "upload_rate_limit",
  message: "Hourly upload limit reached (maximum 20 uploads per hour). Please try again later.",
});

// 6. Appeals limiter: 3 per day per user
const appealLimiter = createLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
  logType: "appeal_rate_limit",
  message: "Daily appeal submission limit reached (maximum 3 appeals per day). Please try again tomorrow.",
});

async function checkFailedAttempts(identifier, ip) {
  const collection = getFailedLoginAttemptsCollection();
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  const normEmail = normalizeKey(identifier);
  const clientIp = normalizeKey(ip);

  // Prune expired attempts older than 15 minutes
  await collection.deleteMany({
    createdAt: { $lt: windowStart },
  });

  // Query failures by email or IP within the active 15-minute window
  const query = {
    createdAt: { $gte: windowStart },
    $or: [{ email: normEmail }, { ip: clientIp }],
  };

  const attempts = await collection
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  const count = attempts.length;

  if (count >= MAX_FAILED_ATTEMPTS) {
    const oldestInSequence = attempts[MAX_FAILED_ATTEMPTS - 1] || attempts[attempts.length - 1];
    const elapsedMs = Date.now() - (oldestInSequence.createdAt instanceof Date
      ? oldestInSequence.createdAt.getTime()
      : new Date(oldestInSequence.createdAt).getTime());
    const remainingMs = Math.max(1000, LOCKOUT_WINDOW_MS - elapsedMs);
    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

    return {
      locked: true,
      count,
      attemptsLeft: 0,
      remainingMinutes,
      retryAfterSeconds,
    };
  }

  return {
    locked: false,
    count,
    attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - count),
    remainingMinutes: 0,
    retryAfterSeconds: 0,
  };
}

async function recordFailedAttempt(req, identifier, ip, user) {
  const collection = getFailedLoginAttemptsCollection();
  const normEmail = normalizeKey(identifier);
  const clientIp = normalizeKey(ip || getClientIp(req));

  await collection.insertOne({
    email: normEmail,
    ip: clientIp,
    userAgent: req?.headers?.["user-agent"] || "unknown",
    createdAt: new Date(),
  });

  const check = await checkFailedAttempts(normEmail, clientIp);

  if (check.count >= MAX_FAILED_ATTEMPTS) {
    // Record security log for failed login lockout
    try {
      const securityLogs = getSecurityLogsCollection();
      if (securityLogs) {
        await securityLogs.insertOne({
          type: "account_lockout",
          identifier: normEmail,
          ip: clientIp,
          failedCount: check.count,
          createdAt: new Date(),
        });
      }
    } catch (err) {
      // non-blocking
    }

    if (user) {
      sendSuspiciousLoginEmail(user, clientIp).catch((err) =>
        console.error("Failed to dispatch suspicious login alert:", err.message)
      );
    }
  }

  return check;
}

async function clearFailedAttemptsForEmail(identifier, ip) {
  const collection = getFailedLoginAttemptsCollection();
  const normEmail = normalizeKey(identifier);
  const clientIp = normalizeKey(ip);

  const filter = clientIp
    ? { $or: [{ email: normEmail }, { ip: clientIp }] }
    : { email: normEmail };

  return collection.deleteMany(filter);
}

module.exports = {
  globalLimiter,
  signupLimiter,
  sendOtpLimiter,
  forgotPasswordLimiter,
  uploadLimiter,
  appealLimiter,
  checkFailedAttempts,
  recordFailedAttempt,
  clearFailedAttemptsForEmail,
  LOCKOUT_WINDOW_MS,
  MAX_FAILED_ATTEMPTS,
  getClientIp,
};
