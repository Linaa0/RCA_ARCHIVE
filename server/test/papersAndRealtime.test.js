const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { io: ClientIo } = require("socket.io-client");
const app = require("../src/app");
const { JWT_SECRET } = require("../src/config/env");
const {
  connectToMongo,
  closeDb,
  getPapersCollection,
  getNotificationsCollection,
} = require("../src/models");
const {
  signAccessLink,
  verifyAccessLink,
  formatContentDisposition,
  buildDashboardSummary,
} = require("../src/controllers/paperController");
const { initSocketServer } = require("../src/services/socketService");

let testToken;
let testPaper;
let testNotification;
let serverInstance;
let serverPort;

const testUser = {
  id: "test-student-realtime-id",
  email: "student.realtime@rca.ac.rw",
  username: "studentrealtime",
  role: "student",
  class: "Y2A",
};

test("SETUP: database, test fixtures, and socket server", async () => {
  await connectToMongo();

  const users = require("../src/models").getUsersCollection();
  await users.updateOne(
    { email: testUser.email },
    { $set: { ...testUser, status: "active", createdAt: new Date().toISOString() } },
    { upsert: true }
  );

  testToken = jwt.sign(testUser, JWT_SECRET, { expiresIn: "1h" });

  const papers = getPapersCollection();
  const { UPLOADS_DIR } = require("../src/config/env");
  const fs = require("fs");
  const path = require("path");
  const dummyFilePath = path.join(UPLOADS_DIR, "sample-test-paper.pdf");
  fs.writeFileSync(dummyFilePath, "%PDF-1.4 sample pdf content");

  testPaper = {
    id: "test-paper-realtime-" + Date.now(),
    title: "Realtime Systems & Networks",
    subject: "Computer Science",
    year: "Y2",
    classId: "Y2A",
    type: "past_paper",
    category: "past_paper",
    filename: "sample-test-paper.pdf",
    originalName: "Examen Final Réseaux & Systèmes (2025).pdf",
    uploadedBy: "studentrealtime",
    uploadedByEmail: testUser.email,
    uploadedById: testUser.id,
    uploadedAt: new Date().toISOString(),
    ratings: [],
  };
  await papers.insertOne(testPaper);

  const notifications = getNotificationsCollection();
  testNotification = {
    id: "notif-test-" + Date.now(),
    userId: testUser.id,
    title: "New Assignment Available",
    message: "A new past paper was published for Y2A.",
    type: "info",
    link: `/view/${testPaper.id}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  await notifications.insertOne(testNotification);

  // Start HTTP server for socket testing
  serverInstance = http.createServer(app);
  initSocketServer(serverInstance);
  await new Promise((resolve) => {
    serverInstance.listen(0, () => {
      serverPort = serverInstance.address().port;
      resolve();
    });
  });
});

test("CONTENT DISPOSITION: correctly formats ASCII fallback and UTF-8 encoded name", () => {
  const header = formatContentDisposition("inline", "Examen Final Réseaux & Systèmes (2025).pdf");
  assert.ok(header.startsWith("inline; filename="));
  assert.ok(header.includes("filename*="));
  assert.ok(header.includes("UTF-8''"));
});

test("DASHBOARD SUMMARY: matches uploader identity and normalizes legacy year labels", () => {
  const summary = buildDashboardSummary(
    [
      { id: "assignment", year: "Y1", classId: "Y1A", type: "Assignment" },
      { ...testPaper, type: "past_paper" },
      { id: "legacy-one", year: "Year 1", class: "Year 1", type: "Notes", hash: "same-paper" },
      { id: "legacy-two", year: "Y1", class: "Year Y1", type: "past_paper", hash: "same-paper" },
      { id: "old-cohort-paper", year: "Y1", classId: "Y1", uploaderClassId: "Y1A", type: "past_paper" },
      { id: "second-old-cohort-paper", year: "Y1", classId: "Y1", uploaderClassId: "Y1A", type: "past_paper" },
      { id: "genai", year: "Y1GenAI", classId: "Y1GenAI", type: "Notes" },
    ],
    testUser
  );

  assert.strictEqual(summary.totalPapers, 7);
  assert.strictEqual(summary.myUploadsCount, 1);
  assert.strictEqual(summary.myUploads[0].id, testPaper.id);
  assert.strictEqual(summary.topClasses[0].className, "Year 1A");
  assert.ok(summary.topClasses.some((cohort) => cohort.className === "Year 1A" && cohort.count === 3));
  assert.strictEqual(summary.topClasses.reduce((sum, cohort) => sum + cohort.count, 0), 4);
  assert.strictEqual(summary.recentPapers.length, 4);
  assert.strictEqual(summary.recentPapers.some((paper) => paper.type === "Assignment"), true);
  const genAiSummary = buildDashboardSummary(
    [{ id: "genai-only", year: "Y1GenAI", classId: "Y1GenAI", type: "Notes" }],
    testUser
  );
  assert.strictEqual(genAiSummary.topClasses[0].className, "Year 1 Gen AI");
});

test("PAPERS API: year and search filters are applied together", async () => {
  const matching = await request(app).get("/api/papers?year=Y2&search=Realtime");
  const notMatching = await request(app).get("/api/papers?year=Y2&search=missing-title");

  assert.strictEqual(matching.status, 200);
  assert.ok(matching.body.some((paper) => paper.id === testPaper.id));
  assert.strictEqual(notMatching.status, 200);
  assert.strictEqual(notMatching.body.some((paper) => paper.id === testPaper.id), false);
});

test("DASHBOARD API: returns authenticated uploads and top-two cohort summary", async () => {
  const res = await request(app)
    .get("/api/papers/dashboard")
    .set("Authorization", `Bearer ${testToken}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.myUploadsCount, 1);
  assert.ok(res.body.myUploads.some((paper) => paper.id === testPaper.id));
  assert.ok(res.body.topClasses.length <= 2);
  assert.ok(res.body.recentPapers.length <= 4);
});

