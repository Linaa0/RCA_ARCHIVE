const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../src/app");
const { connectToMongo, closeDb, getUsersCollection, getPendingSignupsCollection } = require("../src/models");

test("PROD: Simulated SMTP failure in production returns clear user-facing error and does not use Ethereal", async () => {
  await connectToMongo();

  const originalEnv = process.env.NODE_ENV;
  const originalHost = process.env.SMTP_HOST;
  const originalPort = process.env.SMTP_PORT;
  const originalUser = process.env.SMTP_USER;
  const originalPass = process.env.SMTP_PASS;

  process.env.NODE_ENV = "production";
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = "1";
  process.env.SMTP_USER = "test@rca.ac.rw";
  process.env.SMTP_PASS = "mockpassword123";

  try {
    const email = "prodfail.student@rca.ac.rw";
    const users = getUsersCollection();
    const pending = getPendingSignupsCollection();

    await users.deleteMany({ email });
    await pending.deleteMany({ email });

    const res = await request(app)
      .post("/api/send-otp")
      .send({
        email,
        operation: "signup",
        fullName: "Production Failure Student",
        username: "prodfailstudent",
        password: "ValidPassword123@",
        class: "Y1A",
        gender: "female",
      });

    // In production with real SMTP failing/unreachable, it must return 500 with the exact safe user message
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.error, "We could not send the email right now. Please try again in a minute.");

    // Clean up
    await pending.deleteMany({ email });
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.SMTP_HOST = originalHost;
    process.env.SMTP_PORT = originalPort;
    process.env.SMTP_USER = originalUser;
    process.env.SMTP_PASS = originalPass;
    await closeDb();
  }
});
