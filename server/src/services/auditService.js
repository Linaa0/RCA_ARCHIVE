const { getAdminAuditLogsCollection } = require("../models");

async function logAdminAction({
  actorId,
  actorEmail,
  actorRole,
  action,
  targetId,
  targetType,
  details = {},
  ip = "",
}) {
  try {
    const col = getAdminAuditLogsCollection();
    if (col) {
      await col.insertOne({
        actorId: actorId || "system",
        actorEmail: actorEmail || "system@rca.ac.rw",
        actorRole: actorRole || "admin",
        action,
        targetId: targetId || null,
        targetType: targetType || "resource",
        details,
        ip,
        createdAt: new Date(),
      });
    }
  } catch (err) {
    console.error("[AUDIT] Failed to record admin audit log:", err.message);
  }
}

module.exports = {
  logAdminAction,
};
