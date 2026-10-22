const path = require("path");
const dotenv = require("dotenv");

// Load .env from server root directory if not already loaded
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config(); // fallback to current working directory .env

const PORT = Number(process.env.PORT) || 5077;
const NODE_ENV = process.env.NODE_ENV || "production";
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "rca_past_papers";
const JWT_SECRET = process.env.JWT_SECRET || "";
const ADMIN_BOOTSTRAP_SECRET = process.env.ADMIN_BOOTSTRAP_SECRET || "";

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET is missing or shorter than 32 characters. Please provide a secure JWT_SECRET in server/.env."
  );
}

const ADMIN_BOOTSTRAP_EMAILS = process.env.ADMIN_BOOTSTRAP_EMAILS
  ? process.env.ADMIN_BOOTSTRAP_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  : [];

const TEACHER_EMAILS = process.env.TEACHER_EMAILS
  ? process.env.TEACHER_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  : [];

const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "http://localhost:3074";

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  (SMTP_USER ? `"RCA Archive" <${SMTP_USER}>` : '"RCA Archive" <no-reply@rcarchive.local>');

const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.resolve(__dirname, "../../uploads");

const SERVE_FRONTEND = process.env.SERVE_FRONTEND !== "false";

module.exports = {
  PORT,
  NODE_ENV,
  MONGO_URI,
  MONGO_DB_NAME,
  JWT_SECRET,
  ADMIN_BOOTSTRAP_SECRET,
  ADMIN_BOOTSTRAP_EMAILS,
  TEACHER_EMAILS,
  BASE_URL,
  FRONTEND_BASE_URL,
  CORS_ORIGINS,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  UPLOADS_DIR,
  SERVE_FRONTEND,
};
