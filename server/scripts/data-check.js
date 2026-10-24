const fs = require("fs");
const path = require("path");
const {
  connectToMongo,
  closeDb,
  getUsersCollection,
  getPapersCollection,
  getAssignmentsCollection,
  getSubmissionsCollection,
  getAppealsCollection,
} = require("../src/models");
const { UPLOADS_DIR } = require("../src/config/env");
const { SUBMISSIONS_DIR } = require("../src/services/submissionStorage");

async function runDataCheck() {
  try {
    await connectToMongo();

    const usersCol = getUsersCollection();
    const papersCol = getPapersCollection();
    const assignmentsCol = getAssignmentsCollection();
    const submissionsCol = getSubmissionsCollection();
    const appealsCol = getAppealsCollection();

    // 1. Users by role
    const [adminCount, teacherCount, studentCount, totalUsers] = await Promise.all([
      usersCol.countDocuments({ role: "admin" }),
      usersCol.countDocuments({ role: "teacher" }),
      usersCol.countDocuments({ role: "student" }),
      usersCol.countDocuments({}),
    ]);

    // 2. Papers by year (normalize Year 1 / Y1 / Y1GenAI, Year 2 / Y2, Year 3 / Y3)
    const allPapers = await papersCol.find({}, { projection: { year: 1, classId: 1, filename: 1 } }).toArray();
    let y1Count = 0;
    let y2Count = 0;
    let y3Count = 0;
    let otherYearsCount = 0;
    let papersMissingFiles = 0;

    for (const p of allPapers) {
      const yr = String(p.year || p.classId || "").trim().toLowerCase();
      if (yr.includes("1") || yr.includes("y1") || yr.includes("genai")) {
        y1Count += 1;
      } else if (yr.includes("2") || yr.includes("y2")) {
        y2Count += 1;
      } else if (yr.includes("3") || yr.includes("y3")) {
        y3Count += 1;
      } else {
        otherYearsCount += 1;
      }

      if (p.filename) {
        const fullPath = path.join(UPLOADS_DIR, path.basename(p.filename));
        if (!fs.existsSync(fullPath)) {
          papersMissingFiles += 1;
        }
      } else {
        papersMissingFiles += 1;
      }
    }

    // 3. Assignments and missing attachment files
    const allAssignments = await assignmentsCol.find({}, { projection: { attachment: 1 } }).toArray();
    const totalAssignments = allAssignments.length;
    let attachmentsMissingFiles = 0;

    for (const a of allAssignments) {
      if (a.attachment && a.attachment.filename) {
        const fullPath = path.join(SUBMISSIONS_DIR, path.basename(a.attachment.filename));
        if (!fs.existsSync(fullPath)) {
          attachmentsMissingFiles += 1;
        }
      }
    }

    // 4. Submissions and missing submission files
    const allSubmissions = await submissionsCol.find({}, { projection: { file: 1 } }).toArray();
    const totalSubmissions = allSubmissions.length;
    let submissionsMissingFiles = 0;

    for (const s of allSubmissions) {
      if (s.file && s.file.filename) {
        const fullPath = path.join(SUBMISSIONS_DIR, path.basename(s.file.filename));
        if (!fs.existsSync(fullPath)) {
          submissionsMissingFiles += 1;
        }
      }
    }

    // 5. Appeals
    const totalAppeals = await appealsCol.countDocuments({});

    // Output ONLY numbers. Never print names, emails, titles, or values.
    console.log("=== DATA CHECK SUMMARY ===");
    console.log("Users by role:");
    console.log(`  Admins: ${adminCount}`);
    console.log(`  Teachers: ${teacherCount}`);
    console.log(`  Students: ${studentCount}`);
    console.log(`  Total users: ${totalUsers}`);
    console.log("Papers by year:");
    console.log(`  Year 1: ${y1Count}`);
    console.log(`  Year 2: ${y2Count}`);
    console.log(`  Year 3: ${y3Count}`);
    if (otherYearsCount > 0) {
      console.log(`  Other: ${otherYearsCount}`);
    }
    console.log(`  Total papers: ${allPapers.length}`);
    console.log("Activity counts:");
    console.log(`  Assignments: ${totalAssignments}`);
    console.log(`  Submissions: ${totalSubmissions}`);
    console.log(`  Appeals: ${totalAppeals}`);
    console.log("Missing files on disk:");
    console.log(`  Papers missing files: ${papersMissingFiles}`);
    console.log(`  Submissions missing files: ${submissionsMissingFiles}`);
    console.log(`  Assignment attachments missing files: ${attachmentsMissingFiles}`);
    console.log("==========================");

    await closeDb();
    process.exit(0);
  } catch (err) {
    console.error("Data check failed with an error.");
    process.exit(1);
  }
}

runDataCheck();
