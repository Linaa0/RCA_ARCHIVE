const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const {
  connectToMongo,
  closeDb,
  getUsersCollection,
  getPendingSignupsCollection,
  getFailedLoginAttemptsCollection,
  getPasswordResetCollection,
} = require("../src/models");
const { clearFailedAttemptsForEmail } = require("../src/middleware/rateLimiter");

test.before(async () => {
  await connectToMongo();
});

test.after(async () => {
  await closeDb();
});

test("AUTH: send-otp rejects incomplete signup requests", async () => {
  // Missing gender and class
  const res = await request(app)
    .post("/api/send-otp")
    .send({
      email: "test.student1@rca.ac.rw",
      operation: "signup",
      fullName: "Test Student One",
      username: "teststudent1",
      password: "ValidPassword123",
    });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /Gender is required/i);

  // Missing class
  const res2 = await request(app)
    .post("/api/send-otp")
    .send({
      email: "test.student1@rca.ac.rw",
      operation: "signup",
      fullName: "Test Student One",
      username: "teststudent1",
      password: "ValidPassword123",
      gender: "female",
    });

  assert.strictEqual(res2.status, 400);
  assert.match(res2.body.error, /Class is required/i);
});

test("AUTH: send-otp generates pending signup with hashed OTP", async () => {
  const email = "autotest.student@rca.ac.rw";
  const users = getUsersCollection();
  const pending = getPendingSignupsCollection();

  await users.deleteMany({ email });
  await pending.deleteMany({ email });

  const res = await request(app)
    .post("/api/send-otp")
    .send({
      email,
      operation: "signup",
      fullName: "Auto Test Student",
      username: "autoteststudent",
      password: "TestPassword123@",
      class: "Y1A",
      gender: "female",
    });

  assert.strictEqual(res.status, 200);
  assert.ok(res.body.expiresAt);

  const pendingDoc = await pending.findOne({ email });
  assert.ok(pendingDoc, "Pending signup record must be created in pending_signups");
  assert.strictEqual(pendingDoc.fullName, "Auto Test Student");
  assert.strictEqual(pendingDoc.username, "autoteststudent");
  assert.strictEqual(pendingDoc.gender, "female");
  assert.strictEqual(pendingDoc.class, "Y1A");
  assert.ok(pendingDoc.hashedOtp, "OTP must be hashed");
  assert.notStrictEqual(pendingDoc.hashedOtp.length, 6, "Hashed OTP cannot be 6-digit plain text");
});

test("AUTH: signup rejects wrong OTP and tracks attempts", async () => {
  const email = "autotest.student@rca.ac.rw";
  const pending = getPendingSignupsCollection();

  // 1. Wrong OTP attempt
  const res = await request(app)
    .post("/api/signup")
    .send({
      email,
      otp: "000000",
    });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /Incorrect verification code/i);

  const pendingDoc = await pending.findOne({ email });
  assert.strictEqual(pendingDoc.attempts, 1);
});

