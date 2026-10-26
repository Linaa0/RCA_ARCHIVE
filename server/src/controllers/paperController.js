const fs = require("fs");
const path = require("path");
const { UPLOADS_DIR, BASE_URL } = require("../config/env");
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
const { CLASS_IDS, classLabel, getAcademicYear } = require("../config/classes");

function addFilterAnd(filter, condition) {
  filter.$and = filter.$and || [];
  filter.$and.push(condition);
}

function findClassId(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return CLASS_IDS.find((id) => id.toUpperCase() === normalized) || "";
}

async function addUploaderClasses(papers) {
  const ids = [...new Set(papers.map((paper) => paper.uploadedById).filter(Boolean))];
  const emails = [...new Set(papers.map((paper) => paper.uploadedByEmail).filter(Boolean))];
  const usernames = [...new Set(papers.map((paper) => paper.uploadedBy).filter(Boolean))];
  const or = [];
  if (ids.length) or.push({ id: { $in: ids } });
  if (emails.length) or.push({ email: { $in: emails } });
  if (usernames.length) or.push({ username: { $in: usernames } });
  if (!or.length) return papers;

  const uploaders = await getUsersCollection()
    .find({ $or: or }, { projection: { _id: 0, id: 1, email: 1, username: 1, class: 1 } })
    .toArray();
  const byId = new Map(uploaders.map((user) => [String(user.id), user]));
  const byEmail = new Map(uploaders.map((user) => [String(user.email || "").toLowerCase(), user]));
  const byUsername = new Map(uploaders.map((user) => [String(user.username || "").toLowerCase(), user]));

  return papers.map((paper) => {
    const uploader =
      (paper.uploadedById && byId.get(String(paper.uploadedById))) ||
      (paper.uploadedByEmail && byEmail.get(String(paper.uploadedByEmail).toLowerCase())) ||
      (paper.uploadedBy && byUsername.get(String(paper.uploadedBy).toLowerCase()));
    const uploaderClassId = uploader?.class || "";
    const directClassId = [paper.classId, paper.class].map(findClassId).find(Boolean);
    const effectiveClassId = directClassId
      ? directClassId
      : findClassId(uploaderClassId);
    return {
      ...paper,
      uploaderClassId,
      classLabel: effectiveClassId
        ? classLabel(effectiveClassId)
        : getPaperClass(paper).label,
    };
  });
}

async function listPapers(req, res) {
  const papers = getPapersCollection();
  const { subject, year, classId, type, search, sort, limit } = req.query;
  const filter = {};

  if (subject) filter.subject = subject;
  if (year) {
    const yr = String(year).trim();
    const normalized = yr.toUpperCase().replace(/\s+/g, "");
    const academicYearAlias = normalized.match(/^(?:Y|YEAR)?([123])$/);
    if (academicYearAlias) {
      const academicYear = Number(academicYearAlias[1]);
      const yearId = `Y${academicYear}`;
      const matchingClasses = CLASS_IDS.filter((id) => getAcademicYear(id) === academicYear);
      const matchingClassLabels = matchingClasses.map(classLabel);
      addFilterAnd(filter, {
        $or: [
          { year: String(academicYear) },
          { year: academicYear },
          { year: yearId },
          { year: `Year ${academicYear}` },
          { year: `Year ${yearId}` },
          { year: { $in: matchingClasses } },
          { promotion: yearId },
          ...(academicYear === 1 ? [{ promotion: "Y1GenAI" }] : []),
          { classId: { $in: matchingClasses } },
          { class: { $in: [...matchingClasses, ...matchingClassLabels] } },
        ],
      });
    } else if (normalized === "Y1GENAI") {
      addFilterAnd(filter, {
        $or: [
          { year: { $in: ["Y1GenAI", "Y1 GenAI"] } },
          { promotion: "Y1GenAI" },
          { classId: "Y1GenAI" },
          { class: "Y1GenAI" },
        ],
      });
    } else {
      const exactClass = CLASS_IDS.find((id) => id.toUpperCase() === normalized);
      if (exactClass) {
        addFilterAnd(filter, {
          $or: [
            { year: exactClass },
            { year: classLabel(exactClass) },
            { classId: exactClass },
            { class: { $in: [exactClass, classLabel(exactClass)] } },
          ],
        });
      } else {
        filter.year = year;
      }
    }
  }
  if (classId) {
    const exactClass = CLASS_IDS.find((id) => id.toUpperCase() === String(classId).toUpperCase());
    const classValues = exactClass ? [exactClass, classLabel(exactClass)] : [String(classId)];
    addFilterAnd(filter, {
      $or: [
        { year: { $in: classValues } },
        { classId: { $in: classValues } },
        { class: { $in: classValues } },
      ],
    });
  }
  if (type && type !== "All Types") filter.type = type;
  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    addFilterAnd(filter, {
      $or: [{ title: regex }, { subject: regex }, { type: regex }],
    });
  }

  const paperDocs = await papers.find(filter).toArray();
  const papersWithUploaderClasses = await addUploaderClasses(paperDocs);
  let result = papersWithUploaderClasses.map(buildRatingSummary);

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

