const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { JWT_SECRET, UPLOADS_DIR } = require("../src/config/env");
const { SUBMISSIONS_DIR } = require("../src/services/submissionStorage");
const {
  connectToMongo,
  closeDb,
  getUsersCollection,
  getPapersCollection,
  getAssignmentsCollection,
  getSubmissionsCollection,
} = require("../src/models");

test("File view and download suite", async (t) => {
  let teacherToken;
  let studentToken;
  let teacherUser;
  let studentUser;

  const testPaperId = `test_paper_${Date.now()}`;
  const testAssignmentId = `test_asg_${Date.now()}`;
  const testSubmissionId = `test_sub_${Date.now()}`;

  const specialFilename = "Math Exam [2024] & Épreuve (Term 1).pdf";
  const diskFilename = `test_file_${Date.now()}.pdf`;
  const uploadPath = path.join(UPLOADS_DIR, diskFilename);
  const submissionPath = path.join(SUBMISSIONS_DIR, diskFilename);

  t.before(async () => {
    await connectToMongo();

    // Ensure sample file exists on disk
    fs.writeFileSync(uploadPath, "%PDF-1.4 sample content for testing");
    fs.writeFileSync(submissionPath, "%PDF-1.4 sample content for testing");

    const users = getUsersCollection();
    teacherUser = {
      id: `teach_${Date.now()}`,
      name: "Test Teacher",
      username: `teacher_${Date.now()}`,
      email: `teacher_${Date.now()}@rca.ac.rw`,
      role: "teacher",
      status: "active",
      createdAt: new Date().toISOString(),
    };
    studentUser = {
      id: `stud_${Date.now()}`,
      name: "Test Student",
      username: `student_${Date.now()}`,
      email: `student_${Date.now()}@rca.ac.rw`,
      role: "student",
      class: "Y1A",
      status: "active",
      createdAt: new Date().toISOString(),
    };
    await users.insertOne(teacherUser);
    await users.insertOne(studentUser);

    teacherToken = jwt.sign(
      {
        id: teacherUser.id,
        email: teacherUser.email,
        username: teacherUser.username,
        role: teacherUser.role,
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    studentToken = jwt.sign(
      {
        id: studentUser.id,
        email: studentUser.email,
        username: studentUser.username,
        role: studentUser.role,
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    const papers = getPapersCollection();
    await papers.insertOne({
      id: testPaperId,
      title: "Math Exam [2024]",
      subject: "Mathematics",
      year: 1,
      classId: "Y1A",
      type: "past_paper",
      filename: diskFilename,
      originalName: specialFilename,
      uploadedById: teacherUser.id,
      uploadedByEmail: teacherUser.email,
      uploadedBy: teacherUser.username,
      uploadedAt: new Date().toISOString(),
    });

    const assignments = getAssignmentsCollection();
    await assignments.insertOne({
      id: testAssignmentId,
      title: "Algebra Assignment",
      subject: "Mathematics",
      classes: ["Y1A"],
      studentIds: [],
      teacherId: teacherUser.id,
      teacherEmail: teacherUser.email,
      attachment: {
        filename: diskFilename,
        originalName: specialFilename,
      },
      deadline: new Date(Date.now() + 86400000).toISOString(),
      givenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const submissions = getSubmissionsCollection();
    await submissions.insertOne({
      id: testSubmissionId,
      assignmentId: testAssignmentId,
      studentId: studentUser.id,
      studentEmail: studentUser.email,
      studentName: studentUser.name,
      studentClass: "Y1A",
      text: "Completed solutions attached.",
      file: {
        filename: diskFilename,
        originalName: specialFilename,
      },
      submittedAt: new Date().toISOString(),
      late: false,
    });
  });

  t.after(async () => {
    try {
      if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
      if (fs.existsSync(submissionPath)) fs.unlinkSync(submissionPath);
    } catch (_) {}

    const users = getUsersCollection();
    const papers = getPapersCollection();
    const assignments = getAssignmentsCollection();
    const submissions = getSubmissionsCollection();

    await users.deleteMany({ id: { $in: [teacherUser.id, studentUser.id] } });
    await papers.deleteOne({ id: testPaperId });
    await assignments.deleteOne({ id: testAssignmentId });
    await submissions.deleteOne({ id: testSubmissionId });

    await closeDb();
  });

  await t.test("1. View paper: returns Content-Disposition inline with correct Content-Type", async () => {
    const res = await request(app).get(`/api/papers/${testPaperId}/view`);
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "application/pdf");
    assert.ok(res.headers["content-disposition"].startsWith("inline;"));
    assert.ok(res.headers["content-disposition"].includes("filename*="));
  });

  await t.test("2. Download paper: returns Content-Disposition attachment with RFC 5987 encoding", async () => {
    const res = await request(app).get(`/api/papers/${testPaperId}/download`);
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "application/pdf");
    assert.ok(res.headers["content-disposition"].startsWith("attachment;"));
    assert.ok(res.headers["content-disposition"].includes("UTF-8''"));

    // Verify encoded filename can be decoded back to specialFilename
    const match = res.headers["content-disposition"].match(/filename\*=UTF-8''([^;\r\n]+)/);
    assert.ok(match, "Should contain RFC 5987 encoded filename");
    const decoded = decodeURIComponent(match[1]);
    assert.equal(decoded, specialFilename);
  });

  await t.test("3. View assignment attachment: returns Content-Disposition inline with token in header or query", async () => {
    const resHeader = await request(app)
      .get(`/api/assignments/${testAssignmentId}/view`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(resHeader.status, 200);
    assert.equal(resHeader.headers["content-type"], "application/pdf");
    assert.ok(resHeader.headers["content-disposition"].startsWith("inline;"));

    const resQuery = await request(app)
      .get(`/api/assignments/${testAssignmentId}/view?token=${encodeURIComponent(studentToken)}`);
    assert.equal(resQuery.status, 200);
    assert.equal(resQuery.headers["content-type"], "application/pdf");
    assert.ok(resQuery.headers["content-disposition"].startsWith("inline;"));
  });

  await t.test("4. Download assignment attachment: returns Content-Disposition attachment", async () => {
    const res = await request(app)
      .get(`/api/assignments/${testAssignmentId}/attachment`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.headers["content-disposition"].startsWith("attachment;"));
    const match = res.headers["content-disposition"].match(/filename\*=UTF-8''([^;\r\n]+)/);
    assert.ok(match);
    assert.equal(decodeURIComponent(match[1]), specialFilename);
  });

  await t.test("5. View student submission: returns Content-Disposition inline", async () => {
    const res = await request(app)
      .get(`/api/assignments/submissions/${testSubmissionId}/view`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "application/pdf");
    assert.ok(res.headers["content-disposition"].startsWith("inline;"));
  });

  await t.test("6. Download student submission: returns Content-Disposition attachment", async () => {
    const res = await request(app)
      .get(`/api/submissions/${testSubmissionId}/file`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.headers["content-disposition"].startsWith("attachment;"));
    const match = res.headers["content-disposition"].match(/filename\*=UTF-8''([^;\r\n]+)/);
    assert.ok(match);
    assert.equal(decodeURIComponent(match[1]), specialFilename);
  });
});
