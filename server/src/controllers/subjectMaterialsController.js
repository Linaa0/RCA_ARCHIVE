const fs = require("fs");
const path = require("path");
const {
  getAssignmentsCollection,
  getTeacherResourcesCollection,
  getUsersCollection,
} = require("../models");
const { MIME_TYPES } = require("../config/constants");
const { SUBMISSIONS_DIR } = require("../services/submissionStorage");
const { classLabel } = require("../config/classes");
const { escapeRegExp } = require("../utils/userUtils");
const { hasStudentAccess } = require("../middleware/roleGuard");

const { parseTermFilter, termFilterCondition, countsFromGroups, normalizeTerm } = require("../config/terms");

const NO_ID = { projection: { _id: 0 } };

// Case-insensitive, whole-name match so "physics" finds "Physics"
function subjectMatcher(subject) {
  return { $regex: new RegExp(`^\\s*${escapeRegExp(String(subject).trim())}\\s*$`, "i") };
}

function canOpenAssignmentFile(user, a) {
  if (user.role === "teacher") return a.teacherId === user.id;
  if (!hasStudentAccess(user)) return false;
  return (
    a.audience === "all" ||
    (user.class && (a.classes || []).includes(user.class)) ||
    (a.studentIds || []).includes(user.id)
  );
}

// Everything uploaded or assigned for one subject, whatever the class.
// Assignments stay listed after their deadline.
async function listSubjectMaterials(req, res) {
  const subject = String(req.query.subject || "").trim();
  if (!subject) return res.status(400).json({ error: "Subject is required" });

  const termParam = req.query.term;
  let termCondition = null;
  if (termParam !== undefined && termParam !== null && String(termParam).trim() !== "") {
    const parsed = parseTermFilter(termParam);
    if (parsed.invalid) {
      return res.status(400).json({ error: "Choose Term 1, Term 2 or Term 3, or unset", field: "term" });
    }
    if (parsed.filter !== null) {
      termCondition = termFilterCondition(parsed.filter);
    }
  }

  const matcher = subjectMatcher(subject);
  const baseFilter = { subject: matcher };
  const queryFilter = termCondition ? { ...baseFilter, ...termCondition } : baseFilter;

  const [resourceGroups, assignmentGroups, resources, assignments] = await Promise.all([
    getTeacherResourcesCollection()
      .aggregate([
        { $match: baseFilter },
        { $group: { _id: "$term", count: { $sum: 1 } } },
      ])
      .toArray(),
    getAssignmentsCollection()
      .aggregate([
        { $match: baseFilter },
        { $group: { _id: "$term", count: { $sum: 1 } } },
      ])
      .toArray(),
    getTeacherResourcesCollection()
      .find(
        queryFilter,
        { projection: { _id: 0, id: 1, title: 1, type: 1, subject: 1, year: 1, term: 1, originalName: 1, uploadedAt: 1, teacherName: 1 } }
      )
      .sort({ uploadedAt: -1 })
      .toArray(),
    getAssignmentsCollection().find(queryFilter, NO_ID).sort({ givenAt: -1, createdAt: -1 }).toArray(),
  ]);

  const rCounts = countsFromGroups(resourceGroups);
  const aCounts = countsFromGroups(assignmentGroups);
  const termCounts = {
    1: rCounts[1] + aCounts[1],
    2: rCounts[2] + aCounts[2],
    3: rCounts[3] + aCounts[3],
    unset: rCounts.unset + aCounts.unset,
  };

  // Names for assignments given to individual students
  const studentIds = [...new Set(assignments.flatMap((a) => a.studentIds || []))];
  const students = studentIds.length
    ? await getUsersCollection()
        .find({ id: { $in: studentIds } }, { projection: { _id: 0, id: 1, name: 1, username: 1 } })
        .toArray()
    : [];
  const nameOf = (id) => {
    const s = students.find((x) => x.id === id);
    return (s && (s.name || s.username)) || "a student";
  };

  const now = new Date();
  res.json({
    subject,
    termCounts,
    resources: resources.map((r) => ({
      ...r,
      term: normalizeTerm(r.term),
      kind: r.type === "past-paper" ? "past-paper" : "notes",
    })),
    assignments: assignments.map((a) => {
      const givenTo = [
        ...(a.classes || []).map(classLabel),
        ...(a.studentIds || []).map(nameOf),
      ];
      if (!givenTo.length && a.audience === "all") givenTo.push("All classes");
      return {
        id: a.id,
        title: a.title,
        description: a.description || "",
        teacherName: a.teacherName,
        term: normalizeTerm(a.term),
        givenAt: a.givenAt || a.createdAt,
        deadline: a.deadline,
        isPastDeadline: new Date(a.deadline) < now,
        givenTo,
        hasAttachment: Boolean(a.attachment),
        attachmentName: a.attachment?.originalName || null,
        canOpenFile: Boolean(a.attachment) && canOpenAssignmentFile(req.user, a),
      };
    }),
  });
}

// Any signed-in user can read notes / past papers that teachers uploaded
async function getSubjectResourceFile(req, res) {
  const resource = await getTeacherResourcesCollection().findOne({ id: req.params.id }, NO_ID);
  if (!resource) return res.status(404).json({ error: "Resource not found." });

  const safeBase = path.basename(resource.filename);
  const filePath = path.resolve(SUBMISSIONS_DIR, safeBase);
  if (!filePath.startsWith(path.resolve(SUBMISSIONS_DIR) + path.sep) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "This file is no longer available on storage." });
  }

  const ext = path.extname(resource.originalName).toLowerCase();
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; sandbox; frame-ancestors 'self' https://*.vercel.app https://archive.innov.rw"
  );
  res.type(MIME_TYPES[ext] || "application/octet-stream");

  const SAFE_INLINE = [".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".txt"];
  const isInline = req.query.download !== "1" && SAFE_INLINE.includes(ext);
  const disposition = isInline ? "inline" : "attachment";
  res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(resource.originalName)}`);
  return res.sendFile(filePath);
}

module.exports = { listSubjectMaterials, getSubjectResourceFile };
