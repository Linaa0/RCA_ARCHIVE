const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/assignmentController");
const teacherResources = require("../controllers/teacherResourceController");
const profile = require("../controllers/profileController");
const { requireAuth } = require("../middleware/authMiddleware");
const { requireTeacher, requireStudent } = require("../middleware/roleGuard");
const { handleSubmissionUpload } = require("../services/submissionStorage");

const { appealLimiter, uploadLimiter } = require("../middleware/rateLimiter");

// Express 4 does not catch rejected promises from async handlers
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const teacherOrStudent = (req, res, next) =>
  ["teacher", "student"].includes(req.user.role)
    ? next()
    : res.status(403).json({ error: "Only teachers and students can use assignments" });

// Profile (every role)
router.get("/me", requireAuth, wrap(profile.getMe));
router.put("/me", requireAuth, wrap(profile.updateMe));
router.put("/me/password", requireAuth, wrap(profile.changePassword));

// Teacher dashboard
router.get("/teacher/stats", requireAuth, requireTeacher, wrap(ctrl.teacherStats));
router.get("/teacher/submissions/classes", requireAuth, requireTeacher, wrap(ctrl.submissionClasses));
router.get("/teacher/submissions/download-all", requireAuth, requireTeacher, wrap(ctrl.downloadAllSubmissions));
router.get("/teacher/submissions", requireAuth, requireTeacher, wrap(ctrl.listSubmissions));
router.get("/teacher/students", requireAuth, requireTeacher, wrap(ctrl.listStudentsForTeacher));
router.get("/teacher/resources", requireAuth, requireTeacher, wrap(teacherResources.listResources));
router.post("/teacher/resources", requireAuth, requireTeacher, uploadLimiter, handleSubmissionUpload, wrap(teacherResources.createResource));
router.get("/teacher/resources/:id/file", requireAuth, requireTeacher, wrap(teacherResources.getResourceFile));

// Assignments
router.get("/assignments", requireAuth, teacherOrStudent, wrap(ctrl.listAssignments));
router.post("/assignments", requireAuth, requireTeacher, uploadLimiter, handleSubmissionUpload, wrap(ctrl.createAssignment));
router.get("/assignments/:id", requireAuth, teacherOrStudent, wrap(ctrl.getAssignment));
router.put("/assignments/:id", requireAuth, requireTeacher, handleSubmissionUpload, wrap(ctrl.updateAssignment));
router.get("/assignments/:id/attachment", requireAuth, teacherOrStudent, wrap(ctrl.downloadAttachment));
router.get("/assignments/:id/view", requireAuth, teacherOrStudent, wrap(ctrl.viewAttachment));
router.delete("/assignments/:id", requireAuth, requireTeacher, wrap(ctrl.deleteAssignment));

router.post("/assignments/:id/submit", requireAuth, requireStudent, uploadLimiter, handleSubmissionUpload, wrap(ctrl.submitAssignment));
router.get("/submissions/:submissionId", requireAuth, teacherOrStudent, wrap(ctrl.getSubmission));
router.get("/submissions/:submissionId/file", requireAuth, teacherOrStudent, wrap(ctrl.downloadSubmissionFile));
router.get("/submissions/:submissionId/view", requireAuth, teacherOrStudent, wrap(ctrl.viewSubmissionFile));
router.get("/assignments/:id/submissions/:submissionId/file", requireAuth, teacherOrStudent, wrap(ctrl.downloadSubmissionFile));
router.get("/assignments/:id/submissions/:submissionId/view", requireAuth, teacherOrStudent, wrap(ctrl.viewSubmissionFile));
router.get("/assignments/submissions/:submissionId/view", requireAuth, teacherOrStudent, wrap(ctrl.viewSubmissionFile));
router.post("/assignments/:id/appeal", requireAuth, requireStudent, appealLimiter, wrap(ctrl.createAppeal));

// Appeals
router.get("/appeals", requireAuth, teacherOrStudent, wrap(ctrl.listAppeals));
router.patch("/appeals/:id/read", requireAuth, requireTeacher, wrap(ctrl.markAppealRead));
router.patch("/appeals/:id/approve", requireAuth, requireTeacher, wrap(ctrl.approveAppeal));
router.patch("/appeals/:id/reject", requireAuth, requireTeacher, wrap(ctrl.rejectAppeal));

module.exports = router;
