"use strict";

const { getPromotions } = require("../config/curriculum");
const { getTermsPayload } = require("../config/terms");
const { getPapersCollection } = require("../models");

let cachedSummary = null;
let lastSummaryAt = 0;

async function getPublicCurriculum(_req, res) {
  res.setHeader("Cache-Control", "public, max-age=60");

  const rawPromotions = getPromotions();
  const safePromotions = rawPromotions.map((p) => ({
    id: p.id,
    name: p.label || p.id,
    classes: Array.isArray(p.classes) ? [...p.classes] : [],
    subjects: Array.isArray(p.subjects) ? [...p.subjects] : [],
  }));

  const safeTerms = getTermsPayload().map((t) => ({
    term: t.term,
    label: t.label,
  }));

  return res.json({
    status: "ok",
    promotions: safePromotions,
    terms: safeTerms,
  });
}

async function getPublicSummary(_req, res) {
  res.setHeader("Cache-Control", "public, max-age=60");

  const now = Date.now();
  if (cachedSummary && now - lastSummaryAt < 60000) {
    return res.json(cachedSummary);
  }

  try {
    const papers = getPapersCollection();
    const rawCount = await papers.countDocuments({});

    // Round to nearest 5 or 10 to prevent fingerprinting
    const roundedPapers = Math.max(0, Math.round(rawCount / 5) * 5);

    const promotions = getPromotions();
    const subjectsSet = new Set();
    promotions.forEach((p) => {
      (p.subjects || []).forEach((s) => subjectsSet.add(s));
    });

    cachedSummary = {
      status: "ok",
      approximatePapers: roundedPapers,
      totalSubjects: subjectsSet.size,
      totalTerms: 3,
    };
    lastSummaryAt = now;

    return res.json(cachedSummary);
  } catch (err) {
    return res.json({
      status: "ok",
      approximatePapers: 0,
      totalSubjects: 25,
      totalTerms: 3,
    });
  }
}

module.exports = {
  getPublicCurriculum,
  getPublicSummary,
};
