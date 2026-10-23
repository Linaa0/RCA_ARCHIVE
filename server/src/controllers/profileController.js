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

  const update = { name, username: name, updatedAt: new Date().toISOString() };

  // Students choose their class (it decides which assignments they receive)
  if (req.user.role === "student" && req.body.class !== undefined) {
    const cls = normalizeClass(req.body.class);
    if (!cls) return res.status(400).json({ error: "Please choose a valid class" });
    update.class = cls;
  }

  // Gender preference ('male' or 'female')
  if (req.body.gender !== undefined) {
    const g = String(req.body.gender).toLowerCase().trim();
    if (g === "male" || g === "female") {
      update.gender = g;
    } else {
      return res.status(400).json({ error: "Gender must be either 'male' or 'female'" });
    }
  }

  await getUsersCollection().updateOne({ email: req.user.email }, { $set: update });
  res.json({ message: "Profile updated", name, class: update.class, gender: update.gender });
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
