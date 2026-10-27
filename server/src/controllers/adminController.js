const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { ObjectId } = require("mongodb");
const {
  getUsersCollection,
  getPapersCollection,
  getDeletionRequestsCollection,
  getPasswordResetCollection,
  getAssignmentsCollection,
  getSubmissionsCollection,
  getAppealsCollection,
  getNotificationsCollection,
  getFailedLoginAttemptsCollection,
} = require("../models");
const { findUserByEmail } = require("../middleware/authMiddleware");
const { isValidEmail } = require("../middleware/validation");
const {
  normalizeEmail,
  getNotificationPreferences,
  safeUserFields,
  getDisplayName,
} = require("../utils/userUtils");
const { getFrontendBaseUrl } = require("../utils/urlUtils");
const { normalizeClass, getAcademicYear } = require("../config/classes");
const {
  sendTeacherInviteEmail,
  sendAccountInviteEmail,
  sendDeletionRequestDecisionEmail,
  upsertTeacherInvite,
  cleanExpiredPasswordResets,
  getEmailHealth,
  sendTestEmail,
} = require("../services/emailService");
const {
  permanentlyDeletePaperRecord,
} = require("../services/storageService");
const { getPaperById } = require("../services/ratingService");
const { logAdminAction } = require("../services/auditService");
const { validateFullName, validateEmail: validateEmailStrict } = require("../utils/validation");
const { emitUserEvent, emitStatsEvent, emitPaperEvent } = require("../services/socketService");
const {
  validateRequiredTerm,
  termLabel,
  parseTermFilter,
  termFilterCondition,
  countsFromGroups,
} = require("../config/terms");

function generateTemporaryPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;

  const pwd = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    special[crypto.randomInt(0, special.length)],
  ];
  for (let i = 4; i < 14; i++) {
    pwd.push(all[crypto.randomInt(0, all.length)]);
  }
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  return pwd.join("");
}

function toUserQuery(id) {
  if (!id) return null;
  const idStr = String(id).trim();
  const conditions = [{ id: idStr }];
  if (ObjectId.isValid(idStr)) {
    try {
      conditions.push({ _id: new ObjectId(idStr) });
    } catch (_) {}
  }
  conditions.push({ _id: idStr });
  return { $or: conditions };
}

async function findUserById(id) {
  const query = toUserQuery(id);
  if (!query) return null;
  const users = getUsersCollection();
  return users.findOne(query);
}

