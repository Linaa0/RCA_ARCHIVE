// Central place that decides which role an email address gets.
//
//   * ADMIN_EMAILS   -> always get the "admin" role
//   * TEACHER_EMAILS -> always get the "teacher" role
//   * everybody else -> "student"
//
// To add a teacher: put the email in TEACHER_EMAILS below (or in the
// TEACHER_EMAILS environment variable, comma separated) and restart the server.
const { ADMIN_BOOTSTRAP_EMAILS } = require("./env");

const norm = (e) => (e || "").trim().toLowerCase();

const DEFAULT_TEACHER_EMAILS = [
  "isabellecadeau78@gmail.com",
  // add more teacher emails here
];

const TEACHER_EMAILS = [
  ...new Set(
    [
      ...DEFAULT_TEACHER_EMAILS,
      ...(process.env.TEACHER_EMAILS || "").split(","),
    ]
      .map(norm)
      .filter(Boolean)
  ),
];

const ADMIN_EMAILS = [...new Set(ADMIN_BOOTSTRAP_EMAILS.map(norm))];

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(norm(email));
}

function isTeacherEmail(email) {
  return TEACHER_EMAILS.includes(norm(email));
}

// currentRole is the role already stored in the DB (if any).
// Listed emails are promoted; nobody is ever demoted automatically, so
// teachers created from the Admin panel keep working.
function resolveRole(email, currentRole) {
  if (isAdminEmail(email)) return "admin";
  if (currentRole === "admin") return "admin";
  if (isTeacherEmail(email)) return "teacher";
  return currentRole || "student";
}

module.exports = {
  TEACHER_EMAILS,
  ADMIN_EMAILS,
  isAdminEmail,
  isTeacherEmail,
  resolveRole,
};
