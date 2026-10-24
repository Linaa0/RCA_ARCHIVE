#!/usr/bin/env node
"use strict";

/**
 * Pre-flight settings check for production deployment.
 * Pure Node, no external dependencies, no database connections.
 * Validates the env file without printing any secret values.
 * Exits 0 on valid configuration, exits 1 on any failure.
 */

const fs = require("fs");
const path = require("path");

function fail(variableName, reason) {
  console.error(`PREFLIGHT CONFIG ERROR: [${variableName}] ${reason}`);
  process.exit(1);
}

function warn(variableName, message) {
  console.warn(`PREFLIGHT CONFIG WARNING: [${variableName}] ${message}`);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`PREFLIGHT ERROR: Specified environment file not found at: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let val = match[2].trim();

    // Strip outer quotes if paired
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }

  return env;
}

function main() {
  const envPath = process.argv[2];
  if (!envPath) {
    console.error("Usage: node server/scripts/check-env.js <path-to-.env>");
    process.exit(1);
  }

  const env = parseEnvFile(envPath);

  // 1. NODE_ENV
  if (!env.NODE_ENV) {
    fail("NODE_ENV", "NODE_ENV is missing. Must be set for production.");
  }
  if (env.NODE_ENV.toLowerCase() === "development") {
    fail("NODE_ENV", "NODE_ENV is set to 'development' on live server. Must be 'production'.");
  }

  // 2. JWT_SECRET
  if (!env.JWT_SECRET) {
    fail("JWT_SECRET", "JWT_SECRET is missing.");
  }
  if (env.JWT_SECRET.length < 32) {
    fail("JWT_SECRET", `JWT_SECRET must be at least 32 characters long (found ${env.JWT_SECRET.length}).`);
  }

  // 3. MONGO_URI
  if (!env.MONGO_URI && !env.MONGODB_URI) {
    fail("MONGO_URI", "MONGO_URI or MONGODB_URI is required.");
  }

  // 4. Legacy passwords must be purged
  if (env.ADMIN_BOOTSTRAP_PASSWORD) {
    fail("ADMIN_BOOTSTRAP_PASSWORD", "Leftover legacy password detected in settings. Must be removed (-ADMIN_BOOTSTRAP_PASSWORD).");
  }
  if (env.ADMIN_BOOTSTRAP_EMAIL) {
    warn("ADMIN_BOOTSTRAP_EMAIL", "Legacy key present. Consider replacing with ADMIN_BOOTSTRAP_EMAILS.");
  }

  // 5. Mail settings: SMTP or API provider
  const mailProvider = (env.MAIL_PROVIDER || "smtp").toLowerCase();
  if (mailProvider === "smtp") {
    if (!env.SMTP_HOST) fail("SMTP_HOST", "SMTP_HOST is required when MAIL_PROVIDER is smtp.");
    if (!env.SMTP_USER) fail("SMTP_USER", "SMTP_USER is required when MAIL_PROVIDER is smtp.");
    if (!env.SMTP_PASS) fail("SMTP_PASS", "SMTP_PASS is required when MAIL_PROVIDER is smtp.");
    if (!env.EMAIL_FROM) fail("EMAIL_FROM", "EMAIL_FROM is required for outgoing mail sender identity.");
  } else if (mailProvider === "resend") {
    if (!env.RESEND_API_KEY) fail("RESEND_API_KEY", "RESEND_API_KEY is required when MAIL_PROVIDER is resend.");
    if (!env.EMAIL_FROM) fail("EMAIL_FROM", "EMAIL_FROM is required for outgoing mail sender identity.");
  } else if (mailProvider === "brevo") {
    if (!env.BREVO_API_KEY) fail("BREVO_API_KEY", "BREVO_API_KEY is required when MAIL_PROVIDER is brevo.");
    if (!env.EMAIL_FROM) fail("EMAIL_FROM", "EMAIL_FROM is required for outgoing mail sender identity.");
  } else {
    fail("MAIL_PROVIDER", `Unsupported MAIL_PROVIDER '${mailProvider}'. Expected 'smtp', 'resend', or 'brevo'.`);
  }

  console.log("PREFLIGHT CHECK OK: All required production settings validated successfully.");
  process.exit(0);
}

main();