async function getStats(req, res) {
  try {
    const users = getUsersCollection();
    const papers = getPapersCollection();
    const deletionRequests = getDeletionRequestsCollection();
    const assignments = getAssignmentsCollection();
    const submissions = getSubmissionsCollection();
    const appeals = getAppealsCollection();

    const [
      totalUsers,
      adminCount,
      totalStudents,
      totalTeachers,
      totalPapers,
      pendingDeletionRequests,
      totalAssignments,
      totalSubmissions,
      openAppeals,
      allPapers,
      papersByTypeAgg,
      papersByYearTermAgg,
    ] = await Promise.all([
      users.countDocuments(),
      users.countDocuments({ role: "admin" }),
      users.countDocuments({ role: "student" }),
      users.countDocuments({ role: "teacher" }),
      papers.countDocuments(),
      deletionRequests.countDocuments({ status: "Pending" }),
      assignments.countDocuments(),
      submissions.countDocuments(),
      appeals.countDocuments({ status: "Pending" }),
      papers.find({}, { projection: { year: 1, classId: 1, category: 1, type: 1 } }).toArray(),
      papers.aggregate([
        { $group: { _id: { $ifNull: ["$type", "$category"] }, count: { $sum: 1 } } },
      ]).toArray(),
      papers.aggregate([
        {
          $group: {
            _id: {
              rawYear: { $ifNull: ["$year", "$classId"] },
              term: "$term",
            },
            count: { $sum: 1 },
          },
        },
      ]).toArray(),
    ]);

    let y1Count = 0;
    let y2Count = 0;
    let y3Count = 0;

    for (const p of allPapers) {
      const yr = String(p.year || p.classId || "").trim().toLowerCase();
      if (yr.includes("1") || yr.includes("y1") || yr.includes("genai")) {
        y1Count += 1;
      } else if (yr.includes("2") || yr.includes("y2")) {
        y2Count += 1;
      } else if (yr.includes("3") || yr.includes("y3")) {
        y3Count += 1;
      }
    }

    const papersByType = {};
    for (const item of papersByTypeAgg) {
      if (item._id) {
        papersByType[item._id] = item.count;
      }
    }

    const papersByTerm = { 1: 0, 2: 0, 3: 0, unset: 0 };
    const papersByYearTerm = {
      Y1: { 1: 0, 2: 0, 3: 0, unset: 0 },
      Y2: { 1: 0, 2: 0, 3: 0, unset: 0 },
      Y3: { 1: 0, 2: 0, 3: 0, unset: 0 },
    };

    for (const group of papersByYearTermAgg) {
      const count = group.count || 0;
      const termKey = [1, 2, 3].includes(group._id?.term) ? group._id.term : "unset";
      papersByTerm[termKey] = (papersByTerm[termKey] || 0) + count;

      const yNum = getAcademicYear(group._id?.rawYear);
      const rowKey = yNum === 1 ? "Y1" : yNum === 2 ? "Y2" : yNum === 3 ? "Y3" : null;
      if (rowKey) {
        papersByYearTerm[rowKey][termKey] = (papersByYearTerm[rowKey][termKey] || 0) + count;
      }
    }

    res.json({
      totalUsers,
      usersByRole: {
        admin: adminCount,
        teacher: totalTeachers,
        student: totalStudents,
        total: totalUsers,
      },
      totalStudents,
      totalTeachers,
      totalPapers,
      papersByYear: {
        Y1: y1Count,
        Y2: y2Count,
        Y3: y3Count,
        total: totalPapers,
      },
      papersByType,
      papersByTerm,
      papersByYearTerm,
      pendingDeletionRequests,
      totalAssignments,
      totalSubmissions,
      openAppeals,
    });
  } catch (error) {
    console.error("Failed to compute admin stats:", error);
    res.status(500).json({ error: "Failed to load platform statistics." });
  }
}

async function listTeachers(req, res) {
  const users = getUsersCollection();
  const teachers = await users
    .find({ role: "teacher" }, { projection: { password: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  res.json({ teachers: teachers.map(safeUserFields) });
}

async function createTeacher(req, res) {
  const { email, name, username } = req.body || {};
  const teacherName = (name || username || "").trim();

  const vName = validateFullName(teacherName);
  if (!vName.valid) {
    return res.status(400).json({ error: vName.message, field: "name" });
  }

  const vEmail = validateEmailStrict(email);
  if (!vEmail.valid) {
    return res.status(400).json({ error: vEmail.message, field: "email" });
  }

  const normalizedEmail = vEmail.value;
  const users = getUsersCollection();
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "A user with this email already exists" });
  }

  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
  const now = new Date().toISOString();
  const teacherUsername = (normalizedEmail.split("@")[0] || "teacher").toLowerCase();

  const teacher = {
    id: Date.now().toString(),
    email: normalizedEmail,
    name: vName.value,
    username: teacherUsername,
    password: hashedPassword,
    role: "teacher",
    status: "active",
    mustChangePassword: true,
    tempPasswordExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    invitedNotSignedIn: true,
    inviteEmailStatus: "pending",
    createdAt: now,
    updatedAt: now,
    createdBy: req.user.email,
  };
  await users.insertOne(teacher);

  await logAdminAction({
    actorId: req.user.id,
    actorEmail: req.user.email,
    actorRole: req.user.role,
    action: "user_create",
    targetId: teacher.id,
    targetType: "user",
    details: { email: teacher.email, role: "teacher", name: teacher.name },
    ip: req.ip,
  });

  let inviteEmailStatus = "sent";
  let previewUrl = null;
  try {
    const sendResult = await sendTeacherInviteEmail(
      normalizedEmail,
      vName.value,
      null,
      getFrontendBaseUrl(req),
      temporaryPassword
    );
    previewUrl = sendResult?.previewUrl || null;
    await users.updateOne({ id: teacher.id }, { $set: { inviteEmailStatus: "sent" } });
  } catch (err) {
    console.error("Teacher invite email failed:", err.message);
    inviteEmailStatus = "failed";
    await users.updateOne({ id: teacher.id }, { $set: { inviteEmailStatus: "failed" } });
  }

  return res.status(201).json({
    message:
      inviteEmailStatus === "sent"
        ? "Teacher invited successfully."
        : "Teacher created, but invitation email could not be delivered.",
    inviteEmailStatus,
    teacher: safeUserFields(teacher),
    credentials: {
      email: teacher.email,
      temporaryPassword,
      role: "teacher",
    },
    previewUrl,
  });
}

