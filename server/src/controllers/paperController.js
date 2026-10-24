const fs = require("fs");
const path = require("path");
const { UPLOADS_DIR } = require("../config/env");
const { MIME_TYPES } = require("../config/constants");
const {
  getPapersCollection,
  getUsersCollection,
  getDeletionRequestsCollection,
} = require("../models");
const {
  buildRatingSummary,
  getPaperById,
} = require("../services/ratingService");
const {
  permanentlyDeletePaperRecord,
} = require("../services/storageService");
const { escapeRegExp, getDisplayName } = require("../utils/userUtils");

async function listPapers(req, res) {
  const papers = getPapersCollection();
  const { subject, year, type, search, sort, limit } = req.query;
  const filter = {};

  if (subject) filter.subject = subject;
  if (year) {
    const yr = String(year).trim();
    if (yr === "Y1" || yr === "1") {
      filter.$or = [{ year: "1" }, { year: 1 }, { year: "Y1" }, { promotion: "Y1" }];
    } else if (yr === "Y1GenAI" || yr === "Y1 GenAI") {
      filter.$or = [{ year: "Y1GenAI" }, { promotion: "Y1GenAI" }, { class: "Y1GenAI" }];
    } else if (yr === "Y2" || yr === "2") {
      filter.$or = [{ year: "2" }, { year: 2 }, { year: "Y2" }, { promotion: "Y2" }];
    } else if (yr === "Y3" || yr === "3") {
      filter.$or = [{ year: "3" }, { year: 3 }, { year: "Y3" }, { promotion: "Y3" }];
    } else {
      filter.year = year;
    }
  }
  if (type && type !== "All Types") filter.type = type;
  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    filter.$or = [{ title: regex }, { subject: regex }, { type: regex }];
  }

  const paperDocs = await papers.find(filter).toArray();
  let result = paperDocs.map(buildRatingSummary);

  if (sort === "top") {
    result.sort((a, b) => {
      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }
      return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    });
  } else if (sort === "recent") {
    result.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  const parsedLimit = Number(limit);
  if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
    result = result.slice(0, parsedLimit);
  }

  res.json(result);
}

const crypto = require("crypto");
const { JWT_SECRET } = require("../config/env");
const { emitPaperEvent, emitDeletionEvent } = require("../services/socketService");

function signAccessLink(paperId, action, expiresAt) {
  const data = `${paperId}:${action}:${expiresAt}`;
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${paperId}.${action}.${expiresAt}.${sig}`;
}

function verifyAccessLink(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [paperId, action, expiresAtStr, sig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (Number.isNaN(expiresAt)) return null;
  if (Date.now() > expiresAt) {
    return { expired: true, paperId, action };
  }
  const data = `${paperId}:${action}:${expiresAtStr}`;
  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
  } catch (_) {
    return null;
  }
  return { valid: true, paperId, action, expiresAt };
}

function formatContentDisposition(type, originalName) {
  const cleanName = (originalName || "document.pdf")
    .replace(/[\r\n\0]/g, "")
    .trim();

  const asciiFallback = cleanName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "");

  const encodedName = encodeURIComponent(cleanName)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");

  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`;
}

async function createAccessLink(req, res) {
  const { id } = req.params;
  const paper = await getPaperById(id);
  if (!paper) {
    return res.status(404).json({ error: "Paper not found" });
  }

  const filePath = path.join(UPLOADS_DIR, paper.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "This file is no longer available on storage." });
  }

  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  const viewToken = signAccessLink(paper.id, "view", expiresAt);
  const downloadToken = signAccessLink(paper.id, "download", expiresAt);

  const ext = path.extname(paper.originalName || paper.filename || ".pdf");
  const originalName = paper.originalName || `${paper.title || "document"}${ext}`;

  res.json({
    paperId: paper.id,
    title: paper.title,
    originalName,
    expiresAt,
    viewUrl: `/api/papers/access/${viewToken}/view`,
    downloadUrl: `/api/papers/access/${downloadToken}/download`,
  });
}

async function accessPaperFile(req, res) {
  const { token, mode } = req.params;
  const verified = verifyAccessLink(token);
  if (!verified) {
    return res.status(403).json({ error: "Invalid access signature." });
  }
  if (verified.expired) {
    return res.status(410).json({ error: "This access link has expired. Please request a new link." });
  }

  const paper = await getPaperById(verified.paperId);
  if (!paper) {
    return res.status(404).json({ error: "Paper not found." });
  }

  const filePath = path.join(UPLOADS_DIR, paper.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "This file is no longer available on storage." });
  }

  const ext = path.extname(paper.originalName || paper.filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const originalName = paper.originalName || `${paper.title || "document"}${ext || ".pdf"}`;

  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

  if (mode === "download" || verified.action === "download") {
    res.setHeader("Content-Disposition", formatContentDisposition("attachment", originalName));
    res.setHeader("Content-Type", contentType);
    return res.sendFile(filePath);
  }

  res.setHeader("Content-Disposition", formatContentDisposition("inline", originalName));
  res.setHeader("Content-Type", contentType);
  return res.sendFile(filePath);
}

async function getPaperFile(req, res) {
  const paper = await getPaperById(req.params.id);
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const filePath = path.join(UPLOADS_DIR, paper.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "This file is no longer available on storage." });
  }

  const ext = path.extname(paper.originalName || paper.filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const originalName = paper.originalName || `${paper.title || "document"}${ext || ".pdf"}`;

  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

  if (req.query.download === "1") {
    res.setHeader("Content-Disposition", formatContentDisposition("attachment", originalName));
    res.setHeader("Content-Type", contentType);
    return res.sendFile(filePath);
  }

  res.setHeader("Content-Disposition", formatContentDisposition("inline", originalName));
  res.setHeader("Content-Type", contentType);
  return res.sendFile(filePath);
}

