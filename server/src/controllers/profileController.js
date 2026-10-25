const bcrypt = require("bcryptjs");
const { getUsersCollection } = require("../models");
const { validatePasswordStrength } = require("../middleware/validation");
const {
  getNotificationPreferences,
  safeUserFields,
} = require("../utils/userUtils");
const { normalizeClass } = require("../config/classes");

async function getMe(req, res) {
  const user = await getUsersCollection().findOne({ email: req.user.email }, { projection: { password: 0 } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: safeUserFields(user) });
}

async function updateMe(req, res) {
  const update = {};
  let name = req.user.name;
  if (req.body.name !== undefined) {
    name = String(req.body.name || "").trim().slice(0, 80);
    if (name.length < 2) return res.status(400).json({ error: "Name must be at least 2 characters" });
    update.name = name;
  }

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
  if (req.body.notifications !== undefined) {
    if (
      !req.body.notifications ||
      typeof req.body.notifications !== "object" ||
      Array.isArray(req.body.notifications)
    ) {
      return res.status(400).json({ error: "Notification preferences must be an object" });
    }
    const preferenceKeys = ["inAppAlerts", "dueReminders", "emailNotifications"];
    if (preferenceKeys.some((key) => (
      req.body.notifications[key] !== undefined &&
      typeof req.body.notifications[key] !== "boolean"
    ))) {
      return res.status(400).json({ error: "Notification preferences must be boolean values" });
    }
    const preferences = getNotificationPreferences({
      notifications: {
        ...getNotificationPreferences(req.user),
        ...req.body.notifications,
      },
    });
    update.notifications = preferences;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: "No profile changes were provided" });
  }
  update.updatedAt = new Date().toISOString();

  await getUsersCollection().updateOne({ email: req.user.email }, { $set: update });
  res.json({
    message: "Profile updated",
    name,
    username: update.username || req.user.username,
    class: update.class !== undefined ? update.class : req.user.class,
    gender: update.gender !== undefined ? update.gender : req.user.gender,
    notifications: update.notifications || getNotificationPreferences(req.user),
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
  if (getNotificationPreferences(user).emailNotifications) {
    const { sendPasswordChangedEmail } = require("../services/emailService");
    try {
      await sendPasswordChangedEmail(user.email, user.name || user.username);
    } catch (err) {
      console.error("Password changed, but notification email failed:", err.message);
    }
  }
  res.json({ message: "Password changed" });
}

module.exports = { getMe, updateMe, changePassword };
