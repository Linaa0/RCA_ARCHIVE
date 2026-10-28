const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { JWT_SECRET } = require("../src/config/env");
const {
  connectToMongo,
  closeDb,
  getUsersCollection,
  getPapersCollection,
  getTeacherResourcesCollection,
  getAssignmentsCollection,
} = require("../src/models");

let student1Token;
let student2Token;
let teacher1Token;
let teacher2Token;
let adminToken;

const samplePdfPath = path.join(__dirname, "fixtures", "terms-test-doc.pdf");

const student1 = {
  id: "test-terms-student1",
  email: "terms.student1@rca.ac.rw",
  username: "termsstudent1",
  name: "Terms Student One",
  role: "student",
  class: "Y1A",
  status: "active",
};

const student2 = {
  id: "test-terms-student2",
  email: "terms.student2@rca.ac.rw",
  username: "termsstudent2",
  name: "Terms Student Two",
  role: "student",
  class: "Y1A",
  status: "active",
};

const teacher1 = {
  id: "test-terms-teacher1",
  email: "terms.teacher1@rca.ac.rw",
  username: "termsteacher1",
  name: "Terms Teacher One",
  role: "teacher",
  status: "active",
};

const teacher2 = {
  id: "test-terms-teacher2",
  email: "terms.teacher2@rca.ac.rw",
  username: "termsteacher2",
  name: "Terms Teacher Two",
  role: "teacher",
  status: "active",
};

const adminUser = {
  id: "test-terms-admin",
  email: "terms.admin@rca.ac.rw",
  username: "termsadmin",
  name: "Terms Admin",
  role: "admin",
  status: "active",
};

let uploadedPaperId = null;

test.before(async () => {
  await connectToMongo();
  if (!fs.existsSync(path.dirname(samplePdfPath))) {
    fs.mkdirSync(path.dirname(samplePdfPath), { recursive: true });
  }
  const validPdf = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n115\n%%EOF"
  );
  fs.writeFileSync(samplePdfPath, validPdf);

  const users = getUsersCollection();
  for (const u of [student1, student2, teacher1, teacher2, adminUser]) {
    await users.updateOne(
      { email: u.email },
      { $set: { ...u, createdAt: new Date().toISOString() } },
      { upsert: true }
    );
  }

  student1Token = jwt.sign(student1, JWT_SECRET, { expiresIn: "1h" });
  student2Token = jwt.sign(student2, JWT_SECRET, { expiresIn: "1h" });
  teacher1Token = jwt.sign(teacher1, JWT_SECRET, { expiresIn: "1h" });
  teacher2Token = jwt.sign(teacher2, JWT_SECRET, { expiresIn: "1h" });
  adminToken = jwt.sign(adminUser, JWT_SECRET, { expiresIn: "1h" });
});

test.after(async () => {
  const users = getUsersCollection();
  for (const u of [student1, student2, teacher1, teacher2, adminUser]) {
    await users.deleteOne({ email: u.email });
  }
  await getPapersCollection().deleteMany({ subject: "Terms Testing Subject" });
  await getTeacherResourcesCollection().deleteMany({ subject: "Terms Testing Subject" });
  await getAssignmentsCollection().deleteMany({ subject: "Terms Testing Subject" });

  if (fs.existsSync(samplePdfPath)) {
    try {
      fs.unlinkSync(samplePdfPath);
    } catch (_) {}
  }
  await closeDb();
});

test("CURRICULUM: GET /api/curriculum includes terms list and labels", async () => {
  const res = await request(app)
    .get("/api/curriculum")
    .set("Authorization", `Bearer ${student1Token}`);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.terms));
  assert.strictEqual(res.body.terms.length, 3);
  assert.strictEqual(res.body.terms[0].id, 1);
  assert.strictEqual(res.body.terms[0].label, "Term 1");
  assert.strictEqual(res.body.terms[1].id, 2);
  assert.strictEqual(res.body.terms[1].label, "Term 2");
  assert.strictEqual(res.body.terms[2].id, 3);
  assert.strictEqual(res.body.terms[2].label, "Term 3");
});