async function viewPaper(req, res) {
  const paper = await getPaperById(req.params.id);
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const filePath = path.join(UPLOADS_DIR, paper.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "This file is no longer available on storage." });
  }

  const ext = path.extname(paper.originalName || paper.filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const originalName = paper.originalName || `${paper.title || "document"}${ext || ".pdf"}`;

  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", formatContentDisposition("inline", originalName));
  return res.sendFile(filePath);
}

async function downloadPaper(req, res) {
  const paper = await getPaperById(req.params.id);
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const filePath = path.join(UPLOADS_DIR, paper.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "This file is no longer available on storage." });
  }

  const ext = path.extname(paper.originalName || paper.filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const originalName = paper.originalName || `${paper.title || "document"}${ext || ".pdf"}`;

  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", formatContentDisposition("attachment", originalName));
  return res.sendFile(filePath);
}

async function ratePaper(req, res) {
  const { id } = req.params;
  const { rating } = req.body;

  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    return res
      .status(400)
      .json({ error: "Rating must be a number between 1 and 5" });
  }

  const papers = getPapersCollection();
  const paper = await papers.findOne({ id });
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const ratings = paper.ratings || [];
  const existing = ratings.find((r) => r.username === req.user.username);
  if (existing) {
    existing.value = rating;
  } else {
    ratings.push({ username: req.user.username, value: rating });
  }

  await papers.updateOne({ id }, { $set: { ratings } });
  res.json({
    message: "Rating saved",
    paper: buildRatingSummary({ ...paper, ratings }),
  });
}

async function updatePaper(req, res) {
  const { id } = req.params;
  const papers = getPapersCollection();
  const paper = await papers.findOne({ id });

  if (!paper) {
    return res.status(404).json({ error: "Paper not found" });
  }

  if (req.user.role !== "admin" && paper.uploadedBy !== req.user.username) {
    return res.status(403).json({
      error: "You can only edit papers that you uploaded.",
    });
  }

  const { title, subject, year, type } = req.body;
  const update = {};

  if (typeof title === "string" && title.trim()) update.title = title.trim();
  if (typeof subject === "string" && subject.trim()) update.subject = subject.trim();
  if (typeof year === "string" && year.trim()) update.year = year.trim();
  if (typeof type === "string" && type.trim()) update.type = type.trim();

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: "No changes were provided." });
  }

  update.updatedAt = new Date().toISOString();

  await papers.updateOne({ id }, { $set: update });
  const updatedPaper = await papers.findOne({ id });
  const summary = buildRatingSummary(updatedPaper);
  emitPaperEvent("updated", summary);

  return res.json({
    message: "Paper updated successfully.",
    paper: summary,
  });
}

async function deletePaper(req, res) {
  const papers = getPapersCollection();
  const paper = await papers.findOne({ id: req.params.id });
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const isUploader =
    Boolean(paper.uploadedById && String(paper.uploadedById) === String(req.user.id)) ||
    Boolean(paper.uploadedBy && paper.uploadedBy === req.user.username) ||
    Boolean(paper.uploadedByEmail && paper.uploadedByEmail === req.user.email);

  if (req.user.role !== "admin" && !isUploader) {
    return res.status(403).json({ error: "You can only delete papers that you uploaded." });
  }

  const auditReason = req.user.role === "admin" ? "admin direct delete" : "uploader direct delete";
  await permanentlyDeletePaperRecord(paper, auditReason, req.user);
  emitPaperEvent("deleted", { id: req.params.id });
  res.json({ message: "Paper deleted successfully" });
}

async function requestDeletePaper(req, res) {
  const { id } = req.params;
  const { reason } = req.body;
  const trimmedReason = (reason || "").trim();

  if (!trimmedReason) {
    return res
      .status(400)
      .json({ error: "A reason is required for deletion requests." });
  }

  const paper = await getPaperById(id);
  if (!paper) {
    return res.status(404).json({ error: "Paper not found" });
  }

  const deletionRequests = getDeletionRequestsCollection();
  const existingPending = await deletionRequests.findOne({
    paperId: paper.id,
    status: "Pending",
  });

  if (existingPending) {
    return res.status(409).json({
      error: "A pending deletion request already exists for this paper.",
    });
  }

  const request = {
    id: `del-${Date.now().toString()}`,
    paperId: paper.id,
    paperTitle: paper.title,
    requestedBy: getDisplayName(req.user),
    requestedByEmail: req.user.email,
    requesterRole: req.user.role,
    reason: trimmedReason,
    status: "Pending",
    requestedAt: new Date().toISOString(),
    processedAt: null,
    processedBy: null,
  };

  await deletionRequests.insertOne(request);
  emitDeletionEvent("created", request, paper.uploadedById);

  console.log(
    `[DELETE_REQUEST] id=${request.id} paperId=${paper.id} by=${req.user.email} role=${req.user.role}`
  );

  return res.json({
    message: "Deletion request submitted successfully.",
    request,
  });
}

async function getStats(req, res) {
  const users = getUsersCollection();
  const papers = getPapersCollection();
  const totalPapers = await papers.countDocuments();
  const totalUsers = await users.countDocuments();

  res.json({
    totalPapers,
    totalUsers,
  });
}

module.exports = {
  listPapers,
  getPaperFile,
  viewPaper,
  downloadPaper,
  ratePaper,
  updatePaper,
  deletePaper,
  requestDeletePaper,
  getStats,
  createAccessLink,
  accessPaperFile,
  formatContentDisposition,
  signAccessLink,
  verifyAccessLink,
};
