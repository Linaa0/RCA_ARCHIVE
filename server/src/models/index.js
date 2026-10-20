const { MongoClient } = require("mongodb");
const { MONGO_URI, MONGO_DB_NAME } = require("../config/env");

let client;
let db;

async function connectToMongo() {
  if (db) return db;

  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(MONGO_DB_NAME);

  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("papers").createIndex({ id: 1 }, { unique: true }),
    db.collection("papers").createIndex({ hash: 1 }, { unique: true, sparse: true }),
    db.collection("pendingTeacherOtps").createIndex({ email: 1, operation: 1 }),
    db.collection("pendingPasswordResets").createIndex({ email: 1, purpose: 1 }),
    db.collection("pendingPasswordResets").createIndex({ token: 1 }, { unique: true, sparse: true }),
    db.collection("deletionRequests").createIndex({ id: 1 }, { unique: true }),
    db.collection("deletionRequests").createIndex({ status: 1 }),
    db.collection("deletionRequests").createIndex({ paperId: 1 }),
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

async function closeDb() {
  if (client) {
    await client.close();
    db = null;
    client = null;
  }
}

module.exports = {
  connectToMongo,
  getDb,
  getUsersCollection,
  getPapersCollection,
  getOtpCollection,
  getPasswordResetCollection,
  getDeletionRequestsCollection,
  getFailedLoginAttemptsCollection,
  closeDb,
};
