"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { io: Client } = require("socket.io-client");
const app = require("../src/app");
const { initSocketServer, disconnectSocketSession } = require("../src/services/socketService");
const {
  connectToMongo,
  getUsersCollection,
  getSessionsCollection,
  closeDb,
} = require("../src/models");
const {
  createSession,
  revokeSession,
  revokeAllUserSessions,
  refreshSession,
  ABSOLUTE_LIMIT_MS,
  IDLE_LIMIT_MS,
} = require("../src/services/sessionService");

test("PART 2 SESSIONS SUITE: Server-side sessions, revocation, refresh, and socket enforcement", async (t) => {
  await connectToMongo();
  const users = getUsersCollection();
  const sessions = getSessionsCollection();

  const userId = crypto.randomUUID();
  const passwordPlain = "SuperSecure@123!";
  const passwordHashed = await bcrypt.hash(passwordPlain, 10);

  const testUser = {
    id: userId,
    email: "session.user@rca.ac.rw",
    username: "sessionuser",
    name: "Session User",
    role: "student",
    class: "Y1A",
    status: "active",
    password: passwordHashed,
    tokenVersion: 1,
    createdAt: new Date().toISOString(),
  };

  await users.insertOne(testUser);

  t.after(async () => {
    await users.deleteMany({ email: "session.user@rca.ac.rw" });
    await sessions.deleteMany({ userId });
  });

  await t.test("2.5.1 Token rejected after logout", async () => {
    // 1. Create session via login
    const loginRes = await request(app)
      .post("/api/login")
      .send({ email: testUser.email, password: passwordPlain });

    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.body.token);
    assert.ok(loginRes.body.sessionId);

    const token = loginRes.body.token;

    // Verify token works on private route
    const check1 = await request(app)
      .get("/api/curriculum")
      .set("Authorization", "Bearer " + token);
    assert.equal(check1.status, 200);

    // Call logout endpoint
    const logoutRes = await request(app)
      .post("/api/logout")
      .set("Authorization", "Bearer " + token)
      .send();
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.body.message, "Logged out successfully");

    // Token must now be rejected
    const check2 = await request(app)
      .get("/api/curriculum")
      .set("Authorization", "Bearer " + token);
    assert.equal(check2.status, 401);
  });

  await t.test("2.5.2 Token rejected after password change", async () => {
    // 1. Log in to get active session
    const loginRes = await request(app)
      .post("/api/login")
      .send({ email: testUser.email, password: passwordPlain });
    assert.equal(loginRes.status, 200);
    const oldToken = loginRes.body.token;

    // 2. Change password
    const newPassword = "BrandNewSecurePassword@999!";
    const changeRes = await request(app)
      .post("/api/change-password")
      .set("Authorization", "Bearer " + oldToken)
      .send({ currentPassword: passwordPlain, newPassword });
    assert.equal(changeRes.status, 200);

    // 3. Old token must now be rejected (tokenVersion bumped, session revoked)
    const checkRes = await request(app)
      .get("/api/curriculum")
      .set("Authorization", "Bearer " + oldToken);
    assert.equal(checkRes.status, 401);

    // Reset password back for other tests
    await users.updateOne(
      { id: userId },
      { $set: { password: passwordHashed } }
    );
  });

  await t.test("2.5.3 Token rejected after account is disabled", async () => {
    const loginRes = await request(app)
      .post("/api/login")
      .send({ email: testUser.email, password: passwordPlain });
    assert.equal(loginRes.status, 200);
    const token = loginRes.body.token;

    // Disable account in database
    await users.updateOne({ id: userId }, { $set: { status: "disabled" } });

    // Request should return 403 Forbidden
    const checkRes = await request(app)
      .get("/api/curriculum")
      .set("Authorization", "Bearer " + token);
    assert.equal(checkRes.status, 403);
    assert.equal(checkRes.body.error, "Account is disabled");

    // Re-enable account
    await users.updateOne({ id: userId }, { $set: { status: "active" } });
  });

  await t.test("2.5.4 Refresh works and respects absolute limit and idle limit", async () => {
    const currentUser = await users.findOne({ id: userId });
    const sessionRes = await createSession(currentUser);
    const originalToken = sessionRes.token;

    // 1. Refreshing active session works
    const refreshRes1 = await request(app)
      .post("/api/auth/refresh")
      .send({ token: originalToken });
    assert.equal(refreshRes1.status, 200);
    assert.ok(refreshRes1.body.token);

    // 2. Test idle limit expiry
    const pastIdle = new Date(Date.now() - (IDLE_LIMIT_MS + 5000));
    await sessions.updateOne(
      { id: sessionRes.sessionId },
      { $set: { lastUsedAt: pastIdle, createdAt: pastIdle } }
    );
    const idleCheck = await refreshSession(originalToken);
    assert.equal(idleCheck.success, false);
    assert.equal(idleCheck.status, 401);

    // Restore lastUsedAt and test absolute limit
    await sessions.updateOne(
      { id: sessionRes.sessionId },
      {
        $set: {
          lastUsedAt: new Date(),
          absoluteExpiresAt: new Date(Date.now() - 5000),
        },
      }
    );
    const absoluteCheck = await refreshSession(originalToken);
    assert.equal(absoluteCheck.success, false);
    assert.equal(absoluteCheck.status, 401);
  });

  await t.test("2.5.5 Two sessions of one user: logging out one leaves the other valid", async () => {
    // Session A
    const loginA = await request(app)
      .post("/api/login")
      .send({ email: testUser.email, password: passwordPlain });
    assert.equal(loginA.status, 200);
    const tokenA = loginA.body.token;

    // Session B
    const loginB = await request(app)
      .post("/api/login")
      .send({ email: testUser.email, password: passwordPlain });
    assert.equal(loginB.status, 200);
    const tokenB = loginB.body.token;

    // Verify both are valid
    const checkA1 = await request(app).get("/api/curriculum").set("Authorization", "Bearer " + tokenA);
    const checkB1 = await request(app).get("/api/curriculum").set("Authorization", "Bearer " + tokenB);
    assert.equal(checkA1.status, 200);
    assert.equal(checkB1.status, 200);

    // Log out Session A
    const logoutA = await request(app)
      .post("/api/logout")
      .set("Authorization", "Bearer " + tokenA)
      .send();
    assert.equal(logoutA.status, 200);

    // Session A must be 401, Session B must still be 200
    const checkA2 = await request(app).get("/api/curriculum").set("Authorization", "Bearer " + tokenA);
    const checkB2 = await request(app).get("/api/curriculum").set("Authorization", "Bearer " + tokenB);
    assert.equal(checkA2.status, 401);
    assert.equal(checkB2.status, 200);
  });

  await t.test("2.5.6 logout-all revokes both sessions", async () => {
    // Session 1
    const login1 = await request(app)
      .post("/api/login")
      .send({ email: testUser.email, password: passwordPlain });
    const token1 = login1.body.token;

    // Session 2
    const login2 = await request(app)
      .post("/api/login")
      .send({ email: testUser.email, password: passwordPlain });
    const token2 = login2.body.token;

    // Call logout-all with session 1
    const logoutAllRes = await request(app)
      .post("/api/logout-all")
      .set("Authorization", "Bearer " + token1)
      .send();
    assert.equal(logoutAllRes.status, 200);

    // Both tokens must now be 401
    const check1 = await request(app).get("/api/curriculum").set("Authorization", "Bearer " + token1);
    const check2 = await request(app).get("/api/curriculum").set("Authorization", "Bearer " + token2);
    assert.equal(check1.status, 401);
    assert.equal(check2.status, 401);
  });

  await t.test("2.5.7 Socket disconnect on session revoke", async () => {
    const server = http.createServer(app);
    initSocketServer(server);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    const currentUserForSocket = await users.findOne({ id: userId });
    const sessionResult = await createSession(currentUserForSocket);
    const validToken = sessionResult.token;

    const socket = Client(`http://127.0.0.1:${port}`, {
      auth: { token: validToken },
      transports: ["websocket"],
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Socket connection timeout")), 4000);
      socket.on("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on("connect_error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    assert.equal(socket.connected, true);

    // Now revoke the session and disconnect matching sockets
    await revokeSession(sessionResult.sessionId);
    disconnectSocketSession(sessionResult.sessionId);

    // Socket should receive disconnect event
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Socket disconnect timeout")), 4000);
      socket.on("disconnect", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    socket.close();
    const { getIo } = require("../src/services/socketService");
    const currentIo = getIo();
    if (currentIo) {
      await new Promise((resolve) => currentIo.close(resolve));
    }
    await new Promise((resolve) => server.close(resolve));
  });
});
