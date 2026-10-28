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
  getAssignmentsCollection,
  getAppealsCollection,
  getNotificationsCollection,
} = require("../src/models");
const {
  dispatchDueAssignmentReminders,
  getAssignmentReminderDueAt,
} = require("../src/services/deadlineReminderService");
const { emitAssignmentEvent } = require("../src/services/socketService");

let studentToken;
let teacherToken;
let testAssignmentId;
const samplePdfPath = path.join(__dirname, "fixtures", "test-document.pdf");
const duplicatePdfPath = path.join(__dirname, "fixtures", "test-document-copy.pdf");

const studentUser = {
  id: "test-student-features-id",
  email: "student.features@rca.ac.rw",
  username: "studentfeatures",
  name: "Student Features",
  role: "student",
  class: "Y1A",
  gender: "male",
  status: "active",
};

const secondStudentUser = {
  id: "test-student-taken-id",
  email: "student.taken@rca.ac.rw",
  username: "takenusername",
  name: "Taken Username Student",
  role: "student",
  class: "Y2A",
  gender: "female",
  status: "active",
};

const teacherUser = {
  id: "test-teacher-features-id",
  email: "teacher.features@rca.ac.rw",
  username: "teacherfeatures",
  name: "Teacher Features",
  role: "teacher",
  status: "active",
};

test("SETUP: database, fixtures, and authorization tokens", async () => {
  await connectToMongo();

  // Create fixtures folder if needed
  const fixturesDir = path.join(__dirname, "fixtures");
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  // Create a minimal valid PDF fixture
  const pdfHeader = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n168\n%%EOF";
  fs.writeFileSync(samplePdfPath, pdfHeader);
  fs.writeFileSync(duplicatePdfPath, pdfHeader);

  const users = getUsersCollection();
  await users.updateOne(
    { email: studentUser.email },
    { $set: { ...studentUser, createdAt: new Date().toISOString() } },
    { upsert: true }
  );
  await users.updateOne(
    { email: secondStudentUser.email },
    { $set: { ...secondStudentUser, createdAt: new Date().toISOString() } },
    { upsert: true }
  );
  await users.updateOne(
    { email: teacherUser.email },
    { $set: { ...teacherUser, createdAt: new Date().toISOString() } },
    { upsert: true }
  );

  studentToken = jwt.sign(studentUser, JWT_SECRET, { expiresIn: "1h" });
  teacherToken = jwt.sign(teacherUser, JWT_SECRET, { expiresIn: "1h" });

  const assignments = getAssignmentsCollection();
  testAssignmentId = "assignment-features-" + Date.now();
  await assignments.insertOne({
    id: testAssignmentId,
    teacherId: teacherUser.id,
    teacherName: teacherUser.name,
    title: "Operating Systems Memory Lab",
    description: "Implement page replacement algorithms in C.",
    subject: "Fundamentals of Programming",
    classes: ["Y1A"],
    deadline: new Date(Date.now() - 3600000).toISOString(),
    audience: "class",
    term: 1,
    createdAt: new Date().toISOString(),
  });
});

