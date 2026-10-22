const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");
const bcrypt = require("bcryptjs");
const { MongoClient } = require("mongodb");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const { MONGO_URI, MONGO_DB_NAME } = require("../src/config/env");

function parseMongoHost(uri) {
  try {
    const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, "");
    const hostPart = withoutProtocol.split("/")[0];
    const atIndex = hostPart.lastIndexOf("@");
    const hostAndPort = atIndex !== -1 ? hostPart.slice(atIndex + 1) : hostPart;
    const host = hostAndPort.split(":")[0];
    return host || "localhost";
  } catch (err) {
    return "unknown";
  }
}

function isLocalHost(host) {
  const h = (host || "").toLowerCase().trim();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function promptDatabaseConfirmation(expectedDbName) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `[SECURITY] Type the exact database name ("${expectedDbName}") to confirm reset: `,
      (answer) => {
        rl.close();
        resolve(answer.trim());
      }
    );
  });
}

function cleanDirectoryFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    fs.writeFileSync(path.join(directoryPath, ".gitkeep"), "", "utf8");
    return;
  }

  const entries = fs.readdirSync(directoryPath);
  for (const entry of entries) {
    if (entry === ".gitkeep") continue;
    const fullPath = path.join(directoryPath, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.warn(`[WARN] Could not remove file ${fullPath}:`, err.message);
    }
  }

  const gitkeepPath = path.join(directoryPath, ".gitkeep");
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, "", "utf8");
  }
}

async function backupCollections(db, collections, backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });

  let usedMongodump = false;
  try {
    execSync("mongodump --version", { stdio: "ignore" });
    const dumpCmd = `mongodump --uri="${MONGO_URI}" --db="${MONGO_DB_NAME}" --out="${backupDir}"`;
    execSync(dumpCmd, { stdio: "inherit" });
    usedMongodump = true;
    console.log(`[OK] Backup completed via mongodump into: ${backupDir}`);
  } catch (dumpErr) {
    console.log(
      "[INFO] mongodump not available or failed. Falling back to JSON export."
    );
  }

  if (!usedMongodump) {
    for (const col of collections) {
      const documents = await db.collection(col.name).find({}).toArray();
      const exportFile = path.join(backupDir, `${col.name}.json`);
      fs.writeFileSync(
        exportFile,
        JSON.stringify(documents, null, 2),
        "utf8"
      );
    }
    console.log(`[OK] Backup completed via JSON export into: ${backupDir}`);
  }
}

async function ensureAllIndexes(db) {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("papers").createIndex({ id: 1 }, { unique: true }),
    db
      .collection("papers")
      .createIndex({ hash: 1 }, { unique: true, sparse: true }),
    db
      .collection("pendingTeacherOtps")
      .createIndex({ email: 1, operation: 1 }),
    db
      .collection("pendingPasswordResets")
      .createIndex({ email: 1, purpose: 1 }),
    db
      .collection("pendingPasswordResets")
      .createIndex({ token: 1 }, { unique: true, sparse: true }),
    db.collection("deletionRequests").createIndex({ id: 1 }, { unique: true }),
    db.collection("deletionRequests").createIndex({ status: 1 }),
    db.collection("deletionRequests").createIndex({ paperId: 1 }),
    db.collection("assignments").createIndex({ id: 1 }, { unique: true }),
    db.collection("assignments").createIndex({ teacherId: 1 }),
    db.collection("submissions").createIndex({ id: 1 }, { unique: true }),
    db
      .collection("submissions")
      .createIndex({ assignmentId: 1, studentId: 1 }),
    db.collection("appeals").createIndex({ id: 1 }, { unique: true }),
    db.collection("appeals").createIndex({ teacherId: 1, status: 1 }),
    db.collection("appeals").createIndex({ assignmentId: 1, studentId: 1 }),
    db.collection("teacherResources").createIndex({ id: 1 }, { unique: true }),
    db
      .collection("teacherResources")
      .createIndex({ teacherId: 1, type: 1, uploadedAt: -1 }),
  ]);
  console.log("[OK] Database indexes verified.");
}

