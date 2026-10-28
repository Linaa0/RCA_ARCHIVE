const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const { requireAuth } = require("../middleware/authMiddleware");
const { handleUploadSingle } = require("../middleware/uploadMiddleware");

const { uploadLimiter } = require("../middleware/rateLimiter");

router.post("/api/upload", requireAuth, uploadLimiter, handleUploadSingle("file"), uploadController.uploadPaper);

module.exports = router;
