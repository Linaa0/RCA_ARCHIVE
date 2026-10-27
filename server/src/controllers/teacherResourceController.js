const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { MIME_TYPES } = require("../config/constants");
const { getTeacherResourcesCollection } = require("../models");
const { SUBMISSIONS_DIR, removeSubmissionFile } = require("../services/submissionStorage");
const {
  validateRequiredTerm,
  parseTermFilter,
  termFilterCondition,
  countsFromGroups,
  termLabel,
} = require("../config/terms");
const { emitResourceEvent } = require("../services/socketService");

const RESOURCE_TYPES = new Set(["notes", "past-paper"]);
const PUBLIC_FIELDS = {
  _id: 0,
  id: 1,
  title: 1,
  type: 1,
  subject: 1,
  year: 1,
  term: 1,
  originalName: 1,
  uploadedAt: 1,
};

async function listResources(req, res) {
  const termFilter = parseTermFilter(req.query.term);
  if (termFilter.invalid) {
    return res.status(400).json({ error: "Term filter must be 1, 2, 3 or unset.", field: "term" });
  }

  const collection = getTeacherResourcesCollection();
  const base = { teacherId: req.user.id };
  const groups = await collection
    .aggregate([{ $match: base }, { $group: { _id: "$term", count: { $sum: 1 } } }])
    .toArray();

  const condition = termFilterCondition(termFilter.filter);
  const filter = condition ? { $and: [base, condition] } : base;
  const resources = await collection
    .find(filter, { projection: PUBLIC_FIELDS })
    .sort({ uploadedAt: -1 })
    .toArray();
  res.json({ resources, termCounts: countsFromGroups(groups) });
}

async function createResource(req, res) {
  // The term comes first: a missing or invalid term is refused and the temporary file is removed
  const termCheck = validateRequiredTerm(req.body && req.body.term);
  if (!termCheck.valid) {
    if (req.file) removeSubmissionFile(req.file.filename);
    return res.status(400).json({ error: termCheck.error, field: termCheck.field });
  }

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
    term: termCheck.value,
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
  emitResourceEvent("created", publicResource);
  res.status(201).json({ resource: publicResource });
}

// Owner teacher or any admin can change the term of a resource
async function updateResourceTerm(req, res) {
  const termCheck = validateRequiredTerm(req.body && req.body.term);
  if (!termCheck.valid) {
    return res.status(400).json({ error: termCheck.error, field: termCheck.field });
  }

  const collection = getTeacherResourcesCollection();
  const resource = await collection.findOne({ id: req.params.id }, { projection: { _id: 0 } });
  if (!resource) return res.status(404).json({ error: "Resource not found." });

  const isOwner = resource.teacherId === req.user.id;
  if (req.user.role !== "admin" && !(req.user.role === "teacher" && isOwner)) {
    return res.status(403).json({ error: "Only the owning teacher or an admin can change the term of this resource." });
  }

  await collection.updateOne({ id: resource.id }, { $set: { term: termCheck.value, updatedAt: new Date().toISOString() } });
  const { filename, teacherId, teacherName, ...publicResource } = { ...resource, term: termCheck.value };
  emitResourceEvent("updated", publicResource);
  res.json({ message: `Moved to ${termLabel(termCheck.value)}`, resource: publicResource });
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

module.exports = { listResources, createResource, getResourceFile, updateResourceTerm };
