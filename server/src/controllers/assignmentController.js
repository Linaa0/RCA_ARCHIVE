const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const {
  getUsersCollection,
  getAssignmentsCollection,
  getSubmissionsCollection,
  getAppealsCollection,
  getTeacherResourcesCollection,
} = require("../models");
const { SUBMISSIONS_DIR, removeSubmissionFile } = require("../services/submissionStorage");
const { createZip } = require("../services/zipService");
const { CLASSES, CLASS_IDS, classLabel } = require("../config/classes");

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
  const [students, subs, appeals] = await Promise.all([
    getUsersCollection()
      .find({ role: "student", status: { $ne: "disabled" } }, { projection: { _id: 0, id: 1, name: 1, username: 1, class: 1 } })
      .toArray(),
    getSubmissionsCollection().find({ assignmentId: { $in: ids } }, NO_ID).toArray(),
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
    return {
      ...rest,
      givenAt: a.givenAt || a.createdAt,
      classLabels: (a.classes || []).map(classLabel),
      students: (a.studentIds || []).map((id) => ({ id, name: nameOf(id) })),
      recipientCount: recipients.length,
      submissionCount: subs.filter((s) => s.assignmentId === a.id).length,
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
function buildStudentView(a, submission, appeal) {
  const originalDeadline = new Date(a.deadline);
  const now = new Date();
  const approvedExtension = appeal && appeal.status === "approved" ? new Date(appeal.newDeadline) : null;
  const effectiveDeadline = approvedExtension || originalDeadline;
  const pastOriginal = now > originalDeadline;
  const pastEffective = now > effectiveDeadline;

  let status;
  if (submission) status = "submitted";
  else if (!pastEffective) status = approvedExtension ? "extended" : "pending";
  else status = "overdue";

  return {
    id: a.id,
    title: a.title,
    description: a.description,
    subject: a.subject,
    teacherName: a.teacherName,
    givenAt: a.givenAt || a.createdAt,
    deadline: a.deadline,
    effectiveDeadline: effectiveDeadline.toISOString(),
    createdAt: a.createdAt,
    hasAttachment: Boolean(a.attachment),
    attachmentName: a.attachment?.originalName || null,
    status,
    canSubmit: !submission && !pastEffective,
    canAppeal: !submission && pastOriginal && !appeal,
    submission: submission
      ? {
          id: submission.id,
          text: submission.text,
          fileName: submission.file?.originalName || null,
          submittedAt: submission.submittedAt,
          late: submission.late,
        }
      : null,
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

  if (req.user.role === "teacher") {
    const mine = await assignments.find({ teacherId: req.user.id }, NO_ID).sort({ createdAt: -1 }).toArray();
    return res.json({ assignments: await describeAssignments(mine) });
  }

  const or = [{ audience: "all" }, { studentIds: req.user.id }];
  if (req.user.class) or.push({ classes: req.user.class });
  const all = await assignments.find({ $or: or }, NO_ID).sort({ deadline: 1 }).toArray();
  const ids = all.map((a) => a.id);
  const [mySubs, myAppeals] = await Promise.all([
    getSubmissionsCollection().find({ assignmentId: { $in: ids }, studentId: req.user.id }, NO_ID).toArray(),
    getAppealsCollection().find({ assignmentId: { $in: ids }, studentId: req.user.id }, NO_ID).toArray(),
  ]);

  res.json({
    assignments: all.map((a) =>
      buildStudentView(a, mySubs.find((s) => s.assignmentId === a.id), myAppeals.find((p) => p.assignmentId === a.id))
    ),
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
  const [sub, appeal] = await Promise.all([
    getSubmissionsCollection().findOne({ assignmentId: assignment.id, studentId: req.user.id }, NO_ID),
    getAppealsCollection().findOne({ assignmentId: assignment.id, studentId: req.user.id }, NO_ID),
  ]);
  res.json({ assignment: buildStudentView(assignment, sub, appeal) });
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

  if (!title) return fail("Title is required");
  if (!deadline) return fail("A valid deadline is required");
  if (deadline <= new Date()) return fail("Deadline must be in the future");
  if (deadline <= givenAt) return fail("Deadline must be after the time the assignment is given");

  const rec = await resolveRecipients(req.body);
  if (rec.error) return fail(rec.error);

  const assignment = {
    id: newId(),
    title,
    description: cleanText(req.body.description, 5000),
    subject: cleanText(req.body.subject, 100),
    givenAt: givenAt.toISOString(),
    deadline: deadline.toISOString(),
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
  res.status(201).json({ assignment: described });
}

async function loadOwnedAssignment(req, res) {
  const assignment = await getAssignmentsCollection().findOne({ id: req.params.id }, NO_ID);
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return null;
  }
  if (assignment.teacherId !== req.user.id) {
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

  await getAssignmentsCollection().updateOne({ id: assignment.id }, { $set: update });
  const [described] = await describeAssignments([{ ...assignment, ...update }]);
  res.json({ assignment: described });
}

async function deleteAssignment(req, res) {
  const assignment = await loadOwnedAssignment(req, res);
  if (!assignment) return;

  const subs = await getSubmissionsCollection().find({ assignmentId: assignment.id }, NO_ID).toArray();
  subs.forEach((s) => removeSubmissionFile(s.file?.filename));
  removeSubmissionFile(assignment.attachment?.filename);

  await Promise.all([
    getSubmissionsCollection().deleteMany({ assignmentId: assignment.id }),
    getAppealsCollection().deleteMany({ assignmentId: assignment.id }),
    getAssignmentsCollection().deleteOne({ id: assignment.id }),
  ]);
  res.json({ message: "Assignment deleted" });
}

// teacher's own file, downloaded by the teacher or a student it was given to
async function downloadAttachment(req, res) {
  const a = await getAssignmentsCollection().findOne({ id: req.params.id }, NO_ID);
  if (!a || !a.attachment) return res.status(404).json({ error: "No file attached" });

  const allowed =
    (req.user.role === "teacher" && a.teacherId === req.user.id) ||
    (req.user.role === "student" && isVisibleToStudent(a, req.user));
  if (!allowed) return res.status(404).json({ error: "No file attached" });

  const full = path.join(SUBMISSIONS_DIR, path.basename(a.attachment.filename));
  if (!fs.existsSync(full)) return res.status(404).json({ error: "File missing on server" });
  res.download(full, a.attachment.originalName);
}

// ---------------------------------------------------------------------------
// Student: submit
// ---------------------------------------------------------------------------
async function submitAssignment(req, res) {
  const cleanup = () => req.file && removeSubmissionFile(req.file.filename);

  const assignment = await getAssignmentsCollection().findOne({ id: req.params.id }, NO_ID);
  if (!assignment || !isVisibleToStudent(assignment, req.user)) {
    cleanup();
    return res.status(404).json({ error: "Assignment not found" });
  }

  const submissions = getSubmissionsCollection();
  if (await submissions.findOne({ assignmentId: assignment.id, studentId: req.user.id })) {
    cleanup();
    return res.status(409).json({ error: "You have already submitted this assignment" });
  }

  const appeal = await getAppealsCollection().findOne({
    assignmentId: assignment.id,
    studentId: req.user.id,
    status: "approved",
  });
  const originalDeadline = new Date(assignment.deadline);
  const effectiveDeadline = appeal ? new Date(appeal.newDeadline) : originalDeadline;

  if (new Date() > effectiveDeadline) {
    cleanup();
    // 400 (not 403): the client logs users out on 403 responses
    return res.status(400).json({
      error: "The deadline has passed. You can send an appeal to your teacher to request more time.",
    });
  }

  const text = cleanText(req.body.text, 10000);
  if (!text && !req.file) return res.status(400).json({ error: "Write an answer or attach a file" });

  const submission = {
    id: newId(),
    assignmentId: assignment.id,
    studentId: req.user.id,
    studentEmail: req.user.email,
    studentName: req.user.name || req.user.username,
    studentClass: req.user.class || "",
    text,
    file: req.file ? { filename: req.file.filename, originalName: req.file.originalname } : null,
    submittedAt: nowIso(),
    late: new Date() > originalDeadline,
  };
  await submissions.insertOne({ ...submission });
  res.status(201).json({ message: "Assignment submitted", submittedAt: submission.submittedAt });
}

// Teacher (owner) or the student who wrote it. ?inline=1 shows it in the browser.
async function downloadSubmissionFile(req, res) {
  const submission = await getSubmissionsCollection().findOne({ id: req.params.submissionId });
  if (!submission || !submission.file) return res.status(404).json({ error: "File not found" });

  const assignment = await getAssignmentsCollection().findOne({ id: submission.assignmentId }, NO_ID);
  if (!assignment) return res.status(404).json({ error: "Assignment not found" });

  const isOwnerTeacher = req.user.role === "teacher" && assignment.teacherId === req.user.id;
  const isAuthor = req.user.role === "student" && submission.studentId === req.user.id;
  if (!isOwnerTeacher && !isAuthor) return res.status(403).json({ error: "Not allowed" });

  const full = path.join(SUBMISSIONS_DIR, path.basename(submission.file.filename));
  if (!fs.existsSync(full)) return res.status(404).json({ error: "File missing on server" });

  if (req.query.inline === "1") {
    res.type(path.extname(submission.file.filename));
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(submission.file.originalName)}`
    );
    return res.sendFile(full);
  }
  res.download(full, submission.file.originalName);
}

// ---------------------------------------------------------------------------
// Teacher: submissions grouped by class
// ---------------------------------------------------------------------------
async function loadTeacherSubmissions(teacherId) {
  const assignments = await getAssignmentsCollection().find({ teacherId }, NO_ID).toArray();
  const ids = assignments.map((a) => a.id);
  const subs = await getSubmissionsCollection().find({ assignmentId: { $in: ids } }, NO_ID).sort({ submittedAt: -1 }).toArray();
  return { assignments, subs };
}

async function submissionClasses(req, res) {
  const { assignments, subs } = await loadTeacherSubmissions(req.user.id);

  const keys = new Set();
  assignments.forEach((a) => (a.classes || []).forEach((c) => keys.add(c)));
  subs.forEach((s) => keys.add(s.studentClass || "none"));

  const ordered = [...CLASS_IDS.filter((c) => keys.has(c)), ...(keys.has("none") ? ["none"] : [])];
  res.json({
    classes: ordered.map((key) => ({
      key,
      label: key === "none" ? "No class" : classLabel(key),
      submissionCount: subs.filter((s) => (s.studentClass || "none") === key).length,
      assignmentCount: assignments.filter((a) => (a.classes || []).includes(key)).length,
    })),
  });
}

function rowFor(s, titleOf) {
  return {
    id: s.id,
    assignmentId: s.assignmentId,
    assignmentTitle: titleOf(s.assignmentId),
    studentName: s.studentName,
    studentEmail: s.studentEmail,
    studentClass: s.studentClass || "",
    classLabel: s.studentClass ? classLabel(s.studentClass) : "No class",
    text: s.text,
    hasFile: Boolean(s.file),
    fileName: s.file?.originalName || null,
    submittedAt: s.submittedAt,
    late: s.late,
  };
}

async function listSubmissions(req, res) {
  const key = String(req.query.class || "");
  const { assignments, subs } = await loadTeacherSubmissions(req.user.id);
  const titleOf = (id) => assignments.find((a) => a.id === id)?.title || "Deleted assignment";

  const filtered = subs.filter((s) => (s.studentClass || "none") === key);
  res.json({ label: key === "none" ? "No class" : classLabel(key), submissions: filtered.map((s) => rowFor(s, titleOf)) });
}

async function downloadAllSubmissions(req, res) {
  const key = String(req.query.class || "");
  const { assignments, subs } = await loadTeacherSubmissions(req.user.id);
  const titleOf = (id) => assignments.find((a) => a.id === id)?.title || "Assignment";
  const filtered = subs.filter((s) => (s.studentClass || "none") === key);
  if (filtered.length === 0) return res.status(404).json({ error: "No submissions to download" });

  const entries = [];
  const used = new Set();
  let total = 0;
  const uniqueName = (base, ext) => {
    let name = `${base}${ext}`;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${base} (${n++})${ext}`;
    used.add(name.toLowerCase());
    return name;
  };

  for (const s of filtered) {
    const base = `${safeName(s.studentName)} - ${safeName(titleOf(s.assignmentId))}`;
    if (s.file) {
      const full = path.join(SUBMISSIONS_DIR, path.basename(s.file.filename));
      if (fs.existsSync(full)) {
        const data = fs.readFileSync(full);
        total += data.length;
        if (total > MAX_ZIP_BYTES) return res.status(413).json({ error: "Too many files for one download. Download them one by one." });
        entries.push({ name: uniqueName(base, path.extname(s.file.filename)), data });
      }
    }
    if (s.text) entries.push({ name: uniqueName(`${base} (written answer)`, ".txt"), data: Buffer.from(s.text, "utf8") });
  }

  const label = key === "none" ? "No class" : classLabel(key);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`${label} submissions.zip`)}`);
  res.send(createZip(entries));
}

// ---------------------------------------------------------------------------
// Appeals
// ---------------------------------------------------------------------------
async function createAppeal(req, res) {
  const assignment = await getAssignmentsCollection().findOne({ id: req.params.id }, NO_ID);
  if (!assignment || !isVisibleToStudent(assignment, req.user)) {
    return res.status(404).json({ error: "Assignment not found" });
  }
  if (new Date() <= new Date(assignment.deadline)) {
    return res.status(400).json({ error: "You can only appeal after the deadline has passed" });
  }
  if (await getSubmissionsCollection().findOne({ assignmentId: assignment.id, studentId: req.user.id })) {
    return res.status(400).json({ error: "You already submitted this assignment" });
  }

  const appeals = getAppealsCollection();
  const existing = await appeals.findOne({ assignmentId: assignment.id, studentId: req.user.id });
  if (existing) {
    return res.status(409).json({ error: `You already sent an appeal for this assignment (${existing.status})` });
  }

  const reason = cleanText(req.body.reason, 2000);
  if (reason.length < 10) return res.status(400).json({ error: "Please explain your reason (at least 10 characters)" });

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
  res.json({ appeal: withClassLabel({ ...appeal, ...update }) });
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

  const [totalSubmissions, totalResources, appeals] = await Promise.all([
    getSubmissionsCollection().countDocuments({ assignmentId: { $in: ids } }),
    getTeacherResourcesCollection().countDocuments({ teacherId: req.user.id }),
    getAppealsCollection().find({ teacherId: req.user.id }, NO_ID).toArray(),
  ]);

  const upcomingRaw = assignments
    .filter((a) => new Date(a.deadline) > now)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 6);

  res.json({
    totalAssignments: assignments.length,
    totalSubmissions,
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

module.exports = {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  downloadAttachment,
  submitAssignment,
  downloadSubmissionFile,
  submissionClasses,
  listSubmissions,
  downloadAllSubmissions,
  createAppeal,
  listAppeals,
  markAppealRead,
  approveAppeal,
  rejectAppeal,
  teacherStats,
  listStudentsForTeacher,
};