async function createTeacherDirect(req, res) {
  try {
    const { name, email, password } = req.body || {};
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    const rawPassword = typeof password === "string" ? password : "";

    if (!normalizedName || !normalizedEmail || !rawPassword) {
      return res.status(400).json({
        message:
          "Name, email, and password are required to create a teacher account.",
      });
    }

    if (rawPassword.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long.",
      });
    }

    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "A user with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const now = new Date().toISOString();
    const teacherId = Date.now().toString();
    const teacherRecord = {
      id: teacherId,
      name: normalizedName,
      username: normalizedName,
      email: normalizedEmail,
      password: passwordHash,
      role: "teacher",
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: req.user.email,
    };

    await getUsersCollection().insertOne(teacherRecord);

    res.status(201).json({
      message: "Teacher account created successfully.",
      teacher: safeUserFields(teacherRecord),
    });
  } catch (error) {
    console.error("Failed to create teacher directly:", error);
    res.status(500).json({ message: "Failed to create teacher account." });
  }
}

async function resendTeacherInvite(req, res) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required" });
  const normalizedEmail = normalizeEmail(email);
  const users = getUsersCollection();
  const user = await findUserByEmail(email);
  if (!user || user.role !== "teacher") {
    return res.status(404).json({ error: "Teacher not found" });
  }

  const newTempPassword = generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(newTempPassword, 10);
  const now = new Date().toISOString();

  await users.updateOne(
    { id: user.id },
    {
      $set: {
        password: hashedPassword,
        mustChangePassword: true,
        tempPasswordExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        invitedNotSignedIn: true,
        updatedAt: now,
      },
    }
  );

  let inviteEmailStatus = "sent";
  let previewUrl = null;
  if (!getNotificationPreferences(user).emailNotifications) {
    inviteEmailStatus = "disabled";
  } else {
    try {
      const sendResult = await sendTeacherInviteEmail(
        normalizedEmail,
        user.name || user.username || "Teacher",
        null,
        getFrontendBaseUrl(req),
        newTempPassword
      );
      previewUrl = sendResult?.previewUrl || null;
      await users.updateOne({ id: user.id }, { $set: { inviteEmailStatus: "sent" } });
    } catch (err) {
      console.error("Resend teacher credentials email failed:", err.message);
      inviteEmailStatus = "failed";
      await users.updateOne({ id: user.id }, { $set: { inviteEmailStatus: "failed" } });
    }
  }

  return res.json({
    message:
      inviteEmailStatus === "sent"
        ? "New credentials sent to teacher."
        : inviteEmailStatus === "disabled"
          ? "New credentials generated, but email notifications are disabled for this teacher."
        : "New credentials generated, but email could not be delivered.",
    inviteEmailStatus,
    credentials: {
      email: user.email,
      temporaryPassword: newTempPassword,
      role: "teacher",
    },
    previewUrl,
  });
}

