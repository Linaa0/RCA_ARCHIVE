require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectToMongo, getUsersCollection } = require("./db");
const { TEACHER_EMAILS } = require("./teacherEmails");

const DEFAULT_SEED_PASSWORD =
  process.env.SEED_DEFAULT_PASSWORD || "changeme123";

async function seedDatabase() {
  try {
    await connectToMongo();
    const users = getUsersCollection();

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
      const exists = await users.findOne({ email: student.email });
      if (!exists) {
        const hashed = await bcrypt.hash(DEFAULT_SEED_PASSWORD, 10);
        await users.insertOne({
          id: `${Date.now().toString()}-${Math.random().toString(36).slice(2)}`,
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
      const exists = await users.findOne({ email: teacher.email });
      if (!exists) {
        const hashed = await bcrypt.hash(DEFAULT_SEED_PASSWORD, 10);
        await users.insertOne({
          id: `${Date.now().toString()}-${Math.random().toString(36).slice(2)}`,
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

    const totalUsers = await users.countDocuments();
    const totalStudents = await users.countDocuments({ role: "student" });
    const totalTeachers = await users.countDocuments({ role: "teacher" });

    console.log("\n Database Status:");
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Students: ${totalStudents}`);
    console.log(`   Teachers: ${totalTeachers}`);

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
