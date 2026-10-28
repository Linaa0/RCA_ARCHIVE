"use strict";

const express = require("express");
const router = express.Router();
const { getPublicCurriculum, getPublicSummary } = require("../controllers/publicController");

router.get("/public/curriculum", getPublicCurriculum);
router.get("/public/summary", getPublicSummary);

module.exports = router;
