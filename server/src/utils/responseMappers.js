"use strict";

const { classLabel } = require("../config/classes");
const { normalizeTerm } = require("../config/terms");

/**
 * Maps a paper record based on the user's role.
 * - Never returns password, hash, internal filename, storage path, IP addresses, or database _id.
 * - Students and teachers never see other users' emails; they only see the uploader display name.
 * - Admins may see uploader email.
 * - Does NOT include unauthenticated viewUrl or downloadUrl; access links are created
 *   strictly via authenticated POST /api/papers/:id/access-link.
 */
function mapPaperForRole(paper, user = null) {
  if (!paper) return null;

  const isAdmin = user && user.role === "admin";
  const isOwner =
    user &&
    ((paper.uploadedById && String(paper.uploadedById) === String(user.id)) ||
      (paper.uploadedBy && String(paper.uploadedBy).toLowerCase() === String(user.username || "").toLowerCase()) ||
      (paper.uploadedByEmail && String(paper.uploadedByEmail).toLowerCase() === String(user.email || "").toLowerCase()));

  const ratings = Array.isArray(paper.ratings)
    ? paper.ratings.map((r) => ({
        username: r.username,
        value: typeof r.value === "number" ? r.value : 5,
      }))
    : [];

  const ratingCount = ratings.length;
  const averageRating = ratingCount
    ? Number((ratings.reduce((sum, r) => sum + r.value, 0) / ratingCount).toFixed(1))
    : 0;

  const mapped = {
    id: String(paper.id || ""),
    title: String(paper.title || ""),
    subject: String(paper.subject || ""),
    year: String(paper.year || ""),
    classId: paper.classId ? String(paper.classId) : undefined,
    classLabel: paper.classLabel || (paper.classId ? classLabel(paper.classId) : undefined),
    term: normalizeTerm(paper.term),
    type: String(paper.type || paper.category || "past_paper"),
    category: String(paper.category || paper.type || "past_paper"),
    originalName: paper.originalName || `${paper.title || "document"}.pdf`,
    uploadedBy: String(paper.uploadedBy || "Faculty"),
    uploadedAt: paper.uploadedAt || new Date().toISOString(),
    updatedAt: paper.updatedAt,
    ratings,
    ratingCount,
    averageRating,
  };

  // Only admin or the document owner sees the uploader email
  if (isAdmin || isOwner) {
    if (paper.uploadedByEmail) {
      mapped.uploadedByEmail = paper.uploadedByEmail;
    }
  }

  return mapped;
}

/**
 * Maps a user document for API output.
 * Strips password hashes, reset tokens, OTPs, internal flags, etc.
 */
function mapUserForRole(targetUser, requestingUser = null) {
  if (!targetUser) return null;

  const isAdmin = requestingUser && requestingUser.role === "admin";
  const isSelf = requestingUser && String(requestingUser.id) === String(targetUser.id || targetUser._id);

  const mapped = {
    id: String(targetUser.id || targetUser._id || ""),
    name: targetUser.name || targetUser.username || "",
    username: targetUser.username || "",
    role: targetUser.role || "student",
    status: targetUser.status || "active",
    class: targetUser.class || "",
    gender: targetUser.gender || "",
    createdAt: targetUser.createdAt,
  };

  // Email is only visible to admin or the user themselves
  if (isAdmin || isSelf) {
    mapped.email = targetUser.email || "";
    mapped.notifications = targetUser.notifications;
    mapped.mustChangePassword = Boolean(targetUser.mustChangePassword);
  }

  return mapped;
}

/**
 * Maps an assignment for API output.
 */
function mapAssignmentForRole(assignment, user = null) {
  if (!assignment) return null;

  const isAdmin = user && user.role === "admin";
  const isTeacher = user && user.role === "teacher";
  const isOwnerTeacher = isTeacher && String(assignment.teacherId) === String(user.id);

  const mapped = {
    id: String(assignment.id || ""),
    title: String(assignment.title || ""),
    description: String(assignment.description || ""),
    subject: String(assignment.subject || ""),
    term: normalizeTerm(assignment.term),
    deadline: assignment.deadline,
    givenAt: assignment.givenAt || assignment.createdAt,
    classes: Array.isArray(assignment.classes) ? assignment.classes : [],
    classLabels: Array.isArray(assignment.classes) ? assignment.classes.map(classLabel) : [],
    teacherName: assignment.teacherName || "Teacher",
    hasAttachment: Boolean(assignment.attachment),
    attachmentName: assignment.attachment?.originalName || null,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };

  if (isAdmin || isOwnerTeacher) {
    mapped.studentIds = assignment.studentIds || [];
    mapped.teacherEmail = assignment.teacherEmail || undefined;
    mapped.teacherId = assignment.teacherId || undefined;
  }

  return mapped;
}

module.exports = {
  mapPaperForRole,
  mapUserForRole,
  mapAssignmentForRole,
};
