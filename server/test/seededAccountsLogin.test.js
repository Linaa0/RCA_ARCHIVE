const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../src/app");
const { connectToMongo, closeDb, getUsersCollection } = require("../src/models");

test.before(async () => {
  await connectToMongo();
});

test.after(async () => {
  await closeDb();
});

test("SEEDED: Admin login by email and by username lands on role 'admin'", async () => {
  const email = process.env.SEED_ADMIN_EMAIL || "admin.seeded@rca.ac.rw";
  const password = process.env.SEED_ADMIN_PASSWORD || "AdminTest123@";
  const users = getUsersCollection();
  const lowerEmail = email.toLowerCase().trim();
  const existingUser = await users.findOne({ email: lowerEmail });
  let createdMock = false;

  if (!existingUser) {
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);
    await users.insertOne({
      id: "mock-seeded-admin-id",
      email: lowerEmail,
      username: lowerEmail.split("@")[0],
      name: "Mock Seeded Admin",
      role: "admin",
      status: "active",
      password: passwordHash,
      createdAt: new Date().toISOString(),
    });
    createdMock = true;
  }

  try {
    // Login by email
    const res1 = await request(app)
      .post("/api/login")
      .send({ email: lowerEmail, password });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.role, "admin");
    assert.ok(res1.body.token);

    // Login by username
    const username = existingUser?.username || lowerEmail.split("@")[0];
    const res2 = await request(app)
      .post("/api/login")
      .send({ identifier: username, password });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.role, "admin");
  } finally {
    if (createdMock) {
      await users.deleteOne({ email: lowerEmail });
    }
  }
});

test("SEEDED: Teacher login by email and by username lands on role 'teacher'", async () => {
  const email = process.env.SEED_TEACHER_EMAIL || "teacher.seeded@rca.ac.rw";
  const password = process.env.SEED_TEACHER_PASSWORD || "TeacherTest123@";
  const users = getUsersCollection();
  const lowerEmail = email.toLowerCase().trim();
  const existingUser = await users.findOne({ email: lowerEmail });
  let createdMock = false;

  if (!existingUser) {
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);
    await users.insertOne({
      id: "mock-seeded-teacher-id",
      email: lowerEmail,
      username: lowerEmail.split("@")[0],
      name: "Mock Seeded Teacher",
      role: "teacher",
      status: "active",
      password: passwordHash,
      createdAt: new Date().toISOString(),
    });
    createdMock = true;
  }

  try {
    // Login by email
    const res1 = await request(app)
      .post("/api/login")
      .send({ email: lowerEmail, password });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.role, "teacher");
    assert.ok(res1.body.token);

    // Login by username
    const username = existingUser?.username || lowerEmail.split("@")[0];
    const res2 = await request(app)
      .post("/api/login")
      .send({ identifier: username, password });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.role, "teacher");
  } finally {
    if (createdMock) {
      await users.deleteOne({ email: lowerEmail });
    }
  }
});

test("SEEDED: Student login by email and by username lands on role 'student'", async () => {
  const email = process.env.SEED_STUDENT_EMAIL || "student.seeded@rca.ac.rw";
  const password = process.env.SEED_STUDENT_PASSWORD || "StudentTest123@";
  const users = getUsersCollection();
  const lowerEmail = email.toLowerCase().trim();
  const existingUser = await users.findOne({ email: lowerEmail });
  let createdMock = false;

  if (!existingUser) {
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);
    await users.insertOne({
      id: "mock-seeded-student-id",
      email: lowerEmail,
      username: lowerEmail.split("@")[0],
      name: "Mock Seeded Student",
      role: "student",
      class: "Y1A",
      gender: "female",
      status: "active",
      password: passwordHash,
      createdAt: new Date().toISOString(),
    });
    createdMock = true;
  }

  try {
    // Login by email
    const res1 = await request(app)
      .post("/api/login")
      .send({ email: lowerEmail, password });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.role, "student");
    assert.ok(res1.body.token);

    // Login by username
    const username = existingUser?.username || lowerEmail.split("@")[0];
    const res2 = await request(app)
      .post("/api/login")
      .send({ identifier: username, password });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.role, "student");
  } finally {
    if (createdMock) {
      await users.deleteOne({ email: lowerEmail });
    }
  }
});