async function updateTeacher(req, res) {
  const { id } = req.params;
  const users = getUsersCollection();
  const currentTeacher = await findUserById(id);

  if (!currentTeacher || currentTeacher.role !== "teacher") {
    return res.status(404).json({ error: "Teacher not found" });
  }

  const { name, email, status } = req.body;
  const update = {};

  if (typeof name === "string") {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return res.status(400).json({ error: "Teacher name cannot be empty" });
    }
    update.name = trimmedName;
    update.username = trimmedName;
  }

  let normalizedEmail = currentTeacher.email;
  const emailChanged =
    typeof email === "string" &&
    normalizeEmail(email) !== currentTeacher.email;

  if (typeof email === "string") {
    normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const existing = await findUserByEmail(normalizedEmail);
    if (existing && existing.id !== currentTeacher.id) {
      return res
        .status(400)
        .json({ error: "A user with this email already exists" });
    }

    update.email = normalizedEmail;
  }

  if (typeof status === "string") {
    const allowedStatuses = ["active", "pending_password_setup", "disabled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid teacher status" });
    }
    update.status = status;
    update.disabledAt =
      status === "disabled" ? new Date().toISOString() : null;
  }

  update.updatedAt = new Date().toISOString();

  await users.updateOne({ id: currentTeacher.id }, { $set: update });

  let previewUrl = null;
  const refreshedTeacher = await findUserById(currentTeacher.id);
  if (emailChanged && refreshedTeacher.status === "pending_password_setup") {
    const { token } = await upsertTeacherInvite(
      normalizedEmail,
      "teacher_setup"
    );
    const invite = await sendTeacherInviteEmail(
      normalizedEmail,
      getDisplayName(refreshedTeacher),
      token,
      getFrontendBaseUrl(req)
    );
    previewUrl = invite.previewUrl;
  }

  await logAdminAction({
    actorId: req.user.id,
    actorEmail: req.user.email,
    actorRole: req.user.role,
    action: "user_update",
    targetId: currentTeacher.id,
    targetType: "user",
    details: { changes: Object.keys(update), email: currentTeacher.email },
    ip: req.ip,
  });

  return res.json({
    message: "Teacher updated successfully.",
    teacher: safeUserFields(await findUserById(currentTeacher.id)),
    previewUrl,
  });
}

async function deleteTeacher(req, res) {
  try {
    const { id } = req.params;
    const users = getUsersCollection();
    const teacher = await findUserById(id);

    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const teacherIdentifier = teacher.id || String(teacher._id);
    const teacherName = teacher.name || teacher.username || "Former teacher";

    // Preserve uploaded papers and assignments with teacher name stored on record
    const papers = getPapersCollection();
    await papers.updateMany(
      { $or: [{ uploadedById: teacherIdentifier }, { uploadedByEmail: teacher.email }] },
      { $set: { teacherName, uploaderDeleted: true } }
    );

    const assignments = getAssignmentsCollection();
    await assignments.updateMany(
      { $or: [{ teacherId: teacherIdentifier }, { teacherEmail: teacher.email }] },
      { $set: { teacherName, teacherDeleted: true } }
    );

    // Remove the teacher account
    await users.deleteOne({ _id: teacher._id });

    // Remove reset tokens
    await getPasswordResetCollection().deleteMany({
      email: teacher.email,
    });

    // Remove notifications
    const notifications = getNotificationsCollection();
    await notifications.deleteMany({
      $or: [{ userId: teacherIdentifier }, { userId: String(teacher._id) }],
    });

    // Remove failed login attempts / session locks
    const failedAttempts = getFailedLoginAttemptsCollection();
    await failedAttempts.deleteMany({
      email: teacher.email,
    });

    await logAdminAction({
      actorId: req.user.id || String(req.user._id),
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "user_delete",
      targetId: teacherIdentifier,
      targetType: "user",
      details: { email: teacher.email, role: "teacher", name: teacherName },
      ip: req.ip,
    });

    emitUserEvent("deleted", {
      id: teacherIdentifier,
      _id: String(teacher._id),
      email: teacher.email,
      role: "teacher",
    });
    emitStatsEvent("changed");

    return res.json({ message: "Teacher account deleted successfully." });
  } catch (error) {
    console.error("Failed to delete teacher:", error);
    return res.status(500).json({ error: "Failed to delete teacher account." });
  }
}

