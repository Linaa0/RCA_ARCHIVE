"use strict";

const { getFailedLoginAttemptsCollection, getSecurityLogsCollection } = require("../models");
const { sendSuspiciousLoginEmail } = require("../services/emailService");

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

// In a single-instance PM2 setup (default), this memory store provides high-performance tracking.
// Note: If the backend is ever scaled to multiple instances, a shared store (e.g. MongoDB-backed
// store via rate-limit-mongo or Redis) MUST be configured so counters are synchronized across instances.
const limiterStores = new Map();

function normalizeKey(value) {
  return (value || "").toString().trim().toLowerCase();
}

function normalizeIp(ip) {
  if (!ip) return "127.0.0.1";
  let clean = String(ip).trim().toLowerCase();
  if (clean.startsWith("::ffff:")) {
    clean = clean.substring(7);
  }
  if (clean === "::1") {
    clean = "127.0.0.1";
  }
  return clean;
}

function getClientIp(req) {
  // With app.set("trust proxy", 1), Express resolves req.ip securely from the single trusted proxy.
  // We do not parse raw X-Forwarded-For headers directly to prevent client IP spoofing attacks.
  const raw = req?.ip || req?.socket?.remoteAddress || "127.0.0.1";
  return normalizeIp(raw);
}

function applyBindingRateLimitHeaders(res, { limit, remaining, resetSeconds, windowMs }) {
  if (!res.locals) res.locals = {};
  const current = res.locals._bindingRateLimit;

  // Binding limit: the limiter closest to exhaustion (fewer requests remaining)
  if (
    !current ||
    remaining < current.remaining ||
    (remaining === current.remaining && limit < current.limit)
  ) {
    res.locals._bindingRateLimit = { limit, remaining, resetSeconds, windowMs };

    const policy = `${limit};w=${Math.ceil(windowMs / 1000)}`;
    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, remaining)));
    res.setHeader("RateLimit-Reset", String(Math.max(0, resetSeconds)));
    res.setHeader("RateLimit-Policy", policy);
    res.setHeader(
      "RateLimit",
      `limit=${limit}, remaining=${Math.max(0, remaining)}, reset=${Math.max(0, resetSeconds)}`
    );
  }

  // Strictly strip legacy X-RateLimit-* headers to adhere to draft-7 standard
  res.removeHeader("X-RateLimit-Limit");
  res.removeHeader("X-RateLimit-Remaining");
  res.removeHeader("X-RateLimit-Reset");
}

function createLimiter({
  windowMs,
  max,
  message,
  logType = "rate_limit_hit",
  keyGenerator,
  id,
}) {
  const storeId = id || `${windowMs}_${max}_${logType}`;
  if (!limiterStores.has(storeId)) {
    limiterStores.set(storeId, new Map());
  }
  const store = limiterStores.get(storeId);

  // Periodic cleanup of expired keys in this store
  const cleanupInterval = Math.max(30000, windowMs);
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now >= entry.resetTime) {
        store.delete(key);
      }
    }
  }, cleanupInterval).unref();

  return async function rateLimitMiddleware(req, res, next) {
    if (process.env.DISABLE_RATE_LIMIT === "true") {
      return next();
    }

    const key = keyGenerator ? keyGenerator(req) : getClientIp(req);
    const now = Date.now();

    let record = store.get(key);
    if (!record || now >= record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      store.set(key, record);
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

    applyBindingRateLimitHeaders(res, {
      limit: max,
      remaining,
      resetSeconds,
      windowMs,
    });

    if (record.count > max) {
      // 429 Too Many Requests
      const retryAfterSeconds = resetSeconds;
      const retryMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));

      try {
        const securityLogs = getSecurityLogsCollection();
        if (securityLogs) {
          await securityLogs.insertOne({
            type: logType,
            ip: getClientIp(req),
            key,
            path: req.originalUrl || req.path,
            method: req.method,
            userAgent: req.headers["user-agent"] || "",
            createdAt: new Date(),
          });
        }
      } catch (_) {}

      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error:
          message ||
          `Too many requests. Please try again in ${retryMinutes} minute${
            retryMinutes > 1 ? "s" : ""
          }.`,
        retryAfter: retryAfterSeconds,
      });
    }

    return next();
  };
}

// Global rate limiter: 1000 requests per 15 minutes per IP
const globalLimiter = createLimiter({
  id: "global",
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || (process.env.NODE_ENV === "development" ? 3000 : 1000),
  logType: "global_rate_limit",
  message: "Too many requests from this network. Please try again in 15 minutes.",
});

// Light health endpoint limiter: 60 requests per minute per IP
const healthLimiter = createLimiter({
  id: "health",
  windowMs: 60 * 1000,
  max: 60,
  logType: "health_rate_limit",
  message: "Too many health check requests. Please try again in a minute.",
});

// Public endpoints limiter (curriculum, summary): 60 requests per minute per IP
const publicLimiter = createLimiter({
  id: "public",
  windowMs: 60 * 1000,
  max: 60,
  logType: "public_rate_limit",
  message: "Too many public requests. Please try again in a minute.",
});

// Signup limiter: 5 per hour per IP
const signupLimiter = createLimiter({
  id: "signup",
  windowMs: 60 * 60 * 1000,
  max: 5,
  logType: "signup_rate_limit",
  message: "Too many sign-up attempts from this network. Please try again in an hour.",
});

