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
          class: user.class || "",
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

module.exports = {
  requireAuth,
  findUserByEmail,
};
