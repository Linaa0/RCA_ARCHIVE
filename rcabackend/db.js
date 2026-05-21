require("dotenv").config();
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "rca_past_papers";

const client = new MongoClient(MONGO_URI);
let db;

async function connectToMongo() {
  if (db) return db;

  await client.connect();
  db = client.db(MONGO_DB_NAME);

  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("papers").createIndex({ id: 1 }, { unique: true }),
    db
      .collection("papers")
      .createIndex({ hash: 1 }, { unique: true, sparse: true }),
    db.collection("pendingTeacherOtps").createIndex({ email: 1 }),
  ]);

  return db;
}

function getUsersCollection() {
  if (!db) throw new Error("MongoDB is not connected yet");
  return db.collection("users");
}

function getPapersCollection() {
  if (!db) throw new Error("MongoDB is not connected yet");
  return db.collection("papers");
}

function getOtpCollection() {
  if (!db) throw new Error("MongoDB is not connected yet");
  return db.collection("pendingTeacherOtps");
}

module.exports = {
  connectToMongo,
  getUsersCollection,
  getPapersCollection,
  getOtpCollection,
};
