"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const app = require("../src/app");
const { JWT_SECRET, UPLOADS_DIR } = require("../src/config/env");
const {
  connectToMongo,
  getUsersCollection,
  getPapersCollection,
  getAssignmentsCollection,
  getNotificationsCollection,
  getTeacherResourcesCollection,
  closeDb,
} = require("../src/models");

test("PART 1 SECURITY SUITE: Deny by default, authorization, and response minimization", async (t) => {
  await connectToMongo();
  const users = getUsersCollection();
  const papers = getPapersCollection();
  const assignments = getAssignmentsCollection();
  const notifications = getNotificationsCollection();
  const resources = getTeacherResourcesCollection();

  const studentAId = crypto.randomUUID();
  const studentBId = crypto.randomUUID();
  const teacherAId = crypto.randomUUID();
  const teacherBId = crypto.randomUUID();
  const adminId = crypto.randomUUID();

  const studentA = {
    id: studentAId,
    email: "student.a@rca.ac.rw",
    username: "studenta",
    name: "Student Alpha",
    role: "student",
    class: "Y1A",
    status: "active",
    createdAt: new Date().toISOString(),
  };

  const studentB = {
    id: studentBId,
    email: "student.b@rca.ac.rw",
    username: "studentb",
    name: "Student Beta",
    role: "student",
    class: "Y2A",
    status: "active",
    createdAt: new Date().toISOString(),
  };

  const teacherA = {
    id: teacherAId,
    email: "teacher.a@rca.ac.rw",
    username: "teachera",
    name: "Teacher Alpha",
    role: "teacher",
    status: "active",
    createdAt: new Date().toISOString(),
  };

  const teacherB = {
    id: teacherBId,
    email: "teacher.b@rca.ac.rw",
    username: "teacherb",
    name: "Teacher Beta",
    role: "teacher",
    status: "active",
    createdAt: new Date().toISOString(),
  };

  const admin = {
    id: adminId,
    email: "admin.sec@rca.ac.rw",
    username: "adminsec",
    name: "Security Admin",
    role: "admin",
    status: "active",
    createdAt: new Date().toISOString(),
  };

  await users.insertMany([studentA, studentB, teacherA, teacherB, admin]);

  const studentAToken = jwt.sign(
    { id: studentA.id, email: studentA.email, username: studentA.username, role: studentA.role },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

  const studentBToken = jwt.sign(
    { id: studentB.id, email: studentB.email, username: studentB.username, role: studentB.role },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

  const teacherAToken = jwt.sign(
    { id: teacherA.id, email: teacherA.email, username: teacherA.username, role: teacherA.role },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

  const teacherBToken = jwt.sign(
    { id: teacherB.id, email: teacherB.email, username: teacherB.username, role: teacherB.role },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

  const adminToken = jwt.sign(
    { id: admin.id, email: admin.email, username: admin.username, role: admin.role },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

  const testPaperId = crypto.randomUUID();
  const testPaper = {
    id: testPaperId,
    title: "Security Test Paper",
    subject: "Mathematics",
    year: "Y1",
    classId: "Y1A",
    isClassRestricted: true,
    term: 1,
    type: "past_paper",
    category: "past_paper",
    filename: `${testPaperId}.pdf`,
    originalName: "calculus_test.pdf",
    hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    uploadedBy: studentA.username,
    uploadedByEmail: studentA.email,
    uploadedById: studentA.id,
    uploadedAt: new Date().toISOString(),
    ratings: [],
  };
  await papers.insertOne(testPaper);

  const testPaperFilePath = path.join(UPLOADS_DIR, testPaper.filename);
  fs.writeFileSync(testPaperFilePath, "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");

  const testAssignmentId = crypto.randomUUID();
  const testAssignment = {
    id: testAssignmentId,
    title: "Class Y1A Assignment",
    description: "Strictly for Class Y1A",
    subject: "Mathematics",
    term: 1,
    deadline: new Date(Date.now() + 86400000).toISOString(),
    classes: ["Y1A"],
    teacherId: teacherA.id,
    teacherName: teacherA.name,
    teacherEmail: teacherA.email,
    createdAt: new Date().toISOString(),
  };
  await assignments.insertOne(testAssignment);

  const testNotificationId = crypto.randomUUID();
  const testNotification = {
    id: testNotificationId,
    userId: studentA.id,
    title: "Private Notification",
    message: "Sensitive notice for Student A only",
    read: false,
    createdAt: new Date().toISOString(),
  };
  await notifications.insertOne(testNotification);

  const testResourceId = crypto.randomUUID();
  const testResource = {
    id: testResourceId,
    title: "Teacher A Resource",
    type: "notes",
    subject: "Mathematics",
    year: "Y1",
    term: 1,
    filename: `${testResourceId}.pdf`,
    originalName: "teacher_a_notes.pdf",
    teacherId: teacherA.id,
    teacherName: teacherA.name,
    uploadedAt: new Date().toISOString(),
  };
  await resources.insertOne(testResource);

  t.after(async () => {
    await users.deleteMany({ id: { $in: [studentAId, studentBId, teacherAId, teacherBId, adminId] } });
    await papers.deleteOne({ id: testPaperId });
    await assignments.deleteOne({ id: testAssignmentId });
    await notifications.deleteOne({ id: testNotificationId });
    await resources.deleteOne({ id: testResourceId });
    if (fs.existsSync(testPaperFilePath)) {
      try {
        fs.unlinkSync(testPaperFilePath);
      } catch (_) {}
    }
    await closeDb();
  });

  await t.test("1.1 Deny by default: protected routes return 401 when unauthenticated", async () => {
    const protectedGetRoutes = [
      "/api/papers",
      "/api/curriculum",
      "/api/papers/dashboard",
      "/api/stats",
      "/api/users",
      "/api/me",
      "/api/notifications",
      "/api/assignments",
      "/api/subject-materials?subject=Mathematics",
    ];

    for (const route of protectedGetRoutes) {
      const res = await request(app).get(route);
      assert.strictEqual(
        res.status,
        401,
        `Expected ${route} to deny unauthenticated request with 401, got ${res.status}`
      );
      assert.strictEqual(typeof res.body.error, "string");
    }
  });

  await t.test("1.1 Public allowlist routes allow access without authentication", async () => {
    const healthRes = await request(app)
      .get("/api/health")
      .set("X-Forwarded-For", "203.0.113.1");
    assert.strictEqual(healthRes.status, 200);
    assert.deepStrictEqual(healthRes.body, { status: "ok" });

    const localHealthRes = await request(app).get("/api/health");
    assert.strictEqual(localHealthRes.status, 200);
    assert.strictEqual(localHealthRes.body.server, "ok");
    assert.strictEqual(localHealthRes.body.database, "connected");

    const pubCurrRes = await request(app).get("/api/public/curriculum");
    assert.strictEqual(pubCurrRes.status, 200);
    assert.strictEqual(pubCurrRes.body.status, "ok");
    assert.ok(Array.isArray(pubCurrRes.body.promotions));
    assert.ok(Array.isArray(pubCurrRes.body.terms));
    assert.strictEqual(pubCurrRes.headers["cache-control"], "public, max-age=60");

    const pubSumRes = await request(app).get("/api/public/summary");
    assert.strictEqual(pubSumRes.status, 200);
    assert.strictEqual(pubSumRes.body.status, "ok");
    assert.strictEqual(typeof pubSumRes.body.approximatePapers, "number");
    assert.strictEqual(pubSumRes.headers["cache-control"], "public, max-age=60");

    const loginRes = await request(app).post("/api/login").send({});
    assert.strictEqual(loginRes.status, 400);

    const signupRes = await request(app).post("/api/signup").send({});
    assert.strictEqual(signupRes.status, 400);
  });

  await t.test("1.2 Object-level authorization: papers access restriction", async () => {
    const resA = await request(app)
      .get(`/api/papers/${testPaperId}`)
      .set("Authorization", `Bearer ${studentAToken}`);
    assert.strictEqual(resA.status, 200);

    const resB = await request(app)
      .get(`/api/papers/${testPaperId}`)
      .set("Authorization", `Bearer ${studentBToken}`);
    assert.strictEqual(resB.status, 403);
  });

  await t.test("1.2 Object-level authorization: assignments access restriction", async () => {
    const resStudentA = await request(app)
      .get(`/api/assignments/${testAssignmentId}`)
      .set("Authorization", `Bearer ${studentAToken}`);
    assert.strictEqual(resStudentA.status, 200);

    const resStudentB = await request(app)
      .get(`/api/assignments/${testAssignmentId}`)
      .set("Authorization", `Bearer ${studentBToken}`);
    assert.ok(resStudentB.status === 403 || resStudentB.status === 404);

    const resTeacherB = await request(app)
      .get(`/api/assignments/${testAssignmentId}`)
      .set("Authorization", `Bearer ${teacherBToken}`);
    assert.strictEqual(resTeacherB.status, 403);
  });

  await t.test("1.2 Object-level authorization: notifications access restriction", async () => {
    const resForbidden = await request(app)
      .patch(`/api/notifications/${testNotificationId}/read`)
      .set("Authorization", `Bearer ${studentBToken}`);
    assert.strictEqual(resForbidden.status, 404);

    const resAllowed = await request(app)
      .patch(`/api/notifications/${testNotificationId}/read`)
      .set("Authorization", `Bearer ${studentAToken}`);
    assert.strictEqual(resAllowed.status, 200);
  });

  await t.test("1.2 Object-level authorization: user profiles access restriction", async () => {
    const resForbidden = await request(app)
      .get(`/api/users/${studentAId}`)
      .set("Authorization", `Bearer ${studentBToken}`);
    assert.strictEqual(resForbidden.status, 403);

    const resSelf = await request(app)
      .get(`/api/users/${studentAId}`)
      .set("Authorization", `Bearer ${studentAToken}`);
    assert.strictEqual(resSelf.status, 200);

    const resAdmin = await request(app)
      .get(`/api/users/${studentAId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(resAdmin.status, 200);
  });

  await t.test("1.4 Response minimization: students never receive other users' emails, file hashes, or stored paths", async () => {
    const res = await request(app)
      .get("/api/papers")
      .set("Authorization", `Bearer ${studentAToken}`);
    assert.strictEqual(res.status, 200);

    const items = res.body.items || res.body;
    for (const item of items) {
      if (item.id !== testPaperId) {
        assert.strictEqual(item.uploadedByEmail, undefined);
      }
      assert.strictEqual(item.hash, undefined);
      assert.strictEqual(item.filename, undefined);
      assert.strictEqual(item.filePath, undefined);
      assert.strictEqual(item._id, undefined);
      assert.strictEqual(item.ip, undefined);
      assert.strictEqual(item.password, undefined);
    }
  });

  await t.test("1.5 Identifiers and signed access link: 128-bit randomness and 10m expiry", async () => {
    const res = await request(app)
      .post(`/api/papers/${testPaperId}/access-link`)
      .set("Authorization", `Bearer ${studentAToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.viewUrl);
    assert.ok(res.body.downloadUrl);

    const tokenMatch = res.body.viewUrl.match(/\/api\/papers\/access\/([^/]+)\/view/);
    assert.ok(tokenMatch, "viewUrl must match signed access format");
    const token = tokenMatch[1];
    const parts = token.split(".");
    assert.strictEqual(parts.length, 5, "Token must consist of 5 parts: paperId.action.expiresAt.nonce.sig");

    const nonce = parts[3];
    assert.match(nonce, /^[0-9a-f]{32}$/, "Nonce must carry at least 128 bits (32 hex characters)");

    const expiresAt = Number(parts[2]);
    const diffMs = expiresAt - Date.now();
    assert.ok(diffMs > 9 * 60 * 1000 && diffMs <= 10 * 60 * 1000, "Expiry must be approximately 10 minutes");
  });

  await t.test("1.6 Anti-fingerprinting: no X-Powered-By, minimal public health body", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("X-Forwarded-For", "203.0.113.1");
    assert.strictEqual(res.headers["x-powered-by"], undefined);
    assert.strictEqual(res.body.version, undefined);
    assert.strictEqual(res.body.databaseName, undefined);
    assert.strictEqual(res.body.startTime, undefined);
    assert.strictEqual(res.body.allowedCorsOriginsCount, undefined);
  });
});
