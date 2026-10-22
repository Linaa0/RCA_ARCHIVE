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
  if (year) filter.year = year;
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

async function getPaperFile(req, res) {
  const paper = await getPaperById(req.params.id);
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const filePath = path.join(UPLOADS_DIR, paper.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  if (req.query.download === "1") {
    return res.download(filePath, paper.originalName);
  }

  res.setHeader(
    "Content-Disposition",
    `inline; filename="${paper.originalName}"`
  );
  return res.sendFile(filePath);
}

async function viewPaper(req, res) {
  const paper = await getPaperById(req.params.id);
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const filePath = path.join(UPLOADS_DIR, paper.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const ext = path.extname(paper.originalName).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${paper.originalName}"`
  );
  return res.sendFile(filePath, { headers: { "Content-Type": contentType } });
}

async function downloadPaper(req, res) {
  const paper = await getPaperById(req.params.id);
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const filePath = path.join(UPLOADS_DIR, paper.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  return res.download(filePath, paper.originalName);
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

  return res.json({
    message: "Paper updated successfully.",
    paper: buildRatingSummary(updatedPaper),
  });
}

async function deletePaper(req, res) {
  const papers = getPapersCollection();
  const paper = await papers.findOne({ id: req.params.id });
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  await permanentlyDeletePaperRecord(paper, "admin direct delete", req.user);
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
};
