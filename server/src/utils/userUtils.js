function escapeRegExp(value) {
  return (value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
}

function getDisplayName(user) {
  return user?.name || user?.username || user?.email || "Unknown user";
}

function getNotificationPreferences(user) {
  return {
    inAppAlerts: user?.notifications?.inAppAlerts !== false,
    dueReminders: user?.notifications?.dueReminders !== false,
    emailNotifications: user?.notifications?.emailNotifications !== false,
  };
}

function safeUserFields(user) {
  if (!user) return null;

  return {
    id: user.id || String(user._id || ""),
    name: user.name || user.username || "",
    username: user.username || user.name || "",
    email: user.email,
    role: user.role,
    status: user.status || "active",
    class: user.class || "",
    gender: user.gender || undefined,
    notifications: getNotificationPreferences(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    createdBy: user.createdBy,
    disabledAt: user.disabledAt,
  };
}

module.exports = {
  escapeRegExp,
  normalizeEmail,
  getDisplayName,
  getNotificationPreferences,
  safeUserFields,
};
