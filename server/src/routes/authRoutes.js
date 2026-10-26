const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");

const {
  signupLimiter,
  sendOtpLimiter,
  forgotPasswordLimiter,
  loginLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
} = require("../middleware/rateLimiter");

router.post("/send-otp", sendOtpLimiter, authController.sendOtp);
router.post("/send-teacher-otp", sendOtpLimiter, authController.sendTeacherOtp);
router.post("/forgot-password", forgotPasswordLimiter, authController.forgotPassword);
router.post("/reset-password", resetPasswordLimiter, authController.resetPassword);
router.post("/signup", signupLimiter, authController.signup);
router.post("/login", loginLimiter, authController.login);
router.post("/change-password", requireAuth, changePasswordLimiter, authController.changePassword);
router.delete("/account", requireAuth, authController.deleteAccount);

module.exports = router;