function getPaperClass(paper) {
  const exactClass = [paper.classId, paper.class, paper.uploaderClassId]
    .map(findClassId)
    .find(Boolean);
  if (exactClass) return { id: exactClass, label: classLabel(exactClass) };

  const raw = String(paper.classId || paper.class || "").trim().toUpperCase();
  const academicYear = getAcademicYear(paper.year || raw);
  return academicYear
    ? { id: `Y${academicYear}-unspecified`, label: `Year ${academicYear} (class not specified)` }
    : { id: "General", label: "General" };
}

function buildDashboardSummary(allPapers, user) {
  const normalizedPapers = allPapers.map((paper) => ({
    ...paper,
    classLabel: paper.classLabel || getPaperClass(paper).label,
  }));
  const archivePapers = normalizedPapers.filter((paper) => {
    const type = String(paper.type || paper.category || "past_paper")
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
    return type === "pastpaper" || type === "notes" || type === "note" || type === "assignment";
  });
  const classCounts = new Map();

  const countedUploads = new Map();
  for (const paper of archivePapers) {
    const identity = paper.hash || paper.id || paper._id;
    if (!identity || countedUploads.has(String(identity))) continue;
    const { id, label } = getPaperClass(paper);
    const current = classCounts.get(id) || { className: label, count: 0 };
    current.count += 1;
    classCounts.set(id, current);
    countedUploads.set(String(identity), true);
  }

  const userEmail = String(user.email || "").toLowerCase();
  const userName = String(user.username || "").toLowerCase();
  const myUploads = normalizedPapers.filter((paper) =>
    (paper.uploadedById && String(paper.uploadedById) === String(user.id)) ||
    (paper.uploadedByEmail && String(paper.uploadedByEmail).toLowerCase() === userEmail) ||
    (paper.uploadedBy && String(paper.uploadedBy).toLowerCase() === userName)
  );

  return {
    totalPapers: allPapers.length,
    topClasses: [...classCounts.values()]
      .sort((a, b) => b.count - a.count || a.className.localeCompare(b.className))
      .slice(0, 2),
    recentPapers: archivePapers.slice(0, 4),
    myUploadsCount: myUploads.length,
    myUploads: myUploads.slice(0, 5),
  };
}

async function getDashboardSummary(req, res) {
  const papers = await getPapersCollection()
    .find(
      {},
      {
        projection: {
          _id: 0,
          id: 1,
          title: 1,
          subject: 1,
          year: 1,
          classId: 1,
          class: 1,
          type: 1,
          category: 1,
          hash: 1,
          filename: 1,
          originalName: 1,
          uploadedBy: 1,
          uploadedById: 1,
          uploadedByEmail: 1,
          uploadedAt: 1,
          createdAt: 1,
        },
      }
    )
    .sort({ uploadedAt: -1, createdAt: -1 })
    .toArray();
  const allPapers = await addUploaderClasses(papers);
  res.json(buildDashboardSummary(allPapers, req.user));
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

  const apiOrigin = (BASE_URL || "").replace(/\/+$/, "");
  const viewUrl = `${apiOrigin}/api/papers/access/${viewToken}/view`;
  const downloadUrl = `${apiOrigin}/api/papers/access/${downloadToken}/download`;

  res.json({
    paperId: paper.id,
    title: paper.title,
    originalName,
    expiresAt,
    viewUrl,
    downloadUrl,
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
  getDashboardSummary,
  buildDashboardSummary,
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
