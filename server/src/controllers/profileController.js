const bcrypt = require("bcryptjs");
const { getUsersCollection } = require("../models");
const { validatePasswordStrength } = require("../middleware/validation");
const { safeUserFields } = require("../utils/userUtils");
const { normalizeClass } = require("../config/classes");

async function getMe(req, res) {
  const user = await getUsersCollection().findOne({ email: req.user.email }, { projection: { password: 0 } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: safeUserFields(user) });
}

async function updateMe(req, res) {
  const name = String(req.body.name || "").trim().slice(0, 80);
  if (name.length < 2) return res.status(400).json({ error: "Name must be at least 2 characters" });

  const update = { name, updatedAt: new Date().toISOString() };

  // Username update
  if (req.body.username !== undefined) {
    const username = String(req.body.username).trim().slice(0, 30);
    if (username.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters" });
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return res.status(400).json({ error: "Username can only contain letters, numbers, underscores, dots, and hyphens" });
    }
    const existing = await getUsersCollection().findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
      email: { $ne: req.user.email },
    });
    if (existing) {
      return res.status(409).json({ error: "Username is already taken" });
    }
    update.username = username;
  }

  // Enrolled class is locked after signup; only allow setting once if missing
  if (req.user.role === "student" && req.body.class !== undefined) {
    if (req.user.class) {
      // Class already set, locked until annual promotion
    } else {
      const cls = normalizeClass(req.body.class);
      if (!cls) return res.status(400).json({ error: "Please choose a valid class" });
      update.class = cls;
    }
  }

  // Gender is locked after signup; only allow setting once if missing
  if (req.body.gender !== undefined) {
    if (!req.user.gender) {
      const g = String(req.body.gender).toLowerCase().trim();
      if (g === "male" || g === "female") {
        update.gender = g;
      }
    }
  }

  // Notification preferences
  if (req.body.notifications !== undefined && typeof req.body.notifications === "object") {
    update.notifications = {
      inAppAlerts: Boolean(req.body.notifications.inAppAlerts),
      dueReminders: Boolean(req.body.notifications.dueReminders),
      emailNotifications: Boolean(req.body.notifications.emailNotifications),
    };
  }

  await getUsersCollection().updateOne({ email: req.user.email }, { $set: update });
  res.json({
    message: "Profile updated",
    name,
    username: update.username || req.user.username,
    class: update.class !== undefined ? update.class : req.user.class,
    gender: update.gender !== undefined ? update.gender : req.user.gender,
    notifications: update.notifications,
  });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }
  const check = validatePasswordStrength(newPassword);
  if (!check.valid) return res.status(400).json({ error: check.message });

  const users = getUsersCollection();
  const user = await users.findOne({ email: req.user.email });
  if (!user || !user.password || !(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(400).json({ error: "Current password is incorrect" });
  }

  await users.updateOne(
    { email: req.user.email },
    { $set: { password: await bcrypt.hash(newPassword, 10), updatedAt: new Date().toISOString() } }
  );
  res.json({ message: "Password changed" });
}

module.exports = { getMe, updateMe, changePassword };
