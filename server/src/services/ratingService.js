"use strict";

const { getPapersCollection } = require("../models");

function buildRatingSummary(paper) {
  if (!paper) return null;
  const ratings = Array.isArray(paper.ratings) ? paper.ratings : [];
  const ratingCount = ratings.length;
  const averageRating = ratingCount
    ? Number(
        (ratings.reduce((sum, r) => sum + r.value, 0) / ratingCount).toFixed(1)
      )
    : 0;

  return {
    ...paper,
    ratings,
    ratingCount,
    averageRating,
  };
}

async function getPaperById(paperId) {
  const papers = getPapersCollection();
  return papers.findOne({ id: String(paperId) });
}

module.exports = {
  buildRatingSummary,
  getPaperById,
};