test("STUDENT UPLOAD PERMISSION: allows student uploading to a class other than their enrolled class", async () => {
  const uniqueDummyPath = path.join(__dirname, "fixtures", `temp-y2b-${Date.now()}.pdf`);
  const validPdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n168\n%%EOF";
  fs.writeFileSync(uniqueDummyPath, validPdf);

  try {
    const res = await request(app)
      .post("/api/upload")
      .set("Authorization", `Bearer ${studentToken}`)
      .field("title", "Exam Prep Y2B Physics")
      .field("subject", "Physics")
      .field("year", "Y2B")
      .field("classId", "Y2B")
      .field("term", "1")
      .field("type", "past_paper")
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

test("ASSIGNMENTS: student responses include the assigned cohort label", async () => {
  const res = await request(app)
    .get("/api/assignments")
    .set("Authorization", `Bearer ${studentToken}`);

  assert.strictEqual(res.status, 200);
  const assignment = res.body.assignments.find((item) => item.id === testAssignmentId);
  assert.ok(assignment);
  assert.deepStrictEqual(assignment.classes, ["Y1A"]);
  assert.deepStrictEqual(assignment.classLabels, ["Year 1A"]);
});

test("STUDENT UPLOAD PERMISSION: allows student uploading to their own enrolled class", async () => {
  const res = await request(app)
    .post("/api/upload")
    .set("Authorization", `Bearer ${studentToken}`)
    .field("title", "Year 1 Term 1 Programming Final")
    .field("subject", "Fundamentals of Programming")
    .field("year", "Y1A")
    .field("classId", "Y1A")
    .field("term", "1")
    .field("type", "past_paper")
    .attach("file", samplePdfPath);

  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body.message, /Uploaded to/i);
  assert.ok(res.body.paper);
  assert.strictEqual(res.body.paper.classId, "Y1A");
});

test("DUPLICATE PAPER UPLOAD: rejects upload with identical file hash with 409 conflict", async () => {
  const res = await request(app)
    .post("/api/upload")
    .set("Authorization", `Bearer ${studentToken}`)
    .field("title", "Duplicate Programming Exam")
    .field("subject", "Fundamentals of Programming")
    .field("year", "Y1A")
    .field("classId", "Y1A")
    .field("term", "1")
    .field("type", "past_paper")
    .attach("file", duplicatePdfPath);

  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.error, "duplicate");
  assert.ok(res.body.message.includes("already exists"));
  assert.ok(res.body.existingPaper);
});

test("APPEAL WORD COUNT: rejects appeal reason shorter than 50 words with 400", async () => {
  const shortReason = "I had a medical emergency yesterday and could not complete the assignment in time.";
  const words = shortReason.split(/\s+/).filter(Boolean);
  assert.ok(words.length < 50);

  const res = await request(app)
    .post(`/api/assignments/${testAssignmentId}/appeal`)
    .set("Authorization", `Bearer ${studentToken}`)
    .send({ reason: shortReason });

  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.body.error.includes("between 50 and 100 words"));
  assert.strictEqual(res.body.wordCount, words.length);
});

test("APPEAL WORD COUNT: rejects appeal reason longer than 100 words with 400", async () => {
  const longReason = ("Due to severe unforeseen technical and personal circumstances that happened over the weekend " +
    "including a total blackout at our community residence and hardware corruption on my development laptop " +
    "where my operating systems repository was stored, I was completely prevented from executing the test suite " +
    "and packaging the submission files before the scheduled deadline. I kindly request an extension of forty-eight hours " +
    "so that I can reinstall the build toolchain, verify the page replacement algorithms thoroughly against edge test cases, " +
    "and upload the complete source archive to the portal. I have already restored my git history and verified the algorithm logic, " +
    "and will complete the submission as soon as power and network connectivity are fully restored in our academic dormitories.").trim();
  const words = longReason.split(/\s+/).filter(Boolean);
  assert.ok(words.length > 100, `Expected > 100 words, got ${words.length}`);

  const res = await request(app)
    .post(`/api/assignments/${testAssignmentId}/appeal`)
    .set("Authorization", `Bearer ${studentToken}`)
    .send({ reason: longReason });

  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.body.error.includes("between 50 and 100 words"));
  assert.strictEqual(res.body.wordCount, words.length);
});

test("APPEAL WORD COUNT: accepts valid appeal reason between 50 and 100 words", async () => {
  const validReason = ("I am respectfully submitting this appeal for an extension on the Operating Systems Memory Lab assignment. " +
    "During the scheduled preparation period, our campus building experienced an unexpected power outage accompanied by local network downtime, " +
    "which prevented me from finalizing the simulation tests and pushing my source archive. " +
    "I have now prepared all verification benchmarks and request twenty-four hours to deliver the completed lab.").trim();
  const words = validReason.split(/\s+/).filter(Boolean);
  assert.ok(words.length >= 50 && words.length <= 100, `Expected 50-100 words, got ${words.length}`);

  const res = await request(app)
    .post(`/api/assignments/${testAssignmentId}/appeal`)
    .set("Authorization", `Bearer ${studentToken}`)
    .send({ reason: validReason });

  assert.strictEqual(res.statusCode, 201);
  assert.ok(res.body.appeal);
  assert.strictEqual(res.body.appeal.status, "pending");
  assert.strictEqual(res.body.appeal.studentId, studentUser.id);
});