async function listStudents(req, res) {
  const students = await getUsersCollection()
    .find({ role: "student" }, { projection: { password: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  res.json({ students: students.map(safeUserFields) });
}

async function updateStudent(req, res) {
  const student = await findUserById(req.params.id);
  if (!student || student.role !== "student") {
    return res.status(404).json({ error: "Student not found." });
  }

  const update = {};
  if (typeof req.body.name === "string") {
    const name = req.body.name.trim();
    if (!name)
      return res.status(400).json({ error: "Student name cannot be empty." });
    update.name = name;
    update.username = name;
  }
  if (typeof req.body.email === "string") {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }
    const existing = await findUserByEmail(email);
    if (existing && String(existing._id) !== String(student._id)) {
      return res
        .status(409)
        .json({ error: "A user with this email already exists." });
    }
    update.email = email;
  }
  if (typeof req.body.class === "string") {
    const normalizedClass = normalizeClass(req.body.class);
    if (!normalizedClass) {
      return res.status(400).json({ error: "Invalid class cohort." });
    }
    update.class = normalizedClass;
  }
  if (typeof req.body.status === "string") {
    if (
      !["active", "disabled", "pending_password_setup"].includes(
        req.body.status
      )
    ) {
      return res.status(400).json({ error: "Invalid student status." });
    }
    update.status = req.body.status;
  }
  update.updatedAt = new Date().toISOString();
  await getUsersCollection().updateOne({ _id: student._id }, { $set: update });

  await logAdminAction({
    actorId: req.user.id || String(req.user._id),
    actorEmail: req.user.email,
    actorRole: req.user.role,
    action: "user_update",
    targetId: student.id || String(student._id),
    targetType: "user",
    details: { changes: Object.keys(update), email: student.email },
    ip: req.ip,
  });

  const refreshedStudent = await findUserById(student._id);
  emitUserEvent("updated", safeUserFields(refreshedStudent));

  return res.json({
    message: "Student updated successfully.",
    student: safeUserFields(refreshedStudent),
  });
}

async function deleteStudent(req, res) {
  try {
    const student = await findUserById(req.params.id);
    if (!student || student.role !== "student") {
      return res.status(404).json({ error: "Student not found." });
    }

    const studentIdentifier = student.id || String(student._id);
    await getUsersCollection().deleteOne({ _id: student._id });

    await getPasswordResetCollection().deleteMany({
      email: student.email,
    });

    const notifications = getNotificationsCollection();
    await notifications.deleteMany({
      $or: [{ userId: studentIdentifier }, { userId: String(student._id) }],
    });

    await logAdminAction({
      actorId: req.user.id || String(req.user._id),
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "user_delete",
      targetId: studentIdentifier,
      targetType: "user",
      details: { email: student.email, role: "student" },
      ip: req.ip,
    });

    emitUserEvent("deleted", {
      id: studentIdentifier,
      _id: String(student._id),
      email: student.email,
      role: "student",
    });
    emitStatsEvent("changed");

    return res.json({ message: "Student account deleted successfully." });
  } catch (error) {
    console.error("Failed to delete student:", error);
    return res.status(500).json({ error: "Failed to delete student account." });
  }
}

async function listDeletionRequests(req, res) {
  const deletionRequests = getDeletionRequestsCollection();
  const papers = getPapersCollection();
  const users = getUsersCollection();
  const status = (req.query.status || "").trim();
  const filter = {};

  if (status) {
    filter.status = status;
  }

  const requests = await deletionRequests
    .find(filter)
    .sort({ requestedAt: -1 })
    .toArray();

  const enriched = await Promise.all(
    requests.map(async (request) => {
      const [paper, requester] = await Promise.all([
        papers.findOne({ id: request.paperId }),
        request.requestedByEmail
          ? users.findOne({ email: request.requestedByEmail })
          : Promise.resolve(null),
      ]);

      return {
        ...request,
        paper: paper
          ? {
              id: paper.id,
              title: paper.title,
              subject: paper.subject,
              year: paper.year,
              type: paper.type,
              uploadedBy: paper.uploadedBy,
              uploadedAt: paper.uploadedAt,
              originalName: paper.originalName,
            }
          : null,
        requester: requester ? safeUserFields(requester) : null,
      };
    })
  );

  res.json({ deletionRequests: enriched });
}

async function approveDeletionRequest(req, res) {
  const { id } = req.params;
  const deletionRequests = getDeletionRequestsCollection();
  const request = await deletionRequests.findOne({ id });

  if (!request) {
    return res.status(404).json({ error: "Deletion request not found" });
  }

  if (request.status !== "Pending") {
    return res
      .status(400)
      .json({ error: "This request has already been processed." });
  }

  const paper = await getPaperById(request.paperId);
  const paperTermLabel = paper && paper.term ? termLabel(paper.term) : "";
  if (paper) {
    await permanentlyDeletePaperRecord(paper, request.reason, req.user);
  }

  const processedAt = new Date().toISOString();
  await deletionRequests.updateOne(
    { id },
    {
      $set: {
        status: "Approved",
        processedAt,
        processedBy: req.user.email,
      },
    }
  );

  console.log(
    `[DELETE_APPROVE] requestId=${id} paperId=${request.paperId} approvedBy=${req.user.email}`
  );

  let notificationMessage = "The requester was notified by email.";
  try {
    if (!request.requestedByEmail) {
      notificationMessage = "No requester email is available for notification.";
    } else {
      const notification = await sendDeletionRequestDecisionEmail(
        request.requestedByEmail,
        request.paperTitle,
        "Approved",
        "",
        paperTermLabel
      );
      if (!notification.isReal) {
        notificationMessage =
          "Development email preview was generated; no real email was sent.";
      }
    }
  } catch (error) {
    console.error(
      `[DELETE_APPROVE] Request ${id} was processed, but notification failed:`,
      error
    );
    notificationMessage =
      "The request was processed, but the notification email could not be sent.";
  }

  await logAdminAction({
    actorId: req.user.id,
    actorEmail: req.user.email,
    actorRole: req.user.role,
    action: "paper_deletion_approved",
    targetId: id,
    targetType: "deletion_request",
    details: { paperId: request.paperId, paperTitle: request.paperTitle, reason: request.reason },
    ip: req.ip,
  });

  return res.json({
    message: `Deletion request approved. ${notificationMessage}`,
  });
}

async function rejectDeletionRequest(req, res) {
  const { id } = req.params;
  const deletionRequests = getDeletionRequestsCollection();
  const request = await deletionRequests.findOne({ id });

  if (!request) {
    return res.status(404).json({ error: "Deletion request not found" });
  }

  if (request.status !== "Pending") {
    return res
      .status(400)
      .json({ error: "This request has already been processed." });
  }

  const paper = await getPaperById(request.paperId);
  const paperTermLabel = paper && paper.term ? termLabel(paper.term) : "";

  const processedAt = new Date().toISOString();
  await deletionRequests.updateOne(
    { id },
    {
      $set: {
        status: "Rejected",
        processedAt,
        processedBy: req.user.email,
      },
    }
  );

  console.log(
    `[DELETE_REJECT] requestId=${id} paperId=${request.paperId} rejectedBy=${req.user.email}`
  );

  let notificationMessage = "The requester was notified by email.";
  try {
    if (!request.requestedByEmail) {
      notificationMessage = "No requester email is available for notification.";
    } else {
      const notification = await sendDeletionRequestDecisionEmail(
        request.requestedByEmail,
        request.paperTitle,
        "Rejected",
        request.notes || "",
        paperTermLabel
      );
      if (!notification.isReal) {
        notificationMessage =
          "Development email preview was generated; no real email was sent.";
      }
    }
  } catch (error) {
    console.error(
      `[DELETE_REJECT] Request ${id} was processed, but notification failed:`,
      error
    );
    notificationMessage =
      "The request was processed, but the notification email could not be sent.";
  }

  await logAdminAction({
    actorId: req.user.id,
    actorEmail: req.user.email,
    actorRole: req.user.role,
    action: "paper_deletion_rejected",
    targetId: id,
    targetType: "deletion_request",
    details: { paperId: request.paperId, paperTitle: request.paperTitle },
    ip: req.ip,
  });

  return res.json({
    message: `Deletion request rejected. ${notificationMessage}`,
  });
}

async function listAdminUsers(req, res) {
  try {
    const usersCollection = getUsersCollection();
    const users = await usersCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      users: users.map((user) => safeUserFields(user)),
    });
  } catch (error) {
    console.error("Failed to load admin users:", error);
    res.status(500).json({ message: "Failed to load users." });
  }
}

