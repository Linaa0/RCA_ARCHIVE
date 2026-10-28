"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const { getSessionsCollection, getUsersCollection } = require("../models");

const ACCESS_TOKEN_TTL_SEC = 30 * 60; // 30 minutes
const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const ABSOLUTE_LIMIT_MS = 12 * 60 * 60 * 1000; // 12 hours

function hashUserAgent(ua) {
  return crypto.createHash("sha256").update(String(ua || "").trim()).digest("hex");
}

async function createSession(user, req = null) {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDLE_LIMIT_MS);
  const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_LIMIT_MS);
  const userAgent = req?.headers ? req.headers["user-agent"] : "";
  const userAgentHash = hashUserAgent(userAgent);

  const tokenVersion = typeof user.tokenVersion === "number" ? user.tokenVersion : 1;

  const sessionDoc = {
    id: sessionId,
    userId: String(user.id),
    issuedAt: now,
    createdAt: now,
    lastUsedAt: now,
    expiresAt,
    absoluteExpiresAt,
    userAgentHash,
    revoked: false,
    revokedAt: null,
  };

  await getSessionsCollection().insertOne(sessionDoc);

  const token = jwt.sign(
    {
      id: String(user.id),
      email: user.email,
      username: user.username || user.name,
      role: user.role,
      jti: sessionId,
      tokenVersion,
    },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "30m" }
  );

  return { token, sessionId, expiresAt: expiresAt.toISOString() };
}

async function validateSession(payload, req = null) {
  if (!payload || !payload.id) {
    return { valid: false, reason: "Invalid token claims" };
  }

  // If token has jti session identifier, enforce server-side session
  if (payload.jti) {
    const sessions = getSessionsCollection();
    const session = await sessions.findOne({ id: payload.jti, userId: String(payload.id) });
    if (!session) {
      return { valid: false, reason: "Session not found" };
    }

    if (session.revoked || session.revokedAt) {
      return { valid: false, reason: "Session revoked" };
    }

    const now = Date.now();
    if (now > new Date(session.expiresAt).getTime()) {
      return { valid: false, reason: "Session expired" };
    }

    if (session.absoluteExpiresAt && now > new Date(session.absoluteExpiresAt).getTime()) {
      return { valid: false, reason: "Absolute session limit reached" };
    }

    // Slide idle window up to absolute limit
    const newIdle = new Date(now + IDLE_LIMIT_MS);
    const absoluteMax = session.absoluteExpiresAt ? new Date(session.absoluteExpiresAt) : newIdle;
    const effectiveExpiresAt = newIdle.getTime() < absoluteMax.getTime() ? newIdle : absoluteMax;

    await sessions.updateOne(
      { id: session.id },
      { $set: { lastUsedAt: new Date(now), expiresAt: effectiveExpiresAt } }
    );

    return { valid: true, session };
  }

  // Fallback for legacy tokens without jti: valid only if user exists and not revoked
  return { valid: true, session: null };
}

async function revokeSession(sessionId) {
  if (!sessionId) return false;
  const sessions = getSessionsCollection();
  await sessions.updateOne(
    { id: sessionId },
    { $set: { revoked: true, revokedAt: new Date() } }
  );
  return true;
}

async function revokeAllUserSessions(userId) {
  if (!userId) return false;
  const sessions = getSessionsCollection();
  const users = getUsersCollection();

  await Promise.all([
    sessions.updateMany(
      { userId: String(userId), revoked: { $ne: true } },
      { $set: { revoked: true, revokedAt: new Date() } }
    ),
    users.updateOne(
      { id: String(userId) },
      { $inc: { tokenVersion: 1 } }
    ),
  ]);
  return true;
}

async function bumpUserTokenVersion(userId) {
  if (!userId) return;
  const users = getUsersCollection();
  await users.updateOne(
    { id: String(userId) },
    { $inc: { tokenVersion: 1 } }
  );
}

async function refreshSession(tokenStr, req = null) {
  if (!tokenStr) {
    return { success: false, status: 401, error: "Token is required" };
  }

  let payload;
  try {
    payload = jwt.verify(tokenStr, JWT_SECRET, { algorithms: ["HS256"], ignoreExpiration: true });
  } catch (_) {
    return { success: false, status: 401, error: "Invalid token signature" };
  }

  if (!payload || !payload.id || !payload.jti) {
    return { success: false, status: 401, error: "Invalid token payload" };
  }

  const users = getUsersCollection();
  const user = await users.findOne({ id: String(payload.id) });
  if (!user || user.status === "disabled") {
    return { success: false, status: 403, error: "Account is disabled or not found" };
  }

  const currentTokenVersion = typeof user.tokenVersion === "number" ? user.tokenVersion : 1;
  const tokenPayloadVersion = typeof payload.tokenVersion === "number" ? payload.tokenVersion : 1;
  if (currentTokenVersion !== tokenPayloadVersion) {
    return { success: false, status: 401, error: "Session invalidated. Please log in again." };
  }

  const sessions = getSessionsCollection();
  const session = await sessions.findOne({ id: payload.jti, userId: String(user.id) });
  if (!session || session.revoked || session.revokedAt) {
    return { success: false, status: 401, error: "Session has been revoked" };
  }

  const now = Date.now();
  if (session.absoluteExpiresAt && now > new Date(session.absoluteExpiresAt).getTime()) {
    return { success: false, status: 401, error: "Absolute session duration exceeded. Please log in again." };
  }

  if (now - new Date(session.lastUsedAt || session.createdAt).getTime() > IDLE_LIMIT_MS) {
    return { success: false, status: 401, error: "Session timed out due to inactivity" };
  }

  const newIdle = new Date(now + IDLE_LIMIT_MS);
  const absoluteMax = session.absoluteExpiresAt ? new Date(session.absoluteExpiresAt) : newIdle;
  const effectiveExpiresAt = newIdle.getTime() < absoluteMax.getTime() ? newIdle : absoluteMax;

  await sessions.updateOne(
    { id: session.id },
    { $set: { lastUsedAt: new Date(now), expiresAt: effectiveExpiresAt } }
  );

  const newToken = jwt.sign(
    {
      id: String(user.id),
      email: user.email,
      username: user.username || user.name,
      role: user.role,
      jti: session.id,
      tokenVersion: currentTokenVersion,
    },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "30m" }
  );

  return {
    success: true,
    token: newToken,
    expiresAt: effectiveExpiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
      username: user.username || user.name,
      role: user.role,
    },
  };
}

module.exports = {
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  bumpUserTokenVersion,
  refreshSession,
  hashUserAgent,
  ACCESS_TOKEN_TTL_SEC,
  IDLE_LIMIT_MS,
  ABSOLUTE_LIMIT_MS,
};