test("PROFILE UPDATE: rejects duplicate username with 409 conflict", async () => {
  const res = await request(app)
    .put("/api/me")
    .set("Authorization", `Bearer ${studentToken}`)
    .send({
      name: "Student Features",
      username: "takenusername",
    });

  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.error, "Username is already taken");
});

test("PROFILE UPDATE: successfully updates username, class, gender, and notification preferences", async () => {
  const res = await request(app)
    .put("/api/me")
    .set("Authorization", `Bearer ${studentToken}`)
    .send({
      name: "Student Features Renamed",
      username: "studentfeaturesupdated",
      class: "Y1B",
      gender: "female",
      notifications: {
        inAppAlerts: true,
        dueReminders: false,
        emailNotifications: true,
      },
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.message, "Profile updated");
  assert.strictEqual(res.body.username, "studentfeaturesupdated");
  assert.strictEqual(res.body.class, "Y1A");
  assert.strictEqual(res.body.gender, "male");
  assert.deepStrictEqual(res.body.notifications, {
    inAppAlerts: true,
    dueReminders: false,
    emailNotifications: true,
  });

  // Verify persistence via GET /api/me: class and gender remain locked
  const getMeRes = await request(app)
    .get("/api/me")
    .set("Authorization", `Bearer ${studentToken}`);

  assert.strictEqual(getMeRes.statusCode, 200);
  assert.strictEqual(getMeRes.body.user.username, "studentfeaturesupdated");
  assert.strictEqual(getMeRes.body.user.class, "Y1A");
  assert.strictEqual(getMeRes.body.user.gender, "male");
  assert.deepStrictEqual(getMeRes.body.user.notifications, {
    inAppAlerts: true,
    dueReminders: false,
    emailNotifications: true,
  });

  const preferencesOnlyRes = await request(app)
    .put("/api/me")
    .set("Authorization", `Bearer ${studentToken}`)
    .send({
      notifications: {
        inAppAlerts: false,
        dueReminders: true,
        emailNotifications: false,
      },
    });
  assert.strictEqual(preferencesOnlyRes.statusCode, 200);
  assert.deepStrictEqual(preferencesOnlyRes.body.notifications, {
    inAppAlerts: false,
    dueReminders: true,
    emailNotifications: false,
  });
});

test("DEADLINE REMINDERS: sends an unread alert only after one hour to opted-in students", async () => {
  const now = new Date();
  const dueAt = new Date(now.getTime() - 60 * 1000).toISOString();
  const reminderStudent = {
    ...studentUser,
    id: "test-reminder-opted-in",
    email: "reminder.opted.in@rca.ac.rw",
    notifications: { dueReminders: true },
  };
  const optedOutStudent = {
    ...secondStudentUser,
    id: "test-reminder-opted-out",
    email: "reminder.opted.out@rca.ac.rw",
    class: "Y1A",
    notifications: { dueReminders: false },
  };
  const assignment = {
    id: "test-assignment-reminder-" + Date.now(),
    title: `Reminder test assignment ${Date.now()}`,
    subject: "Testing",
    deadline: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    classes: [],
    studentIds: [reminderStudent.id, optedOutStudent.id],
    reminderDueAt: new Date(now.getTime() + 60 * 1000).toISOString(),
  };
  const users = getUsersCollection();
  const assignments = getAssignmentsCollection();
  const notifications = getNotificationsCollection();
  await users.insertMany([reminderStudent, optedOutStudent]);
  await assignments.insertOne(assignment);

  try {
    await emitAssignmentEvent("created", assignment);
    await dispatchDueAssignmentReminders(now);
    const early = await notifications.find({
      userId: reminderStudent.id,
      title: `Assignment Reminder: ${assignment.title}`,
    }).toArray();
    assert.strictEqual(early.length, 0);

    await assignments.updateOne(
      { id: assignment.id },
      { $set: { reminderDueAt: dueAt } }
    );
    await dispatchDueAssignmentReminders(now);
    const sent = await notifications.find({
      userId: reminderStudent.id,
      title: `Assignment Reminder: ${assignment.title}`,
    }).toArray();
    const optedOut = await notifications.find({
      userId: optedOutStudent.id,
      title: `Assignment Reminder: ${assignment.title}`,
    }).toArray();
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].read, false);
    assert.strictEqual(optedOut.length, 0);

    await dispatchDueAssignmentReminders(now);
    const duplicateCheck = await notifications.find({
      userId: reminderStudent.id,
      title: `Assignment Reminder: ${assignment.title}`,
    }).toArray();
    assert.strictEqual(duplicateCheck.length, 1);
  } finally {
    await users.deleteMany({ id: { $in: [reminderStudent.id, optedOutStudent.id] } });
    await assignments.deleteOne({ id: assignment.id });
    await notifications.deleteMany({
      userId: { $in: [reminderStudent.id, optedOutStudent.id] },
      title: `Assignment Reminder: ${assignment.title}`,
    });
  }
});

