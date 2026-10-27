const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { JWT_SECRET, UPLOADS_DIR } = require("../src/config/env");
const {
  connectToMongo,
  closeDb,
  getUsersCollection,
  getPapersCollection,
} = require("../src/models");

let studentY1BToken;
let studentY2AToken;
let teacherToken;
let uploadedPaperId;

const samplePdfPath = path.join(__dirname, "fixtures", "test-document.pdf");

const studentY1B = {
  id: "test-student-y1b-id",
  email: "student.y1b@rca.ac.rw",
  username: "studenty1b",
  name: "Student Y1B",
  role: "student",
  class: "Y1B",
  gender: "female",
  status: "active",
};

const studentY2A = {
  id: "test-student-y2a-id",
  email: "student.y2a@rca.ac.rw",
  username: "studenty2a",
  name: "Student Y2A",
  role: "student",
  class: "Y2A",
  gender: "male",
  status: "active",
};

const teacher = {
  id: "test-teacher-cohort-id",
  email: "teacher.cohort@rca.ac.rw",
  username: "teachercohort",
  name: "Teacher Cohort",
  role: "teacher",
  status: "active",
};

test.before(async () => {
  await connectToMongo();
  if (!fs.existsSync(path.dirname(samplePdfPath))) {
    fs.mkdirSync(path.dirname(samplePdfPath), { recursive: true });
  }
  fs.writeFileSync(samplePdfPath, Buffer.from("%PDF-1.4 sample pdf document for testing upload restrictions\n%%EOF"));

  const users = getUsersCollection();
  await users.deleteMany({
    email: { $in: [studentY1B.email, studentY2A.email, teacher.email] },
  });
  await users.insertMany([studentY1B, studentY2A, teacher]);

  studentY1BToken = jwt.sign(
    { id: studentY1B.id, email: studentY1B.email, username: studentY1B.username, role: studentY1B.role },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  studentY2AToken = jwt.sign(
    { id: studentY2A.id, email: studentY2A.email, username: studentY2A.username, role: studentY2A.role },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  teacherToken = jwt.sign(
    { id: teacher.id, email: teacher.email, username: teacher.username, role: teacher.role },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
});

test.after(async () => {
  const users = getUsersCollection();
  const papers = getPapersCollection();
  await users.deleteMany({
    email: { $in: [studentY1B.email, studentY2A.email, teacher.email] },
  });
  if (uploadedPaperId) {
    await papers.deleteOne({ id: uploadedPaperId });
  }
  if (fs.existsSync(samplePdfPath)) {
    try {
      fs.unlinkSync(samplePdfPath);
    } catch (_) {}
  }
  await closeDb();
});

test("UPLOAD RESTRICTION: Student in Y1B can upload to academic year 1", async () => {
  const res = await request(app)
    .post("/api/upload")
    .set("Authorization", `Bearer ${studentY1BToken}`)
    .field("title", "Year 1 Math Calculus Notes")
    .field("subject", "Mathematics")
    .field("year", "1")
    .field("term", "1")
    .field("type", "Notes")
    .attach("file", samplePdfPath);

  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body.message, /Uploaded to/i);
  assert.ok(res.body.paper);
  uploadedPaperId = res.body.paper.id;
});

test("UPLOAD RESTRICTION: Student in Y1B can upload to cohort Y1B", async () => {
  // Use a modified dummy file so hash differs
  const uniqueDummyPath = path.join(__dirname, "fixtures", `temp-${Date.now()}.pdf`);
  fs.writeFileSync(uniqueDummyPath, Buffer.from(`%PDF-1.4 test unique ${Date.now()}`));

  try {
    const res = await request(app)
      .post("/api/upload")
      .set("Authorization", `Bearer ${studentY1BToken}`)
      .field("title", "Year 1B Algorithm Analysis")
      .field("subject", "Algorithms")
      .field("year", "Y1B")
      .field("classId", "Y1B")
      .field("term", "1")
      .field("type", "Past Paper")
      .attach("file", uniqueDummyPath);

    assert.strictEqual(res.statusCode, 200);
    assert.match(res.body.message, /Uploaded to/i);
    if (res.body.paper?.id) {
      await getPapersCollection().deleteOne({ id: res.body.paper.id });
    }
  } finally {
    if (fs.existsSync(uniqueDummyPath)) fs.unlinkSync(uniqueDummyPath);
  }
});

test("UPLOAD PERMISSION: Student in Y1B can upload to Year 2 subjects", async () => {
  const uniqueDummyPath = path.join(__dirname, "fixtures", `temp-y2-${Date.now()}.pdf`);
  fs.writeFileSync(uniqueDummyPath, Buffer.from(`%PDF-1.4 test unique y2 ${Date.now()}`));

  try {
    const res = await request(app)
      .post("/api/upload")
      .set("Authorization", `Bearer ${studentY1BToken}`)
      .field("title", "Year 2 Software Architecture")
      .field("subject", "Software Architecture")
      .field("year", "2")
      .field("classId", "Y2A")
      .field("term", "1")
      .field("type", "Notes")
      .attach("file", uniqueDummyPath);

    assert.strictEqual(res.statusCode, 200);
    assert.match(res.body.message, /Uploaded to/i);
    assert.ok(res.body.paper);
    if (res.body.paper?.id) {
      await getPapersCollection().deleteOne({ id: res.body.paper.id });
    }
  } finally {
    if (fs.existsSync(uniqueDummyPath)) fs.unlinkSync(uniqueDummyPath);
  }
});

test("ASSIGNMENT RESTRICTION: Student cannot upload type 'assignment'", async () => {
  const res = await request(app)
    .post("/api/upload")
    .set("Authorization", `Bearer ${studentY1BToken}`)
    .field("title", "Forbidden Assignment Upload")
    .field("subject", "Mathematics")
    .field("year", "1")
    .field("term", "1")
    .field("type", "Assignment")
    .attach("file", samplePdfPath);

  assert.strictEqual(res.statusCode, 403);
  assert.match(res.body.error, /only teachers may create assignments/i);
});

test("PAPER DELETION: Uploader can delete their own uploaded paper directly", async () => {
  assert.ok(uploadedPaperId);

  const res = await request(app)
    .delete(`/api/papers/${uploadedPaperId}`)
    .set("Authorization", `Bearer ${studentY1BToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.message, "Paper deleted successfully");

  const paperInDb = await getPapersCollection().findOne({ id: uploadedPaperId });
  assert.strictEqual(paperInDb, null);
  uploadedPaperId = null;
});

test("PAPER DELETION: Non-uploader student cannot delete another user's paper", async () => {
  // Create a paper by Y1B
  const uniqueDummyPath = path.join(__dirname, "fixtures", `temp-y1b-${Date.now()}.pdf`);
  fs.writeFileSync(uniqueDummyPath, Buffer.from(`%PDF-1.4 test owner ${Date.now()}`));
  let paperId;

  try {
    const uploadRes = await request(app)
      .post("/api/upload")
      .set("Authorization", `Bearer ${studentY1BToken}`)
      .field("title", "Y1B Chemistry Midterm")
      .field("subject", "Chemistry")
      .field("year", "1")
      .field("term", "1")
      .field("type", "Past Paper")
      .attach("file", uniqueDummyPath);

    assert.strictEqual(uploadRes.statusCode, 200);
    paperId = uploadRes.body.paper.id;

    // Student Y2A attempts direct deletion
    const delRes = await request(app)
      .delete(`/api/papers/${paperId}`)
      .set("Authorization", `Bearer ${studentY2AToken}`);

    assert.strictEqual(delRes.statusCode, 403);
    assert.match(delRes.body.error, /only delete papers that you uploaded/i);
  } finally {
    if (paperId) await getPapersCollection().deleteOne({ id: paperId });
    if (fs.existsSync(uniqueDummyPath)) fs.unlinkSync(uniqueDummyPath);
  }
});
