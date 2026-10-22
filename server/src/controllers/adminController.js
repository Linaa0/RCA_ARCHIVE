const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
  getUsersCollection,
  getPapersCollection,
  getDeletionRequestsCollection,
  getPasswordResetCollection,
} = require("../models");
const { findUserByEmail } = require("../middleware/authMiddleware");
const { isValidEmail } = require("../middleware/validation");
const {
  normalizeEmail,
  safeUserFields,
  getDisplayName,
} = require("../utils/userUtils");
const { getFrontendBaseUrl } = require("../utils/urlUtils");
const { normalizeClass } = require("../config/classes");
const {
  sendTeacherInviteEmail,
  sendAccountInviteEmail,
  upsertTeacherInvite,
  cleanExpiredPasswordResets,
} = require("../services/emailService");
const {
  permanentlyDeletePaperRecord,
} = require("../services/storageService");
const { getPaperById } = require("../services/ratingService");

async function findUserById(id) {
  const users = getUsersCollection();
  return users.findOne({ id: String(id) });
}

async function getStats(req, res) {
  const users = getUsersCollection();
  const papers = getPapersCollection();
  const deletionRequests = getDeletionRequestsCollection();

  const [
    totalUsers,
    totalStudents,
    totalTeachers,
    totalPapers,
    pendingDeletionRequests,
  ] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ role: "student" }),
    users.countDocuments({ role: "teacher" }),
    papers.countDocuments(),
    deletionRequests.countDocuments({ status: "Pending" }),
  ]);

  res.json({
    totalUsers,
    totalStudents,
    totalTeachers,
    totalPapers,
    pendingDeletionRequests,
  });
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
  const { email, name, username } = req.body;
  const teacherName = (name || username || "").trim();

  if (!email || !teacherName) {
    return res
      .status(400)
      .json({ error: "Teacher name and email are required" });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const users = getUsersCollection();
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    return res
      .status(400)
      .json({ error: "A user with this email already exists" });
  }

  const teacher = {
    id: Date.now().toString(),
    email: normalizedEmail,
    name: teacherName,
    username: teacherName,
    password: null,
    role: "teacher",
    status: "pending_password_setup",
    createdAt: new Date().toISOString(),
    createdBy: req.user.email,
  };
  await users.insertOne(teacher);

  try {
    const { token } = await upsertTeacherInvite(
      normalizedEmail,
      "teacher_setup"
    );
    const { previewUrl } = await sendTeacherInviteEmail(
      normalizedEmail,
      teacherName,
      token,
      getFrontendBaseUrl(req)
    );
    return res.json({
      message: "Teacher created. Setup email sent.",
      teacher: safeUserFields(teacher),
      previewUrl,
    });
  } catch (err) {
    console.error("❌ Teacher invite email failed:", err);
    return res.status(500).json({
      error:
        "Teacher created but email failed to send. Use 'Resend invite' to retry.",
    });
  }
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
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  const normalizedEmail = normalizeEmail(email);
  const user = await findUserByEmail(email);
  if (!user || user.role !== "teacher") {
    return res.status(404).json({ error: "Teacher not found" });
  }
  if (user.status !== "pending_password_setup") {
    return res.status(400).json({ error: "Teacher already activated" });
  }

  const resetCollection = getPasswordResetCollection();
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  await cleanExpiredPasswordResets();
  await resetCollection.deleteMany({
    email: normalizedEmail,
    purpose: "teacher_setup",
  });
  await resetCollection.insertOne({
    email: normalizedEmail,
    token,
    expiresAt,
    purpose: "teacher_setup",
    createdAt: new Date().toISOString(),
  });

  const { previewUrl } = await sendTeacherInviteEmail(
    normalizedEmail,
    user.name || user.username || "Teacher",
    token,
    getFrontendBaseUrl(req)
  );
  res.json({ message: "Invite resent", previewUrl });
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

  console.log(
    `[TEACHER_UPDATE] id=${currentTeacher.id} actor=${req.user.email} changes=${Object.keys(update).join(",")}`
  );

  return res.json({
    message: "Teacher updated successfully.",
    teacher: safeUserFields(await findUserById(currentTeacher.id)),
    previewUrl,
  });
}

async function deleteTeacher(req, res) {
  const { id } = req.params;
  const users = getUsersCollection();
  const teacher = await findUserById(id);

  if (!teacher || teacher.role !== "teacher") {
    return res.status(404).json({ error: "Teacher not found" });
  }

  await users.deleteOne({ id: teacher.id });
  await getPasswordResetCollection().deleteMany({
    email: teacher.email,
    purpose: "teacher_setup",
  });

  console.log(
    `[TEACHER_DELETE] id=${teacher.id} email=${teacher.email} actor=${req.user.email}`
  );

  return res.json({ message: "Teacher account deleted successfully." });
}

