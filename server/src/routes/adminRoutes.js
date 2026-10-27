const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { requireAuth } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleGuard");

router.use(requireAuth, requireAdmin);

router.get("/stats", adminController.getStats);
router.get("/email-health", adminController.getEmailHealth);
router.post("/email-test", adminController.sendEmailTest);

router.get("/teachers", adminController.listTeachers);
router.post("/teachers", adminController.createTeacher);
router.post("/teachers/direct", adminController.createTeacherDirect);
router.post("/teachers/resend-invite", adminController.resendTeacherInvite);
router.post("/teachers/resend-credentials", adminController.resendTeacherInvite);
router.put("/teachers/:id", adminController.updateTeacher);
router.delete("/teachers/:id", adminController.deleteTeacher);

router.get("/students", adminController.listStudents);
router.put("/students/:id", adminController.updateStudent);
router.delete("/students/:id", adminController.deleteStudent);

router.get("/deletion-requests", adminController.listDeletionRequests);
router.patch("/deletion-requests/:id/approve", adminController.approveDeletionRequest);
router.patch("/deletion-requests/:id/reject", adminController.rejectDeletionRequest);

router.get("/users", adminController.listAdminUsers);
router.get("/users/:id/resources", adminController.getUserResources);
router.delete("/users/:id", adminController.deleteUser);

router.patch("/papers/term", adminController.bulkSetPaperTerm);

module.exports = router;
