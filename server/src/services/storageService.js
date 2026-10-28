const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { UPLOADS_DIR } = require("../config/env");
const { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } = require("../config/constants");
const { getPapersCollection } = require("../models");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = require("crypto").randomUUID();
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      ALLOWED_EXTENSIONS.includes(ext) &&
      ALLOWED_MIME_TYPES.includes(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only PDF and Word documents (.pdf, .doc, .docx) are allowed."
        )
      );
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

async function permanentlyDeletePaperRecord(paper, reason, actor) {
  if (!paper) return;

  const filePath = path.join(UPLOADS_DIR, paper.filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`Failed to unlink file at ${filePath}:`, err.message);
    }
  }

  const papers = getPapersCollection();
  await papers.deleteOne({ id: paper.id });

  console.log(
    `[PAPER_DELETE] id=${paper.id} title="${paper.title}" actor=${actor?.email || "system"} role=${actor?.role || "system"} reason="${reason || "n/a"}"`
  );
}

module.exports = {
  UPLOADS_DIR,
  upload,
  permanentlyDeletePaperRecord,
};