test("DEADLINE REMINDERS: use 20 minutes only when the deadline is under one hour away", () => {
  const givenAt = new Date("2026-10-25T08:00:00.000Z");
  assert.strictEqual(
    getAssignmentReminderDueAt(givenAt, new Date(givenAt.getTime() + 59 * 60 * 1000)),
    new Date(givenAt.getTime() + 20 * 60 * 1000).toISOString()
  );
  assert.strictEqual(
    getAssignmentReminderDueAt(givenAt, new Date(givenAt.getTime() + 60 * 60 * 1000)),
    new Date(givenAt.getTime() + 60 * 60 * 1000).toISOString()
  );
});

test("DEADLINE REMINDERS: send the scheduled 20-minute reminder even if the deadline has passed", async () => {
  const givenAt = new Date("2026-10-25T08:00:00.000Z");
  const now = new Date(givenAt.getTime() + 25 * 60 * 1000);
  const reminderStudent = {
    ...studentUser,
    id: "test-reminder-after-deadline",
    email: "reminder.after.deadline@rca.ac.rw",
    notifications: { dueReminders: true },
  };
  const assignment = {
    id: "test-assignment-after-deadline-" + Date.now(),
    title: "Short deadline assignment",
    subject: "Testing",
    givenAt: givenAt.toISOString(),
    deadline: new Date(givenAt.getTime() + 15 * 60 * 1000).toISOString(),
    reminderDueAt: new Date(givenAt.getTime() + 20 * 60 * 1000).toISOString(),
    classes: [],
    studentIds: [reminderStudent.id],
  };
  const users = getUsersCollection();
  const assignments = getAssignmentsCollection();
  const notifications = getNotificationsCollection();
  await users.insertOne(reminderStudent);
  await assignments.insertOne(assignment);

  try {
    await dispatchDueAssignmentReminders(now);
    const sent = await notifications.find({
      userId: reminderStudent.id,
      title: `Assignment Reminder: ${assignment.title}`,
    }).toArray();
    assert.strictEqual(sent.length, 1);
    assert.match(sent[0].message, /20 minutes ago/);
    assert.ok(sent[0].read === false);
  } finally {
    await users.deleteOne({ id: reminderStudent.id });
    await assignments.deleteOne({ id: assignment.id });
    await notifications.deleteMany({ userId: reminderStudent.id });
  }
});

test("TEARDOWN: clean up database fixtures and test files", async () => {
  const users = getUsersCollection();
  await users.deleteMany({
    email: {
      $in: [studentUser.email, secondStudentUser.email, teacherUser.email],
    },
  });

  const assignments = getAssignmentsCollection();
  await assignments.deleteOne({ id: testAssignmentId });

  const appeals = getAppealsCollection();
  await appeals.deleteMany({ studentId: studentUser.id });

  const papers = getPapersCollection();
  const testPapers = await papers.find({ uploadedById: studentUser.id }).toArray();
  for (const p of testPapers) {
    const pPath = path.join(UPLOADS_DIR, p.filename);
    if (fs.existsSync(pPath)) {
      try {
        fs.unlinkSync(pPath);
      } catch (_) {}
    }
  }
  await papers.deleteMany({ uploadedById: studentUser.id });

  // Remove test fixture files
  try {
    if (fs.existsSync(samplePdfPath)) fs.unlinkSync(samplePdfPath);
  } catch (_) {}
  try {
    if (fs.existsSync(duplicatePdfPath)) fs.unlinkSync(duplicatePdfPath);
  } catch (_) {}

  await closeDb();
});
