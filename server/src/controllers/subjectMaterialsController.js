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

  const matcher = subjectMatcher(subject);
  const [resources, assignments] = await Promise.all([
    getTeacherResourcesCollection()
      .find(
        { subject: matcher },
        { projection: { _id: 0, id: 1, title: 1, type: 1, subject: 1, year: 1, originalName: 1, uploadedAt: 1, teacherName: 1 } }
      )
      .sort({ uploadedAt: -1 })
      .toArray(),
    getAssignmentsCollection().find({ subject: matcher }, NO_ID).sort({ givenAt: -1, createdAt: -1 }).toArray(),
  ]);

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
    resources: resources.map((r) => ({ ...r, kind: r.type === "past-paper" ? "past-paper" : "notes" })),
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

  const filePath = path.join(SUBMISSIONS_DIR, path.basename(resource.filename));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "This file is no longer available on storage." });

  const ext = path.extname(resource.originalName).toLowerCase();
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.type(MIME_TYPES[ext] || "application/octet-stream");
  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(resource.originalName)}`);
  return res.sendFile(filePath);
}

module.exports = { listSubjectMaterials, getSubjectResourceFile };
