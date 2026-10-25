const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/subjectMaterialsController");
const { requireAuth } = require("../middleware/authMiddleware");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get("/subject-materials", requireAuth, wrap(ctrl.listSubjectMaterials));
router.get("/subject-materials/resources/:id/file", requireAuth, wrap(ctrl.getSubjectResourceFile));

module.exports = router;
