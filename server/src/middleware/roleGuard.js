function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function requireTeacher(req, res, next) {
  if (!req.user || req.user.role !== "teacher") {
    return res.status(403).json({ error: "Teacher access required" });
  }
  next();
}

function hasStudentAccess(user) {
  return Boolean(
    user &&
      (user.role === "student" ||
        (user.role === "admin" && typeof user.class === "string" && user.class.trim()))
  );
}

function requireStudent(req, res, next) {
  if (!hasStudentAccess(req.user)) {
    return res.status(403).json({ error: "Student access required" });
  }
  next();
}

module.exports = {
  requireAdmin,
  requireTeacher,
  requireStudent,
  hasStudentAccess,
};