test("AUTH: signup completes successfully with valid OTP and creates active user", async () => {
  const email = "autotest.student@rca.ac.rw";
  const users = getUsersCollection();
  const pending = getPendingSignupsCollection();

  // Set known OTP hash
  const testOtp = "123456";
  const hashedOtp = await bcrypt.hash(testOtp, 10);
  await pending.updateOne({ email }, { $set: { hashedOtp, attempts: 0 } });

  const res = await request(app)
    .post("/api/signup")
    .send({
      email,
      otp: testOtp,
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.email, email);
  assert.strictEqual(res.body.username, "autoteststudent");
  assert.strictEqual(res.body.role, "student");

  const createdUser = await users.findOne({ email });
  assert.ok(createdUser);
  assert.strictEqual(createdUser.status, "active");
  assert.strictEqual(createdUser.class, "Y1A");
  assert.strictEqual(createdUser.gender, "female");

  // Pending signup must be removed
  const remainingPending = await pending.findOne({ email });
  assert.strictEqual(remainingPending, null);
});

test("AUTH: login non-revealing error message ('Incorrect email or password')", async () => {
  // Unknown user
  const res1 = await request(app)
    .post("/api/login")
    .send({
      email: "nonexistent.user.999@rca.ac.rw",
      password: "WrongPassword123@",
    });

  assert.strictEqual(res1.status, 400);
  assert.strictEqual(res1.body.error, "Incorrect email or password");

  // Known user with wrong password
  const res2 = await request(app)
    .post("/api/login")
    .send({
      email: "autotest.student@rca.ac.rw",
      password: "DefinitivelyWrongPassword999!",
    });

  assert.strictEqual(res2.status, 400);
  assert.strictEqual(res2.body.error, "Incorrect email or password");
});

test("AUTH: login works with email and with username", async () => {
  // Clean failed login attempts
  await clearFailedAttemptsForEmail("autotest.student@rca.ac.rw", "127.0.0.1");

  // Login by email
  const res1 = await request(app)
    .post("/api/login")
    .send({
      email: "autotest.student@rca.ac.rw",
      password: "TestPassword123@",
    });

  assert.strictEqual(res1.status, 200);
  assert.ok(res1.body.token);
  assert.strictEqual(res1.body.role, "student");

  // Login by username
  const res2 = await request(app)
    .post("/api/login")
    .send({
      identifier: "autoteststudent",
      password: "TestPassword123@",
    });

  assert.strictEqual(res2.status, 200);
  assert.ok(res2.body.token);
  assert.strictEqual(res2.body.username, "autoteststudent");
});

test("AUTH: 5 failed login attempts triggers 15-minute account lockout", async () => {
  const targetEmail = "lockout.target@rca.ac.rw";
  const users = getUsersCollection();
  const hashedPassword = await bcrypt.hash("CorrectPassword123@", 10);

  await users.updateOne(
    { email: targetEmail },
    {
      $set: {
        id: "lockout-test-id",
        name: "Lockout Target",
        username: "lockouttarget",
        email: targetEmail,
        password: hashedPassword,
        role: "student",
        status: "active",
        createdAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  // Clear previous attempts for isolated test
  await clearFailedAttemptsForEmail(targetEmail, "127.0.0.1");

  // Execute 4 failed attempts
  for (let i = 0; i < 4; i++) {
    const res = await request(app)
      .post("/api/login")
      .send({ email: targetEmail, password: "BadPassword!" });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "Incorrect email or password");
  }

  // 5th failed attempt -> locks account
  const res5 = await request(app)
    .post("/api/login")
    .send({ email: targetEmail, password: "BadPassword!" });

  assert.strictEqual(res5.status, 429);
  assert.match(res5.body.error, /Too many failed login attempts|Account locked/i);
  assert.match(res5.body.error, /minute/i);
  assert.ok(res5.header["retry-after"]);

  // 6th attempt (even with correct password) -> still blocked by lockout
  const res6 = await request(app)
    .post("/api/login")
    .send({ email: targetEmail, password: "CorrectPassword123@" });

  assert.strictEqual(res6.status, 429);
  assert.match(res6.body.error, /Too many failed login attempts/i);

  // Clean up
  await clearFailedAttemptsForEmail(targetEmail, "127.0.0.1");
  await users.deleteOne({ email: targetEmail });
});

test("AUTH: forgot-password and reset-password flow", async () => {
  const email = "autotest.student@rca.ac.rw";
  const resetCol = getPasswordResetCollection();

  // Request password reset
  const res1 = await request(app)
    .post("/api/forgot-password")
    .send({ email });

  assert.strictEqual(res1.status, 200);
  assert.match(res1.body.message, /password reset link/i);

  const resetRecord = await resetCol.findOne({ email, purpose: "password_reset" });
  assert.ok(resetRecord, "Reset record must exist in DB");
  assert.ok(resetRecord.token);

  // Reset password using token
  const res2 = await request(app)
    .post("/api/reset-password")
    .send({
      token: resetRecord.token,
      newPassword: "BrandNewPassword456!",
    });

  assert.strictEqual(res2.status, 200);
  assert.match(res2.body.message, /Password has been reset successfully/i);

  // Login with new password
  const res3 = await request(app)
    .post("/api/login")
    .send({
      email,
      password: "BrandNewPassword456!",
    });

  assert.strictEqual(res3.status, 200);
  assert.ok(res3.body.token);

  // Clean up test user
  const users = getUsersCollection();
  await users.deleteOne({ email });
});
