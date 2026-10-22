const { BASE_URL } = require("../config/env");
const { getPapersCollection } = require("../models");

function buildRatingSummary(paper) {
  if (!paper) return null;
  const ratings = paper.ratings || [];
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
    viewUrl: `${BASE_URL}/api/papers/${paper.id}/view`,
    downloadUrl: `${BASE_URL}/api/papers/${paper.id}/download`,
  };
}

async function getPaperById(paperId) {
  const papers = getPapersCollection();
  return papers.findOne({ id: paperId });
}

module.exports = {
  buildRatingSummary,
  getPaperById,
};
