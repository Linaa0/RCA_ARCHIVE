const { MongoClient } = require("mongodb");
const { MONGO_URI, MONGO_DB_NAME } = require("../config/env");

let client;
let db;

async function connectToMongo() {
  if (db) return db;

  client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    maxPoolSize: 20,
  });
  await client.connect();
  db = client.db(MONGO_DB_NAME);

  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("papers").createIndex({ id: 1 }, { unique: true }),
    db.collection("papers").createIndex({ hash: 1 }, { unique: true, sparse: true }),
    db.collection("papers").createIndex({ subject: 1, year: 1, term: 1 }),
    db.collection("papers").createIndex({ term: 1, uploadedAt: -1 }),
    db.collection("pendingTeacherOtps").createIndex({ email: 1, operation: 1 }),
    db.collection("pendingPasswordResets").createIndex({ email: 1, purpose: 1 }),
    db.collection("pendingPasswordResets").createIndex({ token: 1 }, { unique: true, sparse: true }),
    db.collection("deletionRequests").createIndex({ id: 1 }, { unique: true }),
    db.collection("deletionRequests").createIndex({ status: 1 }),
    db.collection("deletionRequests").createIndex({ paperId: 1 }),
    db.collection("assignments").createIndex({ id: 1 }, { unique: true }),
    db.collection("assignments").createIndex({ teacherId: 1 }),
    db.collection("assignments").createIndex({ reminderDueAt: 1, reminderProcessedAt: 1 }),
    db.collection("assignments").createIndex({ subject: 1, term: 1 }),
    db.collection("submissions").createIndex({ id: 1 }, { unique: true }),
    db.collection("submissions").createIndex({ assignmentId: 1, studentId: 1 }),
    db.collection("appeals").createIndex({ id: 1 }, { unique: true }),
    db.collection("appeals").createIndex({ teacherId: 1, status: 1 }),
    db.collection("appeals").createIndex({ assignmentId: 1, studentId: 1 }),
    db.collection("appealDismissals").createIndex({ assignmentId: 1, studentId: 1 }, { unique: true }),
    db.collection("teacherResources").createIndex({ id: 1 }, { unique: true }),
    db.collection("teacherResources").createIndex({ teacherId: 1, type: 1, uploadedAt: -1 }),
    db.collection("teacherResources").createIndex({ subject: 1, year: 1, term: 1 }),
    db.collection("pending_signups").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("pending_signups").createIndex({ email: 1 }, { unique: true }),
    db.collection("email_outbox").createIndex({ status: 1, createdAt: 1 }),
    db.collection("failedLoginAttempts").createIndex({ createdAt: 1 }, { expireAfterSeconds: 900 }),
    db.collection("failedLoginAttempts").createIndex({ email: 1, createdAt: -1 }),
    db.collection("failedLoginAttempts").createIndex({ ip: 1, createdAt: -1 }),
    db.collection("admin_audit_logs").createIndex({ action: 1, createdAt: -1 }),
    db.collection("admin_audit_logs").createIndex({ targetId: 1, createdAt: -1 }),
    db.collection("security_logs").createIndex({ type: 1, createdAt: -1 }),
    db.collection("security_logs").createIndex({ ip: 1, createdAt: -1 }),
    db.collection("security_logs").createIndex({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 }),
    db.collection("notifications").createIndex({ userId: 1, read: 1, createdAt: -1 }),
    db.collection("notifications").createIndex({ id: 1 }, { unique: true }),
  ]);

  return db;
}

function getDb() {
  if (!db) throw new Error("MongoDB is not connected yet");
  return db;
}

function getUsersCollection() {
  return getDb().collection("users");
}

function getPapersCollection() {
  return getDb().collection("papers");
}

function getOtpCollection() {
  return getDb().collection("pendingTeacherOtps");
}

function getPasswordResetCollection() {
  return getDb().collection("pendingPasswordResets");
}

function getDeletionRequestsCollection() {
  return getDb().collection("deletionRequests");
}

function getFailedLoginAttemptsCollection() {
  return getDb().collection("failedLoginAttempts");
}

function getAssignmentsCollection() {
  return getDb().collection("assignments");
}

function getSubmissionsCollection() {
  return getDb().collection("submissions");
}

function getAppealsCollection() {
  return getDb().collection("appeals");
}

function getAppealDismissalsCollection() {
  return getDb().collection("appealDismissals");
}

function getTeacherResourcesCollection() {
  return getDb().collection("teacherResources");
}

function getPendingSignupsCollection() {
  return getDb().collection("pending_signups");
}

function getEmailOutboxCollection() {
  return getDb().collection("email_outbox");
}

function getAdminAuditLogsCollection() {
  return getDb().collection("admin_audit_logs");
}

function getSecurityLogsCollection() {
  return getDb().collection("security_logs");
}

function getNotificationsCollection() {
  return getDb().collection("notifications");
}

async function checkDbHealth() {
  if (!db || !client) {
    try {
      await connectToMongo();
    } catch (_) {
      return false;
    }
  }
  try {
    await db.command({ ping: 1 });
    return true;
  } catch (err) {
    return false;
  }
}

async function closeDb() {
  if (client) {
    await client.close();
    db = null;
    client = null;
  }
}

module.exports = {
  connectToMongo,
  checkDbHealth,
  getDb,
  getUsersCollection,
  getPapersCollection,
  getOtpCollection,
  getPasswordResetCollection,
  getDeletionRequestsCollection,
  getFailedLoginAttemptsCollection,
  getAssignmentsCollection,
  getSubmissionsCollection,
  getAppealsCollection,
  getTeacherResourcesCollection,
  getAppealDismissalsCollection,
  getPendingSignupsCollection,
  getEmailOutboxCollection,
  getAdminAuditLogsCollection,
  getSecurityLogsCollection,
  getNotificationsCollection,
  closeDb,
};
