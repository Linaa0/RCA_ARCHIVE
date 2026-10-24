const express = require("express");
const router = express.Router();
const paperController = require("../controllers/paperController");
const { requireAuth } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleGuard");

router.get("/papers", paperController.listPapers);
router.post("/papers/:id/access-link", requireAuth, paperController.createAccessLink);
router.get("/papers/access/:token/:mode", paperController.accessPaperFile);
router.get("/papers/:id/file", paperController.getPaperFile);
router.get("/papers/:id/view", paperController.viewPaper);
router.get("/papers/:id/download", paperController.downloadPaper);
router.post("/papers/:id/rate", requireAuth, paperController.ratePaper);
router.put("/papers/:id", requireAuth, paperController.updatePaper);
router.delete("/papers/:id", requireAuth, paperController.deletePaper);
router.post("/papers/:id/request-delete", requireAuth, paperController.requestDeletePaper);
router.get("/stats", paperController.getStats);

module.exports = router;
