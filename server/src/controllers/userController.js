const { getUsersCollection } = require("../models");
const { safeUserFields } = require("../utils/userUtils");

async function listUsers(req, res) {
  try {
    const usersCollection = getUsersCollection();
    const users = await usersCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      users: users.map((user) => safeUserFields(user)),
    });
  } catch (error) {
    console.error("Failed to load users:", error);
    res.status(500).json({ message: "Failed to load users." });
  }
}

module.exports = {
  listUsers,
};