async function getUserResources(req, res) {
  try {
    const { id } = req.params;
    const user = await findUserById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const papersCollection = getPapersCollection();
    const searchTerms = [
      user._id?.toString(),
      user.id,
      user.email,
      user.name,
      user.username,
    ].filter(Boolean);

    const userMatch = {
      $or: [
        { uploadedById: { $in: searchTerms } },
        { uploadedByEmail: { $in: searchTerms } },
        { uploadedBy: { $in: searchTerms } },
        { createdBy: { $in: searchTerms } },
        { userEmail: { $in: searchTerms } },
        { ownerEmail: { $in: searchTerms } },
        { uploaderEmail: { $in: searchTerms } },
        { createdById: { $in: searchTerms } },
        { ownerId: { $in: searchTerms } },
        { userId: { $in: searchTerms } },
      ],
    };

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

    const queryFilter = termCondition ? { ...userMatch, ...termCondition } : userMatch;

    const [termGroups, resources] = await Promise.all([
      papersCollection
        .aggregate([
          { $match: userMatch },
          { $group: { _id: "$term", count: { $sum: 1 } } },
        ])
        .toArray(),
      papersCollection.find(queryFilter).sort({ createdAt: -1 }).toArray(),
    ]);

    res.json({
      user: safeUserFields(user),
      termCounts: countsFromGroups(termGroups),
      resources,
    });
  } catch (error) {
    console.error("Failed to load admin user resources:", error);
    res.status(500).json({ message: "Failed to load user resources." });
  }
}

