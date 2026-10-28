const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const { getUsersCollection } = require("../models");
const { normalizeEmail, escapeRegExp } = require("../utils/userUtils");

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const users = getUsersCollection();
  let user = await users.findOne({ email: normalizedEmail });
  if (user) return user;
  user = await users.findOne({
    email: { $regex: new RegExp(`^${escapeRegExp(normalizedEmail)}$`, "i") },
  });
  if (user) return user;
  user = await users.findOne({ username: normalizedEmail });
  if (user) return user;
  return users.findOne({
    username: { $regex: new RegExp(`^${escapeRegExp(normalizedEmail)}$`, "i") },
  });
}

const { validateSession } = require("../services/sessionService");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch?.[1] || req.query.token;

  if (!token) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
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
      .then(async (user) => {
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }

        if (user.status === "disabled") {
          return res.status(403).json({ error: "Account is disabled" });
        }

        if (payload.role && user.role !== payload.role) {
          return res.status(401).json({ error: "Role has changed. Please log in again." });
        }

        const userTokenVersion = typeof user.tokenVersion === "number" ? user.tokenVersion : 1;
        if (payload.tokenVersion !== undefined && payload.tokenVersion !== userTokenVersion) {
          return res.status(401).json({ error: "Session has been invalidated. Please log in again." });
        }

        if (payload.jti) {
          const sessionRes = await validateSession(payload, req);
          if (!sessionRes.valid) {
            return res.status(401).json({ error: sessionRes.reason || "Session expired or revoked" });
          }
          req.session = sessionRes.session;
          req.sessionId = payload.jti;
        }

        req.user = {
          id: user.id || payload.id,
          email: user.email,
          username: user.username || user.name || payload.username,
          name: user.name || user.username || payload.username,
          role: user.role,
          status: user.status || "active",
          class: user.class || "",
          gender: user.gender || "",
          notifications: user.notifications,
          tokenVersion: userTokenVersion,
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

function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied: insufficient permissions" });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  findUserByEmail,
};
