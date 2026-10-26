const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { MIME_TYPES } = require("../config/constants");
const { getTeacherResourcesCollection } = require("../models");
const { SUBMISSIONS_DIR, removeSubmissionFile } = require("../services/submissionStorage");

const RESOURCE_TYPES = new Set(["notes", "past-paper"]);
const PUBLIC_FIELDS = {
  _id: 0,
  id: 1,
  title: 1,
  type: 1,
  subject: 1,
  year: 1,
  originalName: 1,
  uploadedAt: 1,
};

async function listResources(req, res) {
  const resources = await getTeacherResourcesCollection()
    .find({ teacherId: req.user.id }, { projection: PUBLIC_FIELDS })
    .sort({ uploadedAt: -1 })
    .toArray();
  res.json({ resources });
}

async function createResource(req, res) {
  if (!req.file) return res.status(400).json({ error: "Choose a file to upload." });

  const title = String(req.body.title || "").trim();
  const type = String(req.body.type || "").trim();
  const subject = String(req.body.subject || "").trim();
  const year = String(req.body.year || "").trim();
  if (!title || title.length > 160 || !RESOURCE_TYPES.has(type)) {
    removeSubmissionFile(req.file.filename);
    return res.status(400).json({ error: "Enter a title (up to 160 characters) and choose Notes or Past Paper." });
  }

  const resource = {
    id: randomUUID(),
    teacherId: req.user.id,
    teacherName: req.user.name || req.user.username || req.user.email,
    title,
    type,
    subject: subject.slice(0, 100),
    year: year.slice(0, 30),
    filename: req.file.filename,
    originalName: req.file.originalname,
    uploadedAt: new Date().toISOString(),
  };

  try {
    await getTeacherResourcesCollection().insertOne(resource);
  } catch (err) {
    removeSubmissionFile(req.file.filename);
    throw err;
  }

  const { filename, teacherId, teacherName, ...publicResource } = resource;
  res.status(201).json({ resource: publicResource });
}

async function getResourceFile(req, res) {
  const resource = await getTeacherResourcesCollection().findOne(
    { id: req.params.id, teacherId: req.user.id },
    { projection: { _id: 0 } }
  );
  if (!resource) return res.status(404).json({ error: "Resource not found." });

  const safeBase = path.basename(resource.filename);
  const filePath = path.resolve(SUBMISSIONS_DIR, safeBase);
  if (!filePath.startsWith(path.resolve(SUBMISSIONS_DIR) + path.sep) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "This file is no longer available on storage." });
  }

  const ext = path.extname(resource.originalName).toLowerCase();
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.type(MIME_TYPES[ext] || "application/octet-stream");
  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(resource.originalName)}`);
  return res.sendFile(filePath);
}

module.exports = { listResources, createResource, getResourceFile };