test("UPLOAD: rejects upload without term with 400 and field 'term'", async () => {
  const res = await request(app)
    .post("/api/upload")
    .set("Authorization", `Bearer ${student1Token}`)
    .field("title", "Math Paper Without Term")
    .field("subject", "Terms Testing Subject")
    .field("year", "Y1A")
    .field("classId", "Y1A")
    .field("type", "Notes")
    .attach("file", samplePdfPath);

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.field, "term");
  assert.match(res.body.error, /Choose Term 1, Term 2 or Term 3/i);

  const found = await getPapersCollection().findOne({ title: "Math Paper Without Term" });
  assert.strictEqual(found, null);
});

test("UPLOAD: rejects upload with invalid term with 400 and field 'term'", async () => {
  const res = await request(app)
    .post("/api/upload")
    .set("Authorization", `Bearer ${student1Token}`)
    .field("title", "Math Paper Invalid Term")
    .field("subject", "Terms Testing Subject")
    .field("year", "Y1A")
    .field("classId", "Y1A")
    .field("term", "Term 5")
    .field("type", "Notes")
    .attach("file", samplePdfPath);

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.field, "term");
  assert.match(res.body.error, /Choose Term 1, Term 2 or Term 3/i);
});

test("UPLOAD: accepts valid term (stored as number 1, 2, or 3)", async () => {
  const res = await request(app)
    .post("/api/upload")
    .set("Authorization", `Bearer ${student1Token}`)
    .field("title", "Math Paper Term 1")
    .field("subject", "Terms Testing Subject")
    .field("year", "Y1A")
    .field("classId", "Y1A")
    .field("term", "Term 1")
    .field("type", "Notes")
    .attach("file", samplePdfPath);

  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.paper);
  assert.strictEqual(res.body.paper.term, 1);
  assert.match(res.body.message, /Uploaded to .*Term 1/i);
  uploadedPaperId = res.body.paper.id;
});

test("UPLOAD: duplicate file upload returns 409 with location containing term", async () => {
  const res = await request(app)
    .post("/api/upload")
    .set("Authorization", `Bearer ${student2Token}`)
    .field("title", "Duplicate File Attempt")
    .field("subject", "Terms Testing Subject")
    .field("year", "Y1A")
    .field("classId", "Y1A")
    .field("term", "2")
    .field("type", "Notes")
    .attach("file", samplePdfPath);

  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.error, "duplicate");
  assert.match(res.body.message, /already exists in/i);
  assert.match(res.body.message, /Term 1/i);
  assert.ok(res.body.existingPaper);
  assert.strictEqual(res.body.existingPaper.term, 1);
  assert.strictEqual(res.body.existingPaper.termLabel, "Term 1");
});

test("PAPERS LIST: returns term and termCounts with withMeta=1", async () => {
  const res = await request(app)
    .get("/api/papers?subject=Terms%20Testing%20Subject&withMeta=1")
    .set("Authorization", `Bearer ${student1Token}`);

  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.termCounts);
  assert.strictEqual(res.body.termCounts[1], 1);
  assert.strictEqual(res.body.termCounts[2], 0);
  assert.strictEqual(res.body.termCounts[3], 0);
  assert.strictEqual(res.body.termCounts.unset, 0);
  assert.ok(Array.isArray(res.body.items));
  assert.strictEqual(res.body.items[0].term, 1);
});

test("PAPERS LIST: term filter works", async () => {
  const resMatch = await request(app)
    .get("/api/papers?subject=Terms%20Testing%20Subject&term=1&withMeta=1")
    .set("Authorization", `Bearer ${student1Token}`);
  assert.strictEqual(resMatch.statusCode, 200);
  assert.strictEqual(resMatch.body.items.length, 1);

  const resMiss = await request(app)
    .get("/api/papers?subject=Terms%20Testing%20Subject&term=2&withMeta=1")
    .set("Authorization", `Bearer ${student1Token}`);
  assert.strictEqual(resMiss.statusCode, 200);
  assert.strictEqual(resMiss.body.items.length, 0);
});

