const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { JWT_SECRET } = require("../src/config/env");
const {
  connectToMongo,
  closeDb,
  getUsersCollection,
  getAdminAuditLogsCollection,
} = require("../src/models");

let adminToken;
const adminUser = {
  id: "test-admin-inviter-id",
  email: "admin.inviter@rca.ac.rw",
  username: "admininviter",
  role: "admin",
};

test("SETUP: initialize database and admin authorization token", async () => {
  await connectToMongo();
  const users = getUsersCollection();
  await users.updateOne(
    { email: adminUser.email },
    { $set: { ...adminUser, status: "active", createdAt: new Date().toISOString() } },
    { upsert: true }
  );
  adminToken = jwt.sign(adminUser, JWT_SECRET, { expiresIn: "2h" });
});

test("EMAIL HEALTH: GET /api/admin/email-health returns configuration and stats", async () => {
  const res = await request(app)
    .get("/api/admin/email-health")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.strictEqual(res.status, 200);
  assert.ok(res.body.provider);
  assert.ok(res.body.status);
  assert.ok(res.body.outboxStats);
  assert.ok(Array.isArray(res.body.recentOutbox));
});

test("INVITATIONS: Admin invites teacher with 14-char temp password and audit log", async () => {
  const teacherEmail = "autoinvite.teacher@rca.ac.rw";
  const users = getUsersCollection();
  await users.deleteMany({ email: teacherEmail });

  const res = await request(app)
    .post("/api/admin/teachers")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "Auto Invited Teacher",
      email: teacherEmail,
    });

  assert.strictEqual(res.status, 201);
  assert.ok(res.body.credentials);
  assert.strictEqual(res.body.credentials.email, teacherEmail);
  assert.strictEqual(res.body.credentials.temporaryPassword.length, 14);

  const teacherDoc = await users.findOne({ email: teacherEmail });
  assert.ok(teacherDoc);
  assert.strictEqual(teacherDoc.role, "teacher");
  assert.strictEqual(teacherDoc.mustChangePassword, true);
  assert.strictEqual(teacherDoc.invitedNotSignedIn, true);
  assert.ok(teacherDoc.tempPasswordExpiresAt > Date.now());

  // Verify admin audit log entry was written
  const auditLogs = getAdminAuditLogsCollection();
  const logEntry = await auditLogs.findOne({ targetId: teacherDoc.id, action: "user_create" });
  assert.ok(logEntry);
  assert.strictEqual(logEntry.actorEmail, adminUser.email);
});

test("INVITATIONS: Admin resends credentials and teacher logs in and changes password", async () => {
  const teacherEmail = "autoinvite.teacher@rca.ac.rw";
  const users = getUsersCollection();

  // Resend credentials generates a new temporary password
  const resendRes = await request(app)
    .post("/api/admin/teachers/resend-credentials")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email: teacherEmail });

  assert.strictEqual(resendRes.status, 200);
  assert.ok(resendRes.body.credentials);
  const newTempPassword = resendRes.body.credentials.temporaryPassword;
  assert.strictEqual(newTempPassword.length, 14);

  // Login with temporary password
  const loginRes = await request(app)
    .post("/api/login")
    .send({
      email: teacherEmail,
      password: newTempPassword,
    });

  assert.strictEqual(loginRes.status, 200);
  assert.ok(loginRes.body.token);
  assert.strictEqual(loginRes.body.mustChangePassword, true);
  const teacherToken = loginRes.body.token;

  // Change password
  const newPassword = "PermanentPassword123@";
  const changeRes = await request(app)
    .post("/api/change-password")
    .set("Authorization", `Bearer ${teacherToken}`)
    .send({
      currentPassword: newTempPassword,
      newPassword,
    });

  assert.strictEqual(changeRes.status, 200);
  assert.strictEqual(changeRes.body.message, "Password updated successfully.");

  // Verify document flags cleared in DB
  const updatedDoc = await users.findOne({ email: teacherEmail });
  assert.strictEqual(updatedDoc.mustChangePassword, false);
  assert.strictEqual(updatedDoc.tempPasswordExpiresAt, null);

  // Login with new permanent password
  const permanentLoginRes = await request(app)
    .post("/api/login")
    .send({
      email: teacherEmail,
      password: newPassword,
    });

  assert.strictEqual(permanentLoginRes.status, 200);
  assert.strictEqual(permanentLoginRes.body.mustChangePassword, false);

  // Old temporary password no longer works
  const oldLoginRes = await request(app)
    .post("/api/login")
    .send({
      email: teacherEmail,
      password: newTempPassword,
    });
  assert.strictEqual(oldLoginRes.status, 400);

  // Cleanup teacher
  await users.deleteMany({ email: teacherEmail });
});

test("INVITATIONS: Student invites are removed (POST /api/admin/students returns 404)", async () => {
  const studentEmail = "autoinvite.student@rca.ac.rw";
  const users = getUsersCollection();

  const res = await request(app)
    .post("/api/admin/students")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "Auto Invited Student",
      email: studentEmail,
      class: "Y1B",
      gender: "male",
    });

  assert.strictEqual(res.status, 404);

  // Cleanup admin
  await users.deleteMany({ email: adminUser.email });
});

test("TEARDOWN: close database connection", async () => {
  await closeDb();
});
