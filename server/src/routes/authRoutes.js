const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");

const {
  signupLimiter,
  sendOtpLimiter,
  verifyOtpLimiter,
  forgotPasswordLimiter,
  loginLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
  refreshLimiter,
} = require("../middleware/rateLimiter");

router.post("/send-otp", sendOtpLimiter, authController.sendOtp);
router.post("/send-teacher-otp", sendOtpLimiter, authController.sendTeacherOtp);
router.post("/verify-otp", verifyOtpLimiter, authController.verifyOtp);
router.post("/forgot-password", forgotPasswordLimiter, authController.forgotPassword);
router.post("/reset-password", resetPasswordLimiter, authController.resetPassword);
router.post("/signup", signupLimiter, authController.signup);
router.post("/login", loginLimiter, authController.login);
router.post("/logout", requireAuth, authController.logout);
router.post("/logout-all", requireAuth, authController.logoutAll);
router.post("/auth/refresh", refreshLimiter, authController.refreshAuthToken);
router.post("/refresh", refreshLimiter, authController.refreshAuthToken);
router.post("/change-password", requireAuth, changePasswordLimiter, authController.changePassword);
router.delete("/account", requireAuth, authController.deleteAccount);

module.exports = router;