test("PUT /api/papers/:id: permission matrix for changing term", async () => {
  assert.ok(uploadedPaperId);

  // Different student gets 403
  const student2Res = await request(app)
    .put(`/api/papers/${uploadedPaperId}`)
    .set("Authorization", `Bearer ${student2Token}`)
    .send({ term: 2 });
  assert.strictEqual(student2Res.statusCode, 403);

  // Uploader student allowed
  const uploaderRes = await request(app)
    .put(`/api/papers/${uploadedPaperId}`)
    .set("Authorization", `Bearer ${student1Token}`)
    .send({ term: 2 });
  assert.strictEqual(uploaderRes.statusCode, 200);
  assert.strictEqual(uploaderRes.body.paper.term, 2);

  // Another teacher allowed
  const teacher2Res = await request(app)
    .put(`/api/papers/${uploadedPaperId}`)
    .set("Authorization", `Bearer ${teacher2Token}`)
    .send({ term: 3 });
  assert.strictEqual(teacher2Res.statusCode, 200);
  assert.strictEqual(teacher2Res.body.paper.term, 3);

  // Admin allowed
  const adminRes = await request(app)
    .put(`/api/papers/${uploadedPaperId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ term: 1 });
  assert.strictEqual(adminRes.statusCode, 200);
  assert.strictEqual(adminRes.body.paper.term, 1);
});

test("ADMIN BULK: PATCH /api/admin/papers/term is admin only and updates papers", async () => {
  assert.ok(uploadedPaperId);

  // Student forbidden
  const studentRes = await request(app)
    .patch("/api/admin/papers/term")
    .set("Authorization", `Bearer ${student1Token}`)
    .send({ ids: [uploadedPaperId], term: 2 });
  assert.strictEqual(studentRes.statusCode, 403);

  // Admin succeeds
  const adminRes = await request(app)
    .patch("/api/admin/papers/term")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ ids: [uploadedPaperId], term: 2 });
  assert.strictEqual(adminRes.statusCode, 200);
  assert.strictEqual(adminRes.body.changed, 1);
  assert.strictEqual(adminRes.body.term, 2);

  const paperInDb = await getPapersCollection().findOne({ id: uploadedPaperId });
  assert.strictEqual(paperInDb.term, 2);
});

test("ADMIN STATS: GET /api/admin/stats includes papersByTerm and papersByYearTerm", async () => {
  const res = await request(app)
    .get("/api/admin/stats")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.papersByTerm);
  assert.strictEqual(typeof res.body.papersByTerm[1], "number");
  assert.strictEqual(typeof res.body.papersByTerm[2], "number");
  assert.strictEqual(typeof res.body.papersByTerm[3], "number");
  assert.strictEqual(typeof res.body.papersByTerm.unset, "number");

  assert.ok(res.body.papersByYearTerm);
  assert.ok(res.body.papersByYearTerm.Y1);
  assert.ok(res.body.papersByYearTerm.Y2);
  assert.ok(res.body.papersByYearTerm.Y3);
  assert.strictEqual(typeof res.body.papersByYearTerm.Y1[1], "number");
  assert.strictEqual(typeof res.body.papersByYearTerm.Y1[2], "number");
  assert.strictEqual(typeof res.body.papersByYearTerm.Y1[3], "number");
  assert.strictEqual(typeof res.body.papersByYearTerm.Y1.unset, "number");
});

test("ASSIGNMENT: requires term on creation and allows term update", async () => {
  // Reject without term
  const resNoTerm = await request(app)
    .post("/api/assignments")
    .set("Authorization", `Bearer ${teacher1Token}`)
    .field("title", "Terms Assignment Lab")
    .field("subject", "Terms Testing Subject")
    .field("deadline", new Date(Date.now() + 86400000).toISOString())
    .field("classes", "Y1A");
  assert.strictEqual(resNoTerm.statusCode, 400);
  assert.strictEqual(resNoTerm.body.field, "term");

  // Create with term
  const resCreated = await request(app)
    .post("/api/assignments")
    .set("Authorization", `Bearer ${teacher1Token}`)
    .field("title", "Terms Assignment Lab")
    .field("subject", "Terms Testing Subject")
    .field("term", "1")
    .field("deadline", new Date(Date.now() + 86400000).toISOString())
    .field("classes", "Y1A");
  assert.strictEqual(resCreated.statusCode, 201);
  assert.strictEqual(resCreated.body.assignment.term, 1);
  const assignmentId = resCreated.body.assignment.id;

  // Teacher 2 (not owner) cannot change term
  const resOtherTeacher = await request(app)
    .patch(`/api/assignments/${assignmentId}/term`)
    .set("Authorization", `Bearer ${teacher2Token}`)
    .send({ term: 2 });
  assert.strictEqual(resOtherTeacher.statusCode, 403);

  // Owner teacher can change term
  const resOwner = await request(app)
    .patch(`/api/assignments/${assignmentId}/term`)
    .set("Authorization", `Bearer ${teacher1Token}`)
    .send({ term: 2 });
  assert.strictEqual(resOwner.statusCode, 200);
  assert.strictEqual(resOwner.body.assignment.term, 2);

  // Admin can change term
  const resAdmin = await request(app)
    .patch(`/api/assignments/${assignmentId}/term`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ term: 3 });
  assert.strictEqual(resAdmin.statusCode, 200);
  assert.strictEqual(resAdmin.body.assignment.term, 3);
});

test("TEACHER RESOURCE: requires term on creation and allows term update", async () => {
  const dummyFile = path.join(__dirname, "fixtures", `terms-resource-${Date.now()}.pdf`);
  const validPdf = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n115\n%%EOF"
  );
  fs.writeFileSync(dummyFile, validPdf);

  let resourceId;
  try {
    // Reject without term
    const resNoTerm = await request(app)
      .post("/api/teacher/resources")
      .set("Authorization", `Bearer ${teacher1Token}`)
      .field("title", "Teacher Resource Without Term")
      .field("subject", "Terms Testing Subject")
      .field("year", "1")
      .field("type", "notes")
      .attach("file", dummyFile);
    assert.strictEqual(resNoTerm.statusCode, 400);
    assert.strictEqual(resNoTerm.body.field, "term");

    // Create with term
    const resCreated = await request(app)
      .post("/api/teacher/resources")
      .set("Authorization", `Bearer ${teacher1Token}`)
      .field("title", "Teacher Resource Notes")
      .field("subject", "Terms Testing Subject")
      .field("year", "1")
      .field("term", "1")
      .field("type", "notes")
      .attach("file", dummyFile);
    assert.strictEqual(resCreated.statusCode, 201);
    assert.strictEqual(resCreated.body.resource.term, 1);
    resourceId = resCreated.body.resource.id;

    // Teacher 2 cannot change term
    const resOtherTeacher = await request(app)
      .patch(`/api/teacher/resources/${resourceId}/term`)
      .set("Authorization", `Bearer ${teacher2Token}`)
      .send({ term: 2 });
    assert.strictEqual(resOtherTeacher.statusCode, 403);

    // Owner teacher can change term
    const resOwner = await request(app)
      .patch(`/api/teacher/resources/${resourceId}/term`)
      .set("Authorization", `Bearer ${teacher1Token}`)
      .send({ term: 2 });
    assert.strictEqual(resOwner.statusCode, 200);
    assert.strictEqual(resOwner.body.resource.term, 2);

    // Admin can change term
    const resAdmin = await request(app)
      .patch(`/api/teacher/resources/${resourceId}/term`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ term: 3 });
    assert.strictEqual(resAdmin.statusCode, 200);
    assert.strictEqual(resAdmin.body.resource.term, 3);
  } finally {
    if (fs.existsSync(dummyFile)) fs.unlinkSync(dummyFile);
  }
});

test("SUBJECT MATERIALS: GET /api/subject-materials returns term and termCounts", async () => {
  const res = await request(app)
    .get("/api/subject-materials?subject=Terms%20Testing%20Subject")
    .set("Authorization", `Bearer ${student1Token}`);

  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.termCounts);
  assert.strictEqual(typeof res.body.termCounts[1], "number");
  assert.strictEqual(typeof res.body.termCounts[2], "number");
  assert.strictEqual(typeof res.body.termCounts[3], "number");
  assert.strictEqual(typeof res.body.termCounts.unset, "number");
  assert.ok(Array.isArray(res.body.resources));
  assert.ok(Array.isArray(res.body.assignments));
});
