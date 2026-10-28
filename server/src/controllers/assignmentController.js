const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const {
  getUsersCollection,
  getAssignmentsCollection,
  getAppealsCollection,
  getAppealDismissalsCollection,
  getTeacherResourcesCollection,
} = require("../models");
const { SUBMISSIONS_DIR, removeSubmissionFile } = require("../services/submissionStorage");
const { createZip } = require("../services/zipService");
const { CLASSES, CLASS_IDS, classLabel } = require("../config/classes");
const { MIME_TYPES } = require("../config/constants");
const { formatContentDisposition } = require("./paperController");
const { hasStudentAccess } = require("../middleware/roleGuard");
const { getNotificationPreferences } = require("../utils/userUtils");
const { sendAppealUpdateEmail } = require("../services/emailService");
const { getAssignmentReminderDueAt } = require("../services/deadlineReminderService");
const {
  emitAssignmentEvent,
  emitAppealEvent,
} = require("../services/socketService");
const { validateUploadedFileContent } = require("../utils/fileValidation");
const {
  validateRequiredTerm,
  parseTermFilter,
  termFilterCondition,
  countsFromGroups,
  termLabel,
  normalizeTerm,
} = require("../config/terms");

const NO_ID = { projection: { _id: 0 } };
const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const MAX_ZIP_BYTES = 300 * 1024 * 1024;

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cleanText(value, max) {
  return String(value || "").trim().slice(0, max);
}