test("ACCESS LINK: HMAC signature and verification functions", () => {
  const paperId = "test-paper-123";
  const futureExpiry = Date.now() + 60000;
  const token = signAccessLink(paperId, "view", futureExpiry);

  const result = verifyAccessLink(token);
  assert.ok(result);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.paperId, paperId);
  assert.strictEqual(result.action, "view");

  // Tampered signature
  const tamperedToken = token.slice(0, -4) + "XXXX";
  const tamperedResult = verifyAccessLink(tamperedToken);
  assert.strictEqual(tamperedResult, null);

  // Expired token
  const pastExpiry = Date.now() - 5000;
  const expiredToken = signAccessLink(paperId, "view", pastExpiry);
  const expiredResult = verifyAccessLink(expiredToken);
  assert.ok(expiredResult);
  assert.strictEqual(expiredResult.expired, true);
});

test("ACCESS LINK API: POST /api/papers/:id/access-link generates valid access tokens", async () => {
  const res = await request(app)
    .post(`/api/papers/${testPaper.id}/access-link`)
    .set("Authorization", `Bearer ${testToken}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.paperId, testPaper.id);
  assert.ok(res.body.viewUrl);
  assert.ok(res.body.downloadUrl);
  assert.ok(res.body.expiresAt);
});

test("ACCESS FILE API: GET /api/papers/access/:token/view rejects tampered signatures with 403", async () => {
  const futureExpiry = Date.now() + 60000;
  const validToken = signAccessLink(testPaper.id, "view", futureExpiry);
  const tamperedToken = validToken.slice(0, -6) + "XXXXXX";
  const res = await request(app).get(`/api/papers/access/${tamperedToken}/view`);
  assert.strictEqual(res.status, 403);
});

test("ACCESS FILE API: GET /api/papers/access/:token/view rejects expired signatures with 410", async () => {
  const pastExpiry = Date.now() - 5000;
  const expiredToken = signAccessLink(testPaper.id, "view", pastExpiry);
  const res = await request(app).get(`/api/papers/access/${expiredToken}/view`);
  assert.strictEqual(res.status, 410);
});

test("NOTIFICATIONS API: GET /api/notifications returns list and unread count", async () => {
  const res = await request(app)
    .get("/api/notifications")
    .set("Authorization", `Bearer ${testToken}`);

  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.notifications));
  assert.ok(res.body.unreadCount >= 1);
  const found = res.body.notifications.find((n) => n.id === testNotification.id);
  assert.ok(found);
  assert.strictEqual(found.read, false);
});

test("NOTIFICATIONS API: PATCH /api/notifications/:id/read marks single notification as read", async () => {
  const res = await request(app)
    .patch(`/api/notifications/${testNotification.id}/read`)
    .set("Authorization", `Bearer ${testToken}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);

  const check = await request(app)
    .get("/api/notifications")
    .set("Authorization", `Bearer ${testToken}`);
  const found = check.body.notifications.find((n) => n.id === testNotification.id);
  assert.ok(found);
  assert.strictEqual(found.read, true);
});

test("NOTIFICATIONS API: POST /api/notifications/mark-all-read marks all as read", async () => {
  const res = await request(app)
    .post("/api/notifications/mark-all-read")
    .set("Authorization", `Bearer ${testToken}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);

  const check = await request(app)
    .get("/api/notifications")
    .set("Authorization", `Bearer ${testToken}`);
  assert.strictEqual(check.body.unreadCount, 0);
});

test("SOCKET IO: Connection without auth token is rejected", async () => {
  const socket = ClientIo(`http://127.0.0.1:${serverPort}`, {
    transports: ["websocket"],
    reconnection: false,
  });

  const err = await new Promise((resolve) => {
    socket.on("connect_error", (error) => resolve(error));
  });

  assert.ok(err);
  assert.ok(err.message.includes("token required"));
  socket.close();
});

test("SOCKET IO: Connection with valid JWT authenticates and connects", async () => {
  const socket = ClientIo(`http://127.0.0.1:${serverPort}`, {
    auth: { token: testToken },
    transports: ["websocket"],
    reconnection: false,
  });

  const connected = await new Promise((resolve) => {
    socket.on("connect", () => resolve(true));
    socket.on("connect_error", () => resolve(false));
  });

  assert.strictEqual(connected, true);
  socket.close();
});

test("TEARDOWN: clean up database fixtures and close server", async () => {
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
  }
  const papers = getPapersCollection();
  await papers.deleteOne({ id: testPaper.id });
  try {
    const { UPLOADS_DIR } = require("../src/config/env");
    const fs = require("fs");
    const path = require("path");
    fs.unlinkSync(path.join(UPLOADS_DIR, "sample-test-paper.pdf"));
  } catch (_) {}
  const notifications = getNotificationsCollection();
  await notifications.deleteMany({ userId: testUser.id });
  const users = require("../src/models").getUsersCollection();
  await users.deleteMany({ email: testUser.email });
  await closeDb();
});