// Send OTP limiter: 3 per 10 minutes keyed by IP and account
const sendOtpLimiter = createLimiter({
  id: "send_otp",
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const email = normalizeKey(req.body?.email || "");
    return `${ip}_${email}`;
  },
  logType: "otp_rate_limit",
  message: "Too many verification code requests for this address. Please try again in 10 minutes.",
});

// Verify OTP limiter: 10 attempts per 10 minutes keyed by IP and account
const verifyOtpLimiter = createLimiter({
  id: "verify_otp",
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const email = normalizeKey(req.body?.email || "");
    return `${ip}_${email}`;
  },
  logType: "verify_otp_rate_limit",
  message: "Too many verification attempts. Please request a new code or try again later.",
});

// Forgot password limiter: 3 per hour keyed by IP and account
const forgotPasswordLimiter = createLimiter({
  id: "forgot_password",
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const email = normalizeKey(req.body?.email || "");
    return `${ip}_${email}`;
  },
  logType: "forgot_password_rate_limit",
  message: "Too many password reset requests. Please try again in an hour.",
});

// Reset password limiter: 5 attempts per 15 minutes keyed by IP and account/token
const resetPasswordLimiter = createLimiter({
  id: "reset_password",
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const account = normalizeKey(req.body?.email || req.body?.token || "");
    return `${ip}_${account}`;
  },
  logType: "reset_password_rate_limit",
  message: "Too many password reset attempts. Please try again in 15 minutes.",
});

// Login rate limiter: 10 attempts per 5 minutes keyed by IP and account
const loginLimiter = createLimiter({
  id: "login",
  windowMs: 5 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 10,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const identifier = normalizeKey(req.body?.email || req.body?.identifier || "");
    return `${ip}_${identifier}`;
  },
  logType: "login_rate_limit",
  message: "Too many login attempts for this account. Please try again in 5 minutes.",
});

// Change password limiter: 10 attempts per 15 minutes per user / IP
const changePasswordLimiter = createLimiter({
  id: "change_password",
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
  logType: "change_password_rate_limit",
  message: "Too many password change attempts. Please try again in 15 minutes.",
});

// Refresh token limiter: 30 requests per 15 minutes per IP
const refreshLimiter = createLimiter({
  id: "refresh",
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => getClientIp(req),
  logType: "refresh_rate_limit",
  message: "Too many session renewal requests. Please try again in 15 minutes.",
});

// Uploads limiter: 20 per hour per user / IP
const uploadLimiter = createLimiter({
  id: "upload",
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
  logType: "upload_rate_limit",
  message: "Hourly upload limit reached (maximum 20 uploads per hour). Please try again later.",
});

// Appeals limiter: 5 per day per user / IP
const appealLimiter = createLimiter({
  id: "appeal",
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
  logType: "appeal_rate_limit",
  message: "Daily appeal submission limit reached (maximum 5 appeals per day). Please try again tomorrow.",
});

// Admin operations limiter: 300 per 15 minutes
const adminLimiter = createLimiter({
  id: "admin",
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
  logType: "admin_rate_limit",
  message: "Too many administrative operations. Please try again in 15 minutes.",
});

async function checkFailedAttempts(identifier, ip) {
  const collection = getFailedLoginAttemptsCollection();
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  const normEmail = normalizeKey(identifier);
  const clientIp = normalizeIp(ip);

  // Prune expired attempts older than 15 minutes
  await collection.deleteMany({
    createdAt: { $lt: windowStart },
  });

  // Query failures by email or IP within the active 15-minute window
  const or = [];
  if (normEmail) or.push({ email: normEmail });
  if (clientIp) {
    or.push({ ip: clientIp });
    if (clientIp === "127.0.0.1") {
      or.push({ ip: "::ffff:127.0.0.1" }, { ip: "::1" });
    }
  }

  const query = {
    createdAt: { $gte: windowStart },
    ...(or.length ? { $or: or } : {}),
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
  const clientIp = normalizeIp(ip || getClientIp(req));

  await collection.insertOne({
    email: normEmail,
    ip: clientIp,
    userAgent: req?.headers?.["user-agent"] || "unknown",
    createdAt: new Date(),
  });

  const check = await checkFailedAttempts(normEmail, clientIp);

  if (check.count >= MAX_FAILED_ATTEMPTS) {
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
    } catch (_) {}

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
  const clientIp = ip ? normalizeIp(ip) : null;

  const or = [];
  if (normEmail) or.push({ email: normEmail });
  if (clientIp) {
    or.push({ ip: clientIp });
    if (clientIp === "127.0.0.1") {
      or.push({ ip: "::ffff:127.0.0.1" }, { ip: "::1" });
    }
  }

  const filter = or.length ? { $or: or } : {};
  return collection.deleteMany(filter);
}

module.exports = {
  createLimiter,
  applyBindingRateLimitHeaders,
  globalLimiter,
  healthLimiter,
  publicLimiter,
  signupLimiter,
  sendOtpLimiter,
  verifyOtpLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  loginLimiter,
  changePasswordLimiter,
  refreshLimiter,
  uploadLimiter,
  appealLimiter,
  adminLimiter,
  checkFailedAttempts,
  recordFailedAttempt,
  clearFailedAttemptsForEmail,
  LOCKOUT_WINDOW_MS,
  MAX_FAILED_ATTEMPTS,
  getClientIp,
  normalizeIp,
};
