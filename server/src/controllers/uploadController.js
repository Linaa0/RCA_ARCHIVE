const fs = require("fs");
const path = require("path");
const { UPLOADS_DIR } = require("../config/env");
const { getPapersCollection } = require("../models");
const { hashFile } = require("../services/hashService");
const { buildRatingSummary } = require("../services/ratingService");

async function uploadPaper(req, res) {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { title, subject, year, type } = req.body;
  if (!title || !subject || !year || !type) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ error: "Please fill in all fields" });
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
      message: `This paper already exists! It was uploaded as "${duplicate.title}" by ${duplicate.uploadedBy}.`,
    });
  }

  const paper = {
    id: Date.now().toString(),
    title,
    subject,
    year,
    type,
    filename: req.file.filename,
    originalName: req.file.originalname,
    hash,
    uploadedBy: req.user.username,
    uploadedByEmail: req.user.email,
    uploadedById: req.user.id,
    uploadedAt: new Date().toISOString(),
    ratings: [],
  };

  await papers.insertOne(paper);
  res.json({
    message: "Paper uploaded successfully!",
    paper: buildRatingSummary(paper),
  });
}

async function serveUpload(req, res) {
  const { filename } = req.params;
  const filePath = path.join(UPLOADS_DIR, filename);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  try {
    const papers = getPapersCollection();
    const paper = await papers.findOne({ filename });
    if (paper) {
      const paperPath = path.join(UPLOADS_DIR, paper.filename);
      if (fs.existsSync(paperPath)) {
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
