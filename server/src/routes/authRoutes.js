const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");

router.post("/send-otp", authController.sendOtp);
router.post("/send-teacher-otp", authController.sendTeacherOtp);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.delete("/account", requireAuth, authController.deleteAccount);
router.put("/make-admin", authController.makeAdmin);
router.post("/test/clear-failed-attempts", authController.clearFailedAttemptsTest);

module.exports = router;
