const { getFailedLoginAttemptsCollection } = require("../models");
const { sendSuspiciousLoginEmail } = require("../services/emailService");

async function checkFailedAttempts(email) {
  const collection = getFailedLoginAttemptsCollection();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  await collection.deleteMany({
    email,
    createdAt: { $lt: oneHourAgo },
  });

  const count = await collection.countDocuments({
    email,
    createdAt: { $gte: oneHourAgo },
  });

  return count;
}

async function recordFailedAttempt(req, email, user, initialAttempts) {
  const collection = getFailedLoginAttemptsCollection();
  await collection.insertOne({
    email,
    ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
    createdAt: new Date().toISOString(),
  });

  const newAttemptsCount = initialAttempts + 1;
  const attemptsLeft = Math.max(0, 3 - newAttemptsCount);

  if (newAttemptsCount === 3 && user) {
    sendSuspiciousLoginEmail(user).catch((err) =>
      console.error("Failed to send suspicious login email:", err.message)
    );
  }

  return { newAttemptsCount, attemptsLeft };
}

async function clearFailedAttemptsForEmail(email) {
  const collection = getFailedLoginAttemptsCollection();
  return collection.deleteMany({ email });
}

module.exports = {
  checkFailedAttempts,
  recordFailedAttempt,
  clearFailedAttemptsForEmail,
};
