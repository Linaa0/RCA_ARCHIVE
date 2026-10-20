const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/users", requireAuth, userController.listUsers);

module.exports = router;
