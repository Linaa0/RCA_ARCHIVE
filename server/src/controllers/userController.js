const { getUsersCollection } = require("../models");
const { mapUserForRole } = require("../utils/responseMappers");

async function listUsers(req, res) {
  try {
    const usersCollection = getUsersCollection();
    const users = await usersCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      users: users.map((user) => mapUserForRole(user, req.user)),
    });
  } catch (error) {
    console.error("Failed to load users:", error);
    res.status(500).json({ error: "Failed to load users." });
  }
}

async function getUser(req, res) {
  try {
    const { id } = req.params;
    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({ id });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (req.user.role !== "admin" && String(req.user.id) !== String(user.id)) {
      return res.status(403).json({ error: "Access denied" });
    }
    return res.json({ user: mapUserForRole(user, req.user) });
  } catch (error) {
    console.error("Failed to get user:", error);
    return res.status(500).json({ error: "Failed to get user" });
  }
}

module.exports = {
  listUsers,
  getUser,
};
