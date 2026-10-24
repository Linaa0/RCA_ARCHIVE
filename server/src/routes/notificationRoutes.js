const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { requireAuth } = require("../middleware/authMiddleware");

router.use(requireAuth);

router.get("/notifications", notificationController.listNotifications);
router.patch("/notifications/:id/read", notificationController.markNotificationRead);
router.post("/notifications/mark-all-read", notificationController.markAllNotificationsRead);

module.exports = router;
