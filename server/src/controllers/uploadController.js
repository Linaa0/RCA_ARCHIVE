const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { UPLOADS_DIR } = require("../config/env");
const { getPapersCollection } = require("../models");
const { hashFile } = require("../services/hashService");
const { buildRatingSummary } = require("../services/ratingService");
const { mapPaperForRole } = require("../utils/responseMappers");
const { validatePlainText } = require("../utils/validation");
const { emitPaperEvent } = require("../services/socketService");
const { validateRequiredTerm } = require("../config/terms");
const { describeLocation, describeExistingItem } = require("../utils/paperLocation");

const { validateUploadedFileContent } = require("../utils/fileValidation");

async function uploadPaper(req, res) {
  if (!req.file) {
    // The term is still reported first so the form shows the right error
    const termCheck = validateRequiredTerm(req.body && req.body.term);
    if (!termCheck.valid) {
      return res.status(400).json({ error: termCheck.error, field: termCheck.field });
    }
    return res.status(400).json({ error: "No file uploaded" });
  }

  // The term is validated before the file is inspected, hashed or kept
  const termCheck = validateRequiredTerm(req.body && req.body.term);
  if (!termCheck.valid) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: termCheck.error, field: termCheck.field });
  }
  const paperTerm = termCheck.value;

  const validation = validateUploadedFileContent(
    req.file.path,
    req.file.originalname,
    req.file.mimetype,
    [".pdf", ".doc", ".docx"]
  );

  if (!validation.valid) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({
      error: validation.error || "Invalid file content. Uploaded file must be a genuine PDF or Word document.",
    });
  }

  // Derive stored extension from detected structural type and ensure disk filename matches
  const detectedExt = validation.detectedExt;
  if (detectedExt && path.extname(req.file.filename).toLowerCase() !== detectedExt) {
    const currentPath = req.file.path;
    const baseWithoutExt = path.basename(req.file.filename, path.extname(req.file.filename));
    const newFilename = `${baseWithoutExt}${detectedExt}`;
    const newPath = path.join(path.dirname(currentPath), newFilename);
    try {
      fs.renameSync(currentPath, newPath);
      req.file.filename = newFilename;
      req.file.path = newPath;
    } catch (_) {}
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

  // Permissions: Assignments are teacher-only; students and teachers are permitted to upload to any class or academic year
  if (req.user.role === "student") {
    if (paperType.toLowerCase() === "assignment") {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({
        error: "Students are not permitted to upload assignments. Only teachers may create assignments.",
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
    const existing = describeExistingItem(duplicate);
    return res.status(409).json({
      error: "duplicate",
      message: `This paper already exists in ${describeLocation(duplicate)}.`,
      existingPaper: existing,
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
    id: crypto.randomUUID(),
    title: vTitle.value,
    subject: vSubject.value,
    year: paperYear,
    classId: classId || paperYear,
    term: paperTerm,
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
    message: `Uploaded to ${describeLocation(paper)}`,
    paper: mapPaperForRole(paper, req.user),
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
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; sandbox; frame-ancestors 'self' https://*.vercel.app https://archive.innov.rw"
  );

  const safeInlineExts = [".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".txt"];
  const ext = path.extname(safeFilename).toLowerCase();
  const disposition = safeInlineExts.includes(ext) ? "inline" : "attachment";
  res.setHeader("Content-Disposition", `${disposition}; filename="${safeFilename}"`);

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
