require("dotenv").config();
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const path = require("path");
const bcrypt = require("bcryptjs");
const { TEACHER_EMAILS } = require("./teacherEmails");

const dbFile = path.join(__dirname, "db.json");
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { users: [], papers: [] });
const DEFAULT_SEED_PASSWORD =
  process.env.SEED_DEFAULT_PASSWORD || "changeme123";

async function seedDatabase() {
  try {
    await db.read();

    console.log("Seeding Database...\n");

    const students = [
      { email: "alice@student.rca.ac.uk", name: "Alice Johnson" },
      { email: "bob@student.rca.ac.uk", name: "Bob Smith" },
      { email: "charlie@student.rca.ac.uk", name: "Charlie Davis" },
    ];

    const teachers = [
      { email: "prof.smith@rca.ac.uk", name: "Prof. Smith" },
      { email: "teacher@rca.ac.uk", name: "Teacher Admin" },
    ];

    for (const student of students) {
      const exists = db.data.users.find((u) => u.email === student.email);
      if (!exists) {
        const hashed = await bcrypt.hash(DEFAULT_SEED_PASSWORD, 10);
        db.data.users.push({
          id: Date.now().toString() + Math.random(),
          email: student.email,
          username: student.email.split("@")[0],
          password: hashed,
          role: "student",
          createdAt: new Date().toISOString(),
        });
        console.log(`Created student: ${student.email}`);
      } else {
        console.log(` Student exists: ${student.email}`);
      }
    }

    for (const teacher of teachers) {
      const exists = db.data.users.find((u) => u.email === teacher.email);
      if (!exists) {
        const hashed = await bcrypt.hash(DEFAULT_SEED_PASSWORD, 10);
        db.data.users.push({
          id: Date.now().toString() + Math.random(),
          email: teacher.email,
          username: teacher.email.split("@")[0],
          password: hashed,
          role: "teacher",
          createdAt: new Date().toISOString(),
        });
        console.log(` Created teacher: ${teacher.email}`);
      } else {
        console.log(`  Teacher exists: ${teacher.email}`);
      }
    }

    await db.write();

    console.log("\n Database Status:");
    console.log(`   Total users: ${db.data.users.length}`);
    console.log(
      `   Students: ${db.data.users.filter((u) => u.role === "student").length}`,
    );
    console.log(
      `   Teachers: ${db.data.users.filter((u) => u.role === "teacher").length}`,
    );

    console.log("\n Recognized Teacher Emails:");
    TEACHER_EMAILS.forEach((email) => {
      console.log(`   - ${email}`);
    });

    console.log("\n Seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error.message);
    process.exit(1);
  }
}

seedDatabase().then(() => {
  process.exit(0);
});