// multipart forms send arrays as JSON strings
function parseList(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function safeName(value) {
  return String(value || "file").replace(/[\\/:*?"<>|\r\n]+/g, "_").trim().slice(0, 80) || "file";
}

function isVisibleToStudent(a, student) {
  return (
    a.audience === "all" || // assignments created by the first version
    (student.class && (a.classes || []).includes(student.class)) ||
    (a.studentIds || []).includes(student.id)
  );
}

// ---------------------------------------------------------------------------
// Teacher: decorate assignments with recipients, counts, etc.
// ---------------------------------------------------------------------------
async function describeAssignments(list) {
  if (list.length === 0) return [];
  const ids = list.map((a) => a.id);
  const [students, appeals] = await Promise.all([
    getUsersCollection()
      .find({ role: "student", status: { $ne: "disabled" } }, { projection: { _id: 0, id: 1, name: 1, username: 1, class: 1 } })
      .toArray(),
    getAppealsCollection().find({ assignmentId: { $in: ids } }, NO_ID).toArray(),
  ]);
  const nameOf = (id) => {
    const s = students.find((x) => x.id === id);
    return s ? s.name || s.username : "Unknown student";
  };

  return list.map((a) => {
    const recipients = students.filter(
      (s) => a.audience === "all" || (a.classes || []).includes(s.class) || (a.studentIds || []).includes(s.id)
    );
    const { attachment, ...rest } = a;
    delete rest.reminderDueAt;
    delete rest.reminderProcessedAt;
    return {
      ...rest,
      givenAt: a.givenAt || a.createdAt,
      classLabels: (a.classes || []).map(classLabel),
      students: (a.studentIds || []).map((id) => ({ id, name: nameOf(id) })),
      recipientCount: recipients.length,
      pendingAppeals: appeals.filter((p) => p.assignmentId === a.id && !p.read).length,
      isPastDeadline: new Date(a.deadline) < new Date(),
      hasAttachment: Boolean(attachment),
      attachmentName: attachment?.originalName || null,
    };
  });
}

// ---------------------------------------------------------------------------
// Student view helper
// ---------------------------------------------------------------------------
function buildStudentView(a, appeal, studentClass = "", appealDismissed = false) {
  const originalDeadline = new Date(a.deadline);
  const now = new Date();
  const approvedExtension = appeal && appeal.status === "approved" ? new Date(appeal.newDeadline) : null;
  const effectiveDeadline = approvedExtension || originalDeadline;
  const pastOriginal = now > originalDeadline;
  const pastEffective = now > effectiveDeadline;

  let status;
  if (!pastEffective) status = approvedExtension ? "extended" : "pending";
  else status = "overdue";

  return {
    id: a.id,
    title: a.title,
    description: a.description,
    subject: a.subject,
    term: normalizeTerm(a.term),
    teacherName: a.teacherName,
    classes: a.classes?.length ? a.classes : studentClass ? [studentClass] : [],
    classLabels: a.classes?.length
      ? a.classes.map(classLabel)
      : studentClass
        ? [classLabel(studentClass)]
        : [],
    givenAt: a.givenAt || a.createdAt,
    deadline: a.deadline,
    effectiveDeadline: effectiveDeadline.toISOString(),
    createdAt: a.createdAt,
    hasAttachment: Boolean(a.attachment),
    attachmentName: a.attachment?.originalName || null,
    status,
    canAppeal: pastOriginal && !appeal && !appealDismissed,
    appealDismissed: Boolean(appealDismissed),
    appeal: appeal
      ? {
          id: appeal.id,
          status: appeal.status,
          reason: appeal.reason,
          teacherHasRead: Boolean(appeal.read),
          readAt: appeal.readAt || null,
          teacherNote: appeal.teacherNote || "",
          newDeadline: appeal.newDeadline || null,
          createdAt: appeal.createdAt,
          resolvedAt: appeal.resolvedAt || null,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// List / get
// ---------------------------------------------------------------------------
async function listAssignments(req, res) {
  const assignments = getAssignmentsCollection();

  const termFilter = parseTermFilter(req.query.term);
  if (termFilter.invalid) {
    return res.status(400).json({ error: "Term filter must be 1, 2, 3 or unset.", field: "term" });
  }
  const termCondition = termFilterCondition(termFilter.filter);
  const withTerm = (base) => (termCondition ? { $and: [base, termCondition] } : base);
  const countTerms = async (base) =>
    countsFromGroups(
      await assignments.aggregate([{ $match: base }, { $group: { _id: "$term", count: { $sum: 1 } } }]).toArray()
    );

  if (req.user.role === "teacher") {
    const base = { teacherId: req.user.id };
    const [mine, termCounts] = await Promise.all([
      assignments.find(withTerm(base), NO_ID).sort({ createdAt: -1 }).toArray(),
      countTerms(base),
    ]);
    return res.json({ assignments: await describeAssignments(mine), termCounts });
  }

  const or = [{ audience: "all" }, { studentIds: req.user.id }];
  if (req.user.class) or.push({ classes: req.user.class });
  const visible = { $or: or };
  const [all, termCounts] = await Promise.all([
    assignments.find(withTerm(visible), NO_ID).sort({ deadline: 1 }).toArray(),
    countTerms(visible),
  ]);
  const ids = all.map((a) => a.id);
  const [myAppeals, myDismissals] = await Promise.all([
    getAppealsCollection().find({ assignmentId: { $in: ids }, studentId: req.user.id }, NO_ID).toArray(),
    getAppealDismissalsCollection().find({ assignmentId: { $in: ids }, studentId: req.user.id }, NO_ID).toArray(),
  ]);

  res.json({
    assignments: all.map((a) =>
      buildStudentView(
        a,
        myAppeals.find((p) => p.assignmentId === a.id),
        req.user.class,
        myDismissals.some((d) => d.assignmentId === a.id)
      )
    ),
    termCounts,
  });
}

async function getAssignment(req, res) {
  const assignment = await getAssignmentsCollection().findOne({ id: req.params.id }, NO_ID);
  if (!assignment) return res.status(404).json({ error: "Assignment not found" });

  if (req.user.role === "teacher") {
    if (assignment.teacherId !== req.user.id) {
      return res.status(403).json({ error: "This assignment belongs to another teacher" });
    }
    const [described] = await describeAssignments([assignment]);
    return res.json({ assignment: described });
  }

  if (!isVisibleToStudent(assignment, req.user)) return res.status(404).json({ error: "Assignment not found" });
  const [appeal, dismissal] = await Promise.all([
    getAppealsCollection().findOne({ assignmentId: assignment.id, studentId: req.user.id }, NO_ID),
    getAppealDismissalsCollection().findOne({ assignmentId: assignment.id, studentId: req.user.id }, NO_ID),
  ]);
  res.json({ assignment: buildStudentView(assignment, appeal, req.user.class, Boolean(dismissal)) });
}

// ---------------------------------------------------------------------------
// Teacher: create / update / delete
// ---------------------------------------------------------------------------
async function resolveRecipients(body) {
  const classes = parseList(body.classes).filter((c) => CLASS_IDS.includes(c));
  let studentIds = parseList(body.studentIds);
  if (studentIds.length) {
    const found = await getUsersCollection()
      .find({ id: { $in: studentIds }, role: "student" }, { projection: { id: 1 } })
      .toArray();
    studentIds = found.map((u) => u.id);
  }
  if (classes.length === 0 && studentIds.length === 0) {
    return { error: "Choose at least one class or student to give the assignment to" };
  }
  return { classes, studentIds };
}

function dropUpload(req) {
  if (req.file) removeSubmissionFile(req.file.filename);
}

async function createAssignment(req, res) {
  const title = cleanText(req.body.title, 150);
  const deadline = parseDate(req.body.deadline);
  const givenAt = parseDate(req.body.givenAt) || new Date();

  const fail = (msg) => {
    dropUpload(req);
    return res.status(400).json({ error: msg });
  };

  // The term comes first, before anything else is read or stored
  const termCheck = validateRequiredTerm(req.body.term);
  if (!termCheck.valid) {
    dropUpload(req);
    return res.status(400).json({ error: termCheck.error, field: termCheck.field });
  }

  if (!title) return fail("Title is required");
  if (!deadline) return fail("A valid deadline is required");
  if (deadline <= new Date()) return fail("Deadline must be in the future");
  if (deadline <= givenAt) return fail("Deadline must be after the time the assignment is given");

  const rec = await resolveRecipients(req.body);
  if (rec.error) return fail(rec.error);

  if (req.file) {
    const valRes = validateUploadedFileContent(req.file.path, req.file.originalname, req.file.mimetype);
    if (!valRes.valid) {
      return fail(valRes.error || "Invalid file content.");
    }
    const detectedExt = valRes.detectedExt;
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
  }

  const assignment = {
    id: newId(),
    title,
    description: cleanText(req.body.description, 5000),
    subject: cleanText(req.body.subject, 100),
    term: termCheck.value,
    givenAt: givenAt.toISOString(),
    deadline: deadline.toISOString(),
    reminderDueAt: getAssignmentReminderDueAt(givenAt, deadline),
    classes: rec.classes,
    studentIds: rec.studentIds,
    attachment: req.file ? { filename: req.file.filename, originalName: req.file.originalname } : null,
    teacherId: req.user.id,
    teacherEmail: req.user.email,
    teacherName: req.user.name || req.user.username,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await getAssignmentsCollection().insertOne({ ...assignment });
  const [described] = await describeAssignments([assignment]);
  await emitAssignmentEvent("created", described);
  res.status(201).json({ assignment: described });
}

async function loadOwnedAssignment(req, res) {
  const assignment = await getAssignmentsCollection().findOne({ id: req.params.id }, NO_ID);
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return null;
  }
  if (req.user.role !== "admin" && assignment.teacherId !== req.user.id) {
    res.status(403).json({ error: "This assignment belongs to another teacher" });
    return null;
  }
  return assignment;
}

async function updateAssignment(req, res) {
  const assignment = await loadOwnedAssignment(req, res);
  if (!assignment) return dropUpload(req);

  const fail = (msg) => {
    dropUpload(req);
    return res.status(400).json({ error: msg });
  };

  const update = { updatedAt: nowIso() };
  if (req.body.title !== undefined) {
    update.title = cleanText(req.body.title, 150);
    if (!update.title) return fail("Title is required");
  }
  if (req.body.description !== undefined) update.description = cleanText(req.body.description, 5000);
  if (req.body.subject !== undefined) update.subject = cleanText(req.body.subject, 100);
  if (req.body.term !== undefined) {
    const termCheck = validateRequiredTerm(req.body.term);
    if (!termCheck.valid) {
      dropUpload(req);
      return res.status(400).json({ error: termCheck.error, field: termCheck.field });
    }
    update.term = termCheck.value;
  }
  if (req.body.givenAt) {
    const g = parseDate(req.body.givenAt);
    if (!g) return fail("Invalid given time");
    update.givenAt = g.toISOString();
  }
  if (req.body.deadline !== undefined) {
    const d = parseDate(req.body.deadline);
    if (!d) return fail("A valid deadline is required");
    update.deadline = d.toISOString();
  }
  const givenFinal = new Date(update.givenAt || assignment.givenAt || assignment.createdAt);
  if (update.deadline && new Date(update.deadline) <= givenFinal) {
    return fail("Deadline must be after the time the assignment is given");
  }
  if (req.body.classes !== undefined || req.body.studentIds !== undefined) {
    const rec = await resolveRecipients(req.body);
    if (rec.error) return fail(rec.error);
    update.classes = rec.classes;
    update.studentIds = rec.studentIds;
    update.audience = "custom"; // no longer the legacy "all"
  }
  if (req.file) {
    removeSubmissionFile(assignment.attachment?.filename);
    update.attachment = { filename: req.file.filename, originalName: req.file.originalname };
  }

  // New times mean a new reminder time; a changed deadline lets students be reminded again
  const timesChanged = update.givenAt || update.deadline;
  const unset = {};
  if (timesChanged) {
    const finalDeadline = new Date(update.deadline || assignment.deadline);
    update.reminderDueAt = getAssignmentReminderDueAt(givenFinal, finalDeadline);
    if (assignment.reminderProcessedAt) unset.reminderProcessedAt = "";
  }

  await getAssignmentsCollection().updateOne(
    { id: assignment.id },
    Object.keys(unset).length ? { $set: update, $unset: unset } : { $set: update }
  );
  const [described] = await describeAssignments([{ ...assignment, ...update }]);
  emitAssignmentEvent("updated", described);
  res.json({ assignment: described });
}

async function deleteAssignment(req, res) {
  const assignment = await loadOwnedAssignment(req, res);
  if (!assignment) return;

  removeSubmissionFile(assignment.attachment?.filename);

  await Promise.all([
    getAppealsCollection().deleteMany({ assignmentId: assignment.id }),
    getAssignmentsCollection().deleteOne({ id: assignment.id }),
  ]);
  emitAssignmentEvent("deleted", { id: assignment.id, teacherId: assignment.teacherId, classes: assignment.classes });
  res.json({ message: "Assignment deleted" });
}

// teacher's own file, downloaded by the teacher or a student it was given to
async function downloadAttachment(req, res) {
  const a = await getAssignmentsCollection().findOne({ id: req.params.id }, NO_ID);
  if (!a || !a.attachment) return res.status(404).json({ error: "No file attached" });

  const allowed =
    (req.user.role === "teacher" && a.teacherId === req.user.id) ||
    (hasStudentAccess(req.user) && isVisibleToStudent(a, req.user));
  if (!allowed) return res.status(404).json({ error: "No file attached" });

  const safeBase = path.basename(a.attachment.filename);
  const full = path.resolve(SUBMISSIONS_DIR, safeBase);
  if (!full.startsWith(path.resolve(SUBMISSIONS_DIR) + path.sep) || !fs.existsSync(full)) {
    return res.status(404).json({ error: "This file is no longer available." });
  }

  const originalName = a.attachment.originalName || safeBase;
  const ext = path.extname(originalName).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; sandbox; frame-ancestors 'self' https://*.vercel.app https://archive.innov.rw"
  );
  res.setHeader("Content-Type", contentType);

  const SAFE_INLINE = [".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".txt"];
  const isInline = (req.query.inline === "1" || req.path.endsWith("/view")) && SAFE_INLINE.includes(ext);
  res.setHeader(
    "Content-Disposition",
    formatContentDisposition(isInline ? "inline" : "attachment", originalName)
  );
  return res.sendFile(full);
}

async function viewAttachment(req, res) {
  req.query.inline = "1";
  return downloadAttachment(req, res);
}

// ---------------------------------------------------------------------------
// Appeals
// ---------------------------------------------------------------------------
// Student says "I did the work, I do not need to appeal": hides the overdue notice for this assignment only
async function dismissAppeal(req, res) {
  const assignment = await getAssignmentsCollection().findOne({ id: req.params.id }, NO_ID);
  if (!assignment || !isVisibleToStudent(assignment, req.user)) {
    return res.status(404).json({ error: "Assignment not found" });
  }
  if (new Date() <= new Date(assignment.deadline)) {
    return res.status(400).json({ error: "The deadline has not passed yet" });
  }
  if (await getAppealsCollection().findOne({ assignmentId: assignment.id, studentId: req.user.id })) {
    return res.status(409).json({ error: "You already sent an appeal for this assignment" });
  }

  await getAppealDismissalsCollection().updateOne(
    { assignmentId: assignment.id, studentId: req.user.id },
    { $setOnInsert: { id: newId(), assignmentId: assignment.id, studentId: req.user.id, createdAt: nowIso() } },
    { upsert: true }
  );
  res.json({ success: true, assignmentId: assignment.id });
}

async function createAppeal(req, res) {
  const assignment = await getAssignmentsCollection().findOne({ id: req.params.id }, NO_ID);
  if (!assignment || !isVisibleToStudent(assignment, req.user)) {
    return res.status(404).json({ error: "Assignment not found" });
  }
  if (new Date() <= new Date(assignment.deadline)) {
    return res.status(400).json({ error: "You can only appeal after the deadline has passed" });
  }

  const appeals = getAppealsCollection();
  const existing = await appeals.findOne({ assignmentId: assignment.id, studentId: req.user.id });
  if (existing) {
    return res.status(409).json({ error: `You already sent an appeal for this assignment (${existing.status})` });
  }

  const reason = cleanText(req.body.reason, 2000);
  const words = reason.trim().split(/\s+/).filter(Boolean);
  if (words.length < 50 || words.length > 100) {
    return res.status(400).json({
      error: `Your appeal reason must be between 50 and 100 words. Current count: ${words.length} word(s).`,
      wordCount: words.length,
    });
  }

  const appeal = {
    id: newId(),
    assignmentId: assignment.id,
    assignmentTitle: assignment.title,
    assignmentSubject: assignment.subject,
    originalDeadline: assignment.deadline,
    teacherId: assignment.teacherId,
    studentId: req.user.id,
    studentEmail: req.user.email,
    studentName: req.user.name || req.user.username,
    studentClass: req.user.class || "",
    reason,
    status: "pending",
    read: false,
    readAt: null,
    teacherNote: "",
    newDeadline: null,
    createdAt: nowIso(),
    resolvedAt: null,
  };
  await appeals.insertOne({ ...appeal });
  emitAppealEvent("created", appeal, assignment.teacherId, req.user.id);
  res.status(201).json({ appeal });
}

const withClassLabel = (p) => ({ ...p, read: Boolean(p.read), classLabel: p.studentClass ? classLabel(p.studentClass) : "No class" });

async function listAppeals(req, res) {
  const filter = req.user.role === "teacher" ? { teacherId: req.user.id } : { studentId: req.user.id };
  if (["pending", "approved", "rejected"].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.unread === "1") filter.read = { $ne: true };

  const appeals = await getAppealsCollection().find(filter, NO_ID).sort({ createdAt: -1 }).toArray();
  res.json({ appeals: appeals.map(withClassLabel) });
}

async function loadOwnAppeal(req, res) {
  const appeal = await getAppealsCollection().findOne({ id: req.params.id }, NO_ID);
  if (!appeal) {
    res.status(404).json({ error: "Appeal not found" });
    return null;
  }
  if (appeal.teacherId !== req.user.id) {
    res.status(403).json({ error: "This appeal is not addressed to you" });
    return null;
  }
  return appeal;
}

async function markAppealRead(req, res) {
  const appeal = await loadOwnAppeal(req, res);
  if (!appeal) return;
  const update = { read: true, readAt: appeal.readAt || nowIso() };
  await getAppealsCollection().updateOne({ id: appeal.id }, { $set: update });
  res.json({ appeal: withClassLabel({ ...appeal, ...update }) });
}

async function resolveAppeal(req, res, decision) {
  const appeal = await loadOwnAppeal(req, res);
  if (!appeal) return;
  if (appeal.status !== "pending") return res.status(409).json({ error: `Appeal already ${appeal.status}` });

  const update = {
    status: decision,
    teacherNote: cleanText(req.body.note, 1000),
    resolvedAt: nowIso(),
    read: true,
    readAt: appeal.readAt || nowIso(),
  };

  if (decision === "approved") {
    const d = parseDate(req.body.newDeadline);
    if (!d || d <= new Date()) return res.status(400).json({ error: "Choose a new deadline in the future" });
    update.newDeadline = d.toISOString();
  }

  await getAppealsCollection().updateOne({ id: appeal.id }, { $set: update });
  const resolved = withClassLabel({ ...appeal, ...update });
  emitAppealEvent("resolved", resolved, appeal.teacherId, appeal.studentId);
  try {
    const student = await getUsersCollection().findOne(
      { id: appeal.studentId },
      { projection: { _id: 0, email: 1, name: 1, username: 1, notifications: 1 } }
    );
    if (student?.email && getNotificationPreferences(student).emailNotifications) {
      const assignment = await getAssignmentsCollection().findOne({ id: appeal.assignmentId }, { projection: { term: 1 } });
      const titleWithTerm = assignment?.term ? `${appeal.assignmentTitle} (${termLabel(assignment.term)})` : appeal.assignmentTitle;
      await sendAppealUpdateEmail(
        student.email,
        student.name || student.username,
        titleWithTerm,
        decision,
        update.teacherNote,
        update.newDeadline
      );
    }
  } catch (err) {
    console.error("Appeal was resolved, but notification email failed:", err.message);
  }
  res.json({ appeal: resolved });
}

const approveAppeal = (req, res) => resolveAppeal(req, res, "approved");
const rejectAppeal = (req, res) => resolveAppeal(req, res, "rejected");

// ---------------------------------------------------------------------------
// Teacher dashboard
// ---------------------------------------------------------------------------
async function teacherStats(req, res) {
  const assignments = await getAssignmentsCollection().find({ teacherId: req.user.id }, NO_ID).toArray();
  const ids = assignments.map((a) => a.id);
  const now = new Date();

  const [totalResources, appeals] = await Promise.all([
    getTeacherResourcesCollection().countDocuments({ teacherId: req.user.id }),
    getAppealsCollection().find({ teacherId: req.user.id }, NO_ID).toArray(),
  ]);

  const upcomingRaw = assignments
    .filter((a) => new Date(a.deadline) > now)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 6);

  res.json({
    totalAssignments: assignments.length,
    totalResources,
    appealsReceived: appeals.length,
    readAppeals: appeals.filter((p) => p.read).length,
    unreadAppeals: appeals.filter((p) => !p.read).length,
    upcoming: await describeAssignments(upcomingRaw),
  });
}

async function listStudentsForTeacher(_req, res) {
  const students = await getUsersCollection()
    .find({ role: "student", status: { $ne: "disabled" } }, { projection: { _id: 0, id: 1, name: 1, username: 1, email: 1, class: 1 } })
    .sort({ username: 1 })
    .toArray();
  res.json({
    classes: CLASSES,
    students: students.map((s) => ({
      id: s.id,
      name: s.name || s.username || s.email,
      email: s.email,
      class: s.class || "",
      classLabel: s.class ? classLabel(s.class) : "No class",
    })),
  });
}

// Owner teacher or any admin can change the term of an assignment
async function updateAssignmentTerm(req, res) {
  const termCheck = validateRequiredTerm(req.body && req.body.term);
  if (!termCheck.valid) {
    return res.status(400).json({ error: termCheck.error, field: termCheck.field });
  }

  const collection = getAssignmentsCollection();
  const assignment = await collection.findOne({ id: req.params.id }, NO_ID);
  if (!assignment) return res.status(404).json({ error: "Assignment not found." });

  const isOwner = assignment.teacherId === req.user.id;
  if (req.user.role !== "admin" && !(req.user.role === "teacher" && isOwner)) {
    return res.status(403).json({ error: "Only the owning teacher or an admin can change the term of this assignment." });
  }

  await collection.updateOne(
    { id: assignment.id },
    { $set: { term: termCheck.value, updatedAt: nowIso() } }
  );

  const [described] = await describeAssignments([{ ...assignment, term: termCheck.value }]);
  emitAssignmentEvent("updated", described);
  res.json({ message: `Moved to ${termLabel(termCheck.value)}`, assignment: described });
}

module.exports = {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  updateAssignmentTerm,
  deleteAssignment,
  downloadAttachment,
  viewAttachment,
  createAppeal,
  dismissAppeal,
  listAppeals,
  markAppealRead,
  approveAppeal,
  rejectAppeal,
  teacherStats,
  listStudentsForTeacher,
};