async function bulkSetPaperTerm(req, res) {
  try {
    const { ids, term } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Provide an array of paper IDs to update", field: "ids" });
    }
    if (ids.length > 500) {
      return res.status(400).json({ error: "Cannot update more than 500 papers at once", field: "ids" });
    }
    const cleanIds = ids.map((id) => String(id || "").trim()).filter(Boolean);
    if (cleanIds.length === 0) {
      return res.status(400).json({ error: "No valid paper IDs provided", field: "ids" });
    }

    const termCheck = validateRequiredTerm(term);
    if (!termCheck.valid) {
      return res.status(400).json({ error: termCheck.error, field: termCheck.field });
    }

    const papersCollection = getPapersCollection();
    const existingPapers = await papersCollection.find({ id: { $in: cleanIds } }).toArray();
    if (existingPapers.length === 0) {
      return res.status(404).json({ error: "None of the specified papers were found." });
    }

    const result = await papersCollection.updateMany(
      { id: { $in: cleanIds } },
      { $set: { term: termCheck.value, updatedAt: new Date().toISOString() } }
    );

    await logAdminAction({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "papers.bulk_set_term",
      targetType: "paper",
      details: {
        count: result.modifiedCount,
        requestedCount: cleanIds.length,
        term: termCheck.value,
        termLabel: termLabel(termCheck.value),
      },
      ip: req.ip,
    });

    const updatedPapers = await papersCollection
      .find({ id: { $in: cleanIds } }, { projection: { _id: 0 } })
      .toArray();
    for (const paper of updatedPapers) {
      emitPaperEvent("updated", paper);
    }
    emitStatsEvent("changed");

    res.json({
      message: `Updated ${result.modifiedCount} papers to ${termLabel(termCheck.value)}`,
      changed: result.modifiedCount,
      term: termCheck.value,
      termLabel: termLabel(termCheck.value),
    });
  } catch (error) {
    console.error("Failed to bulk update paper terms:", error);
    res.status(500).json({ error: "Failed to bulk update paper terms." });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const user = await findUserById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        message: "Admin accounts cannot be deleted from this screen.",
      });
    }

    const userIdentifier = user.id || String(user._id);
    const userName = user.name || user.username || "Former teacher";

    if (user.role === "teacher") {
      const papers = getPapersCollection();
      await papers.updateMany(
        { $or: [{ uploadedById: userIdentifier }, { uploadedByEmail: user.email }] },
        { $set: { teacherName: userName, uploaderDeleted: true } }
      );
      const assignments = getAssignmentsCollection();
      await assignments.updateMany(
        { $or: [{ teacherId: userIdentifier }, { teacherEmail: user.email }] },
        { $set: { teacherName: userName, teacherDeleted: true } }
      );
    }

    const usersCollection = getUsersCollection();
    await usersCollection.deleteOne({ _id: user._id });

    await getPasswordResetCollection().deleteMany({
      email: user.email,
    });

    const notifications = getNotificationsCollection();
    await notifications.deleteMany({
      $or: [{ userId: userIdentifier }, { userId: String(user._id) }],
    });

    await logAdminAction({
      actorId: req.user.id || String(req.user._id),
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "user_delete",
      targetId: userIdentifier,
      targetType: "user",
      details: { email: user.email, role: user.role },
      ip: req.ip,
    });

    emitUserEvent("deleted", {
      id: userIdentifier,
      _id: String(user._id),
      email: user.email,
      role: user.role,
    });
    emitStatsEvent("changed");

    res.json({
      message: "User deleted successfully.",
      user: safeUserFields(user),
    });
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ message: "Failed to delete user." });
  }
}

