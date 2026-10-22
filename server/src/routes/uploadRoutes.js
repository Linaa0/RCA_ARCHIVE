const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const { requireAuth } = require("../middleware/authMiddleware");
const { handleUploadSingle } = require("../middleware/uploadMiddleware");

router.post("/api/upload", requireAuth, handleUploadSingle("file"), uploadController.uploadPaper);
router.get("/uploads/:filename", uploadController.serveUpload);

module.exports = router;