async function listStudents(req, res) {
  const students = await getUsersCollection()
    .find({ role: "student" }, { projection: { password: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  res.json({ students: students.map(safeUserFields) });
}

async function createStudent(req, res) {
  try {
    const { name, email } = req.body || {};
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedEmail =
      typeof email === "string" ? normalizeEmail(email) : "";

    if (!normalizedName || !normalizedEmail) {
      return res.status(400).json({
        message: "Name and email are required to invite a student.",
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    if (await findUserByEmail(normalizedEmail)) {
      return res.status(409).json({
        message: "A user with this email already exists.",
      });
    }

    const now = new Date().toISOString();
    const student = {
      id: Date.now().toString(),
      name: normalizedName,
      username: normalizedName,
      email: normalizedEmail,
      password: null,
      role: "student",
      class: normalizeClass(req.body.class),
      status: "pending_password_setup",
      createdAt: now,
      updatedAt: now,
      createdBy: req.user.email,
    };

    await getUsersCollection().insertOne(student);
    try {
      const { token } = await upsertTeacherInvite(
        normalizedEmail,
        "student_setup"
      );
      const { previewUrl } = await sendAccountInviteEmail(
        normalizedEmail,
        normalizedName,
        token,
        getFrontendBaseUrl(req),
        "student"
      );
      return res.status(201).json({
        message: "Student invitation sent.",
        student: safeUserFields(student),
        previewUrl,
      });
    } catch (error) {
      console.error("Student invitation email failed:", error);
      return res.status(500).json({
        error:
          "Student created but the invitation email failed. Use Resend invite to retry.",
      });
    }
  } catch (error) {
    console.error("Failed to create student:", error);
    return res
      .status(500)
      .json({ message: "Failed to create student account." });
  }
}

async function resendStudentInvite(req, res) {
  const normalizedEmail = normalizeEmail(req.body?.email || "");
  const student = await findUserByEmail(normalizedEmail);
  if (!student || student.role !== "student") {
    return res.status(404).json({ error: "Student not found." });
  }
  if (student.status !== "pending_password_setup") {
    return res
      .status(400)
      .json({ error: "Student account is already active." });
  }
  const { token } = await upsertTeacherInvite(
    normalizedEmail,
    "student_setup"
  );
  const { previewUrl } = await sendAccountInviteEmail(
    normalizedEmail,
    student.name || student.username || "Student",
    token,
    getFrontendBaseUrl(req),
    "student"
  );
  return res.json({ message: "Student invitation resent.", previewUrl });
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
    if (existing && existing.id !== student.id) {
      return res
        .status(409)
        .json({ error: "A user with this email already exists." });
    }
    update.email = email;
  }
  if (typeof req.body.class === "string") {
    update.class = normalizeClass(req.body.class);
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
  await getUsersCollection().updateOne({ id: student.id }, { $set: update });
  return res.json({
    message: "Student updated successfully.",
    student: safeUserFields(await findUserById(student.id)),
  });
}

async function deleteStudent(req, res) {
  const student = await findUserById(req.params.id);
  if (!student || student.role !== "student") {
    return res.status(404).json({ error: "Student not found." });
  }
  await getUsersCollection().deleteOne({ id: student.id });
  return res.json({ message: "Student account deleted successfully." });
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

  return res.json({
    message: "Deletion request approved and paper removed.",
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

  return res.json({
    message: "Deletion request rejected.",
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

    const resources = await papersCollection
      .find({
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
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      user: safeUserFields(user),
      resources,
    });
  } catch (error) {
    console.error("Failed to load admin user resources:", error);
    res.status(500).json({ message: "Failed to load user resources." });
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

    const usersCollection = getUsersCollection();
    let result = await usersCollection.deleteOne({ id: String(id) });
    if (!result.deletedCount && user.email) {
      result = await usersCollection.deleteOne({ email: user.email });
    }

    if (!result.deletedCount) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({
      message: "User deleted successfully.",
      user: safeUserFields(user),
    });
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ message: "Failed to delete user." });
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
  createStudent,
  resendStudentInvite,
  updateStudent,
  deleteStudent,
  listDeletionRequests,
  approveDeletionRequest,
  rejectDeletionRequest,
  listAdminUsers,
  getUserResources,
  deleteUser,
};
