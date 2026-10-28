const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/users", requireAuth, userController.listUsers);
router.get("/users/:id", requireAuth, userController.getUser);

module.exports = router;
