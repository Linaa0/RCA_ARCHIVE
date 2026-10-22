const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { UPLOADS_DIR } = require("../config/env");

// Student work is NOT served statically (unlike past papers) - it is only
// reachable through the authenticated download endpoint.
const SUBMISSIONS_DIR =
  process.env.SUBMISSIONS_DIR || path.resolve(UPLOADS_DIR, "..", "submissions");

if (!fs.existsSync(SUBMISSIONS_DIR)) {
  fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
}

const ALLOWED = [".pdf", ".doc", ".docx", ".zip", ".txt", ".ppt", ".pptx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SUBMISSIONS_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const submissionUpload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED.includes(ext)) return cb(null, true);
    cb(new Error(`File type not allowed. Allowed: ${ALLOWED.join(", ")}`));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

function handleSubmissionUpload(req, res, next) {
  submissionUpload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "File upload failed." });
    next();
  });
}

function removeSubmissionFile(filename) {
  if (!filename) return;
  const full = path.join(SUBMISSIONS_DIR, path.basename(filename));
  if (fs.existsSync(full)) {
    try {
      fs.unlinkSync(full);
    } catch (e) {
      console.error("Failed to remove submission file:", e.message);
    }
  }
}

module.exports = { SUBMISSIONS_DIR, handleSubmissionUpload, removeSubmissionFile };