async function resetDb() {
  const args = process.argv.slice(2);
  const isConfirm = args.includes("--confirm");
  const isAllowRemote = args.includes("--allow-remote");

  const host = parseMongoHost(MONGO_URI);
  const dbName = MONGO_DB_NAME;
  const nodeEnv = process.env.NODE_ENV || "production";
  const isLocal = isLocalHost(host);
  const isProduction = nodeEnv === "production";

  console.log("=== RCA Archive Database Reset & Seed Script ===");
  console.log(`Target Host: ${host}`);
  console.log(`Target Database: ${dbName}`);
  console.log(`Environment: ${nodeEnv}`);
  console.log(`Execution Mode: ${isConfirm ? "LIVE EXECUTION (--confirm)" : "DRY RUN (no changes)"}`);

  if (isProduction || !isLocal) {
    if (!isAllowRemote) {
      console.error(
        `[SECURITY ERROR] Refusing to reset database. Environment is "${nodeEnv}" and host is "${host}".`
      );
      console.error(
        `To run against a remote or production database, you must pass --allow-remote and confirm the database name.`
      );
      process.exit(1);
    }

    const typedName = await promptDatabaseConfirmation(dbName);
    if (typedName !== dbName) {
      console.error(
        `[SECURITY ERROR] Database name confirmation did not match ("${typedName}" !== "${dbName}"). Aborting.`
      );
      process.exit(1);
    }
    console.log("[OK] Remote/production confirmation validated.");
  }

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(dbName);

    const rawCollections = await db.listCollections().toArray();
    const standardCollections = [
      "users",
      "papers",
      "pendingTeacherOtps",
      "pendingPasswordResets",
      "deletionRequests",
      "failedLoginAttempts",
      "assignments",
      "submissions",
      "appeals",
      "teacherResources",
    ];

    const collectionNames = Array.from(
      new Set([
        ...standardCollections,
        ...rawCollections.map((col) => col.name),
      ])
    ).filter((name) => !name.startsWith("system."));

    console.log("\nCurrent Collection Document Counts:");
    for (const name of collectionNames) {
      const count = await db.collection(name).countDocuments();
      console.log(`   - ${name}: ${count}`);
    }

    if (!isConfirm) {
      console.log("\n[INFO] Dry run completed. No data was deleted or seeded.");
      console.log("Pass --confirm to execute the backup, reset, and seed.");
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.resolve(__dirname, "../backups", timestamp);

    console.log("\n[1/5] Creating pre-reset backup...");
    await backupCollections(
      db,
      collectionNames.map((name) => ({ name })),
      backupDir
    );

    console.log("\n[2/5] Deleting all documents from collections...");
    for (const name of collectionNames) {
      const res = await db.collection(name).deleteMany({});
      console.log(`   - Cleared ${name} (deleted ${res.deletedCount} documents)`);
    }

    console.log("\n[3/5] Cleaning file upload directories...");
    const uploadsDir = path.resolve(__dirname, "../uploads");
    const submissionsDir = path.resolve(__dirname, "../submissions");
    cleanDirectoryFiles(uploadsDir);
    cleanDirectoryFiles(submissionsDir);
    console.log("[OK] uploads/ and submissions/ cleaned, retaining .gitkeep.");

    console.log("\n[4/5] Rebuilding database indexes...");
    await ensureAllIndexes(db);

    console.log("\n[5/5] Seeding test accounts...");
    const requiredSeedVars = [
      "SEED_ADMIN_EMAIL",
      "SEED_ADMIN_PASSWORD",
      "SEED_ADMIN_NAME",
      "SEED_TEACHER_EMAIL",
      "SEED_TEACHER_PASSWORD",
      "SEED_TEACHER_NAME",
      "SEED_STUDENT_EMAIL",
      "SEED_STUDENT_PASSWORD",
      "SEED_STUDENT_NAME",
      "SEED_STUDENT_CLASS",
    ];

    const missingVars = requiredSeedVars.filter(
      (varName) => !process.env[varName] || !process.env[varName].trim()
    );

    if (missingVars.length > 0) {
      console.error(
        `[ERROR] Cannot seed database. Missing required environment variables:\n${missingVars
          .map((v) => `   - ${v}`)
          .join("\n")}`
      );
      process.exit(1);
    }

    const adminEmail = process.env.SEED_ADMIN_EMAIL.toLowerCase().trim();
    const adminUsername = adminEmail.split("@")[0].toLowerCase();
    const adminPasswordHash = await bcrypt.hash(
      process.env.SEED_ADMIN_PASSWORD,
      10
    );

    const teacherEmail = process.env.SEED_TEACHER_EMAIL.toLowerCase().trim();
    const teacherUsername = teacherEmail.split("@")[0].toLowerCase();
    const teacherPasswordHash = await bcrypt.hash(
      process.env.SEED_TEACHER_PASSWORD,
      10
    );

    const studentEmail = process.env.SEED_STUDENT_EMAIL.toLowerCase().trim();
    const studentUsername = studentEmail.split("@")[0].toLowerCase();
    const studentPasswordHash = await bcrypt.hash(
      process.env.SEED_STUDENT_PASSWORD,
      10
    );

    const now = new Date().toISOString();

    const adminUser = {
      id: `${Date.now()}-1`,
      name: process.env.SEED_ADMIN_NAME.trim(),
      username: adminUsername,
      email: adminEmail,
      password: adminPasswordHash,
      role: "admin",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const teacherUser = {
      id: `${Date.now()}-2`,
      name: process.env.SEED_TEACHER_NAME.trim(),
      username: teacherUsername,
      email: teacherEmail,
      password: teacherPasswordHash,
      role: "teacher",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const studentUser = {
      id: `${Date.now()}-3`,
      name: process.env.SEED_STUDENT_NAME.trim(),
      username: studentUsername,
      email: studentEmail,
      password: studentPasswordHash,
      role: "student",
      class: process.env.SEED_STUDENT_CLASS.trim(),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const usersCol = db.collection("users");
    await usersCol.insertMany([adminUser, teacherUser, studentUser]);

    console.log("[OK] Seeded accounts:");
    console.log(`   - Admin: ${adminUser.email} (username: ${adminUser.username}, role: ${adminUser.role})`);
    console.log(`   - Teacher: ${teacherUser.email} (username: ${teacherUser.username}, role: ${teacherUser.role})`);
    console.log(`   - Student: ${studentUser.email} (username: ${studentUser.username}, role: ${studentUser.role}, class: ${studentUser.class})`);

    console.log("\nFinal Collection Document Counts:");
    for (const name of collectionNames) {
      const count = await db.collection(name).countDocuments();
      console.log(`   - ${name}: ${count}`);
    }

    console.log("\n[OK] Database reset and seed completed successfully.");
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  resetDb().catch((err) => {
    console.error("[ERROR] Database reset failed:", err.message);
    process.exit(1);
  });
}

module.exports = { resetDb };