async function getEmailHealthHandler(req, res) {
  try {
    const health = await getEmailHealth();
    res.json(health);
  } catch (error) {
    console.error("Failed to load email health:", error);
    res.status(500).json({ error: "Failed to load email health." });
  }
}

async function sendEmailTestHandler(req, res) {
  try {
    const targetEmail = req.user?.email;
    if (!targetEmail) {
      return res.status(400).json({ error: "Admin email not available on session." });
    }
    const result = await sendTestEmail(targetEmail);

    await logAdminAction({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "email_test_sent",
      targetId: req.user.id,
      targetType: "system",
      details: { to: targetEmail },
      ip: req.ip,
    });

    res.json({
      message: `Test email sent to ${targetEmail}.`,
      previewUrl: result?.previewUrl || null,
      isReal: result?.isReal || false,
    });
  } catch (error) {
    console.error("Failed to send test email:", error);
    res.status(500).json({ error: `Failed to send test email: ${error.message}` });
  }
}

module.exports = {
  findUserById,
  getStats,
  listTeachers,
  createTeacher,
  createTeacherDirect,
  resendTeacherInvite,
  updateTeacher,
  deleteTeacher,
  listStudents,
  updateStudent,
  deleteStudent,
  listDeletionRequests,
  approveDeletionRequest,
  rejectDeletionRequest,
  listAdminUsers,
  getUserResources,
  bulkSetPaperTerm,
  deleteUser,
  getEmailHealth: getEmailHealthHandler,
  sendEmailTest: sendEmailTestHandler,
};
