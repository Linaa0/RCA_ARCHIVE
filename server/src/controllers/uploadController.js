const fs = require("fs");
const path = require("path");
const { UPLOADS_DIR } = require("../config/env");
const { getPapersCollection } = require("../models");
const { hashFile } = require("../services/hashService");
const { buildRatingSummary } = require("../services/ratingService");
const { validatePlainText } = require("../utils/validation");
const { emitPaperEvent } = require("../services/socketService");

function isValidDocumentMagicBytes(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(8);
    const bytesRead = fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) return false;

    // PDF: %PDF- (0x25 0x50 0x44 0x46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return true;
    }
    // DOC (Compound Binary): D0 CF 11 E0
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
      return true;
    }
    // DOCX (ZIP archive): PK\x03\x04
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      return true;
    }

    return false;
  } catch (_) {
    return false;
  }
}

async function uploadPaper(req, res) {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  if (!isValidDocumentMagicBytes(req.file.path)) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({
      error: "Invalid file content. Uploaded file must be a genuine PDF or Word document.",
    });
  }

  const { title, subject, year, type, classId, category } = req.body;

  const vTitle = validatePlainText(title, { fieldName: "Title", minLength: 2, maxLength: 120, required: true });
  if (!vTitle.valid) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: vTitle.message, field: "title" });
  }

  const vSubject = validatePlainText(subject, { fieldName: "Subject", minLength: 2, maxLength: 80, required: true });
  if (!vSubject.valid) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: vSubject.message, field: "subject" });
  }

  const paperYear = (year || classId || "").trim();
  const paperType = (type || category || "past_paper").trim();

  if (!paperYear) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Academic year or class is required.", field: "year" });
  }

  // Permissions: Assignments are teacher-only; Students upload to their own academic year
  if (req.user.role === "student") {
    if (paperType.toLowerCase() === "assignment") {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({
        error: "Students are not permitted to upload assignments. Only teachers may create assignments.",
      });
    }

    const studentClass = (req.user.class || "").trim();
    const requestedClass = (classId || year || "").trim();
    const { getAcademicYear } = require("../config/classes");
    const studentYear = getAcademicYear(studentClass);
    const requestedYear = getAcademicYear(requestedClass);

    if (studentYear && requestedYear) {
      if (studentYear !== requestedYear) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(403).json({
          error: `Students are only permitted to upload papers to their own enrolled class (${studentClass}) or academic year (Year ${studentYear}).`,
        });
      }
    } else if (studentClass && requestedClass && requestedClass.toLowerCase() !== studentClass.toLowerCase()) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({
        error: `Students are only permitted to upload papers to their own enrolled class (${studentClass}).`,
      });
    }
  }

  const papers = getPapersCollection();
  let hash;
  try {
    hash = await hashFile(req.file.path);
  } catch (err) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: "Failed to process uploaded file." });
  }

  const duplicate = await papers.findOne({ hash });
  if (duplicate) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(409).json({
      error: "duplicate",
      message: `This paper already exists! It was uploaded as "${duplicate.title}" in ${duplicate.classId || duplicate.year} (${duplicate.subject}) by ${duplicate.uploadedBy}.`,
      existingPaper: {
        id: duplicate.id,
        title: duplicate.title,
        subject: duplicate.subject,
        classId: duplicate.classId || duplicate.year,
        category: duplicate.type || duplicate.category || "past_paper",
        uploadedBy: duplicate.uploadedBy,
      },
    });
  }

  let originalName = req.file.originalname;
  try {
    originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
  } catch (_) {}
  if (!originalName || originalName.trim().length === 0) {
    const ext = path.extname(req.file.filename || "") || ".pdf";
    originalName = `${vTitle.value}${ext}`;
  }

  const paper = {
    id: Date.now().toString(),
    title: vTitle.value,
    subject: vSubject.value,
    year: paperYear,
    classId: classId || paperYear,
    type: paperType,
    category: paperType,
    filename: req.file.filename,
    originalName,
    hash,
    uploadedBy: req.user.username,
    uploadedByEmail: req.user.email,
    uploadedById: req.user.id,
    uploadedAt: new Date().toISOString(),
    ratings: [],
  };

  await papers.insertOne(paper);
  const summary = buildRatingSummary(paper);
  emitPaperEvent("created", summary);

  res.json({
    message: "Paper uploaded successfully!",
    paper: summary,
  });
}

async function serveUpload(req, res) {
  const rawFilename = String(req.params.filename || "").replace(/[\0\r\n]/g, "");
  const safeFilename = path.basename(rawFilename);
  if (!safeFilename || safeFilename === "." || safeFilename === "..") {
    return res.status(400).json({ error: "Invalid filename" });
  }

  const resolvedDir = path.resolve(UPLOADS_DIR);
  const filePath = path.resolve(resolvedDir, safeFilename);

  if (!filePath.startsWith(resolvedDir + path.sep)) {
    return res.status(403).json({ error: "Access denied" });
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  try {
    const papers = getPapersCollection();
    const paper = await papers.findOne({ filename: safeFilename });
    if (paper) {
      const paperSafe = path.basename(paper.filename);
      const paperPath = path.resolve(resolvedDir, paperSafe);
      if (paperPath.startsWith(resolvedDir + path.sep) && fs.existsSync(paperPath)) {
        return res.sendFile(paperPath);
      }
    }
  } catch (err) {
    console.error("Error resolving upload file:", err);
  }

  return res.status(404).json({ error: "File not found" });
}

module.exports = {
  uploadPaper,
  serveUpload,
};
