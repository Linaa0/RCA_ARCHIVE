const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../src/app");
const { connectToMongo, closeDb } = require("../src/models");

test.before(async () => {
  await connectToMongo();
});

test.after(async () => {
  await closeDb();
});

test("SEEDED: Admin login by email and by username lands on role 'admin'", async () => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  // Login by email
  const res1 = await request(app)
    .post("/api/login")
    .send({ email, password });

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.role, "admin");
  assert.ok(res1.body.token);

  // Login by username
  const username = email.split("@")[0].toLowerCase();
  const res2 = await request(app)
    .post("/api/login")
    .send({ identifier: username, password });

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.role, "admin");
});

test("SEEDED: Teacher login by email and by username lands on role 'teacher'", async () => {
  const email = process.env.SEED_TEACHER_EMAIL;
  const password = process.env.SEED_TEACHER_PASSWORD;

  // Login by email
  const res1 = await request(app)
    .post("/api/login")
    .send({ email, password });

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.role, "teacher");
  assert.ok(res1.body.token);

  // Login by username
  const username = email.split("@")[0].toLowerCase();
  const res2 = await request(app)
    .post("/api/login")
    .send({ identifier: username, password });

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.role, "teacher");
});

test("SEEDED: Student login by email and by username lands on role 'student'", async () => {
  const email = process.env.SEED_STUDENT_EMAIL;
  const password = process.env.SEED_STUDENT_PASSWORD;

  // Login by email
  const res1 = await request(app)
    .post("/api/login")
    .send({ email, password });

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.role, "student");
  assert.ok(res1.body.token);

  // Login by username
  const { getUsersCollection } = require("../src/models");
  const studentDoc = await getUsersCollection().findOne({ email: email.toLowerCase().trim() });
  const username = studentDoc?.username || email.split("@")[0].toLowerCase();
  const res2 = await request(app)
    .post("/api/login")
    .send({ identifier: username, password });

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.role, "student");
});
