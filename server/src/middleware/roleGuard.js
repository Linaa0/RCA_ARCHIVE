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

function requireStudent(req, res, next) {
  if (!req.user || req.user.role !== "student") {
    return res.status(403).json({ error: "Student access required" });
  }
  next();
}

module.exports = {
  requireAdmin,
  requireTeacher,
  requireStudent,
};
