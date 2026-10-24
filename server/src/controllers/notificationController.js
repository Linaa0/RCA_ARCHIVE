const { getNotificationsCollection } = require("../models");

async function listNotifications(req, res) {
  try {
    const notifications = getNotificationsCollection();
    const userId = String(req.user.id || req.user.userId || "");
    const email = String(req.user.email || "");

    const query = {
      $or: [
        { userId },
        { userId: email },
      ],
    };

    const list = await notifications
      .find(query, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const unreadCount = list.filter((n) => !n.read).length;

    res.json({
      notifications: list,
      unreadCount,
    });
  } catch (err) {
    console.error("Failed to list notifications:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
}

async function markNotificationRead(req, res) {
  try {
    const notifications = getNotificationsCollection();
    const { id } = req.params;
    const userId = String(req.user.id || req.user.userId || "");
    const email = String(req.user.email || "");

    const result = await notifications.updateOne(
      {
        id,
        $or: [{ userId }, { userId: email }],
      },
      {
        $set: { read: true, readAt: new Date().toISOString() },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error("Failed to mark notification read:", err);
    res.status(500).json({ error: "Failed to update notification" });
  }
}

async function markAllNotificationsRead(req, res) {
  try {
    const notifications = getNotificationsCollection();
    const userId = String(req.user.id || req.user.userId || "");
    const email = String(req.user.email || "");

    await notifications.updateMany(
      {
        $or: [{ userId }, { userId: email }],
        read: false,
      },
      {
        $set: { read: true, readAt: new Date().toISOString() },
      }
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("Failed to mark all notifications read:", err);
    res.status(500).json({ error: "Failed to update notifications" });
  }
}

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
