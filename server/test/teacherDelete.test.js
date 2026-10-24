const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../src/config/env");
const {
  connectToMongo,
  closeDb,
  getUsersCollection,
  getPapersCollection,
  getAssignmentsCollection,
} = require("../src/models");

test("Teacher deletion suite", async (t) => {
  let adminToken;
  let adminUser;

  t.before(async () => {
    await connectToMongo();
    const users = getUsersCollection();

    adminUser = await users.findOne({ role: "admin" });
    if (!adminUser) {
      const pwd = await bcrypt.hash("AdminTest123!", 10);
      adminUser = {
        id: Date.now().toString(),
        name: "Test Admin",
        username: "testadmin",
        email: "testadmin_del@rca.ac.rw",
        password: pwd,
        role: "admin",
        status: "active",
        createdAt: new Date().toISOString(),
      };
      await users.insertOne(adminUser);
    }

    adminToken = jwt.sign(
      {
        id: String(adminUser.id || adminUser._id),
        email: adminUser.email,
        username: adminUser.username || "admin",
        role: "admin",
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    // Clean up test emails before running
    await users.deleteMany({
      email: {
        $in: [
          "invited_teach_test@rca.ac.rw",
          "direct_teach_test@rca.ac.rw",
          "promoted_teach_test@rca.ac.rw",
          "seeded_style_teach@rca.ac.rw",
        ],
      },
    });
  });

  t.after(async () => {
    await closeDb();
  });

  await t.test("1. Delete a teacher created via admin invite", async () => {
    const resInvite = await request(app)
      .post("/api/admin/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Invited Teacher",
        email: "invited_teach_test@rca.ac.rw",
      });

    assert.equal(resInvite.status, 201);
    const teacherId = resInvite.body.teacher.id || resInvite.body.teacher._id;
    assert.ok(teacherId);

    const resDel = await request(app)
      .delete(`/api/admin/teachers/${teacherId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(resDel.status, 200);
    assert.equal(resDel.body.message, "Teacher account deleted successfully.");

    const users = getUsersCollection();
    const check = await users.findOne({ email: "invited_teach_test@rca.ac.rw" });
    assert.equal(check, null);
  });

  await t.test("2. Delete a teacher created via direct create", async () => {
    const resDirect = await request(app)
      .post("/api/admin/teachers/direct")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Direct Teacher",
        email: "direct_teach_test@rca.ac.rw",
        password: "Password123!",
      });

    assert.equal(resDirect.status, 201);
    const teacherId = resDirect.body.teacher.id || resDirect.body.teacher._id;
    assert.ok(teacherId);

    const resDel = await request(app)
      .delete(`/api/admin/teachers/${teacherId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(resDel.status, 200);

    const users = getUsersCollection();
    const check = await users.findOne({ email: "direct_teach_test@rca.ac.rw" });
    assert.equal(check, null);
  });

  await t.test("3. Delete a teacher created by email / sign-up promotion (only has _id)", async () => {
    const users = getUsersCollection();
    const email = "promoted_teach_test@rca.ac.rw";
    const pwd = await bcrypt.hash("Password123!", 10);
    const result = await users.insertOne({
      name: "Promoted Teacher",
      username: "promotedteacher",
      email,
      password: pwd,
      role: "teacher",
      status: "active",
      createdAt: new Date().toISOString(),
    });

    const teacherObjectId = result.insertedId.toString();

    const resDel = await request(app)
      .delete(`/api/admin/teachers/${teacherObjectId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(resDel.status, 200);

    const check = await users.findOne({ _id: result.insertedId });
    assert.equal(check, null);
  });

  await t.test("4. Delete a seeded-style teacher document and verify papers & assignments are preserved", async () => {
    const users = getUsersCollection();
    const papers = getPapersCollection();
    const assignments = getAssignmentsCollection();

    const uid = Date.now().toString();
    const teacherEmail = `seeded_teach_${uid}@rca.ac.rw`;
    const teacherId = `seeded_teacher_${uid}`;
    const teacherName = "Seeded Faculty";

    await users.deleteMany({ email: teacherEmail });
    await papers.deleteMany({ id: `paper_${uid}` });
    await assignments.deleteMany({ id: `assignment_${uid}` });

    await users.insertOne({
      id: teacherId,
      name: teacherName,
      username: `seededfaculty_${uid}`,
      email: teacherEmail,
      password: await bcrypt.hash("Password123!", 10),
      role: "teacher",
      status: "active",
      createdAt: new Date().toISOString(),
    });

    const paperId = `paper_${uid}`;
    await papers.insertOne({
      id: paperId,
      title: "Sample Exam Paper",
      subject: "Mathematics",
      year: 1,
      classId: "Y1A",
      type: "past_paper",
      filename: "sample.pdf",
      originalName: "sample.pdf",
      uploadedById: teacherId,
      uploadedByEmail: teacherEmail,
      uploadedBy: `seededfaculty_${uid}`,
      uploadedAt: new Date().toISOString(),
    });

    const assignmentId = `assignment_${uid}`;
    await assignments.insertOne({
      id: assignmentId,
      title: "Linear Algebra Task",
      subject: "Mathematics",
      targetClass: "Y1A",
      teacherId: teacherId,
      teacherEmail: teacherEmail,
      createdAt: new Date().toISOString(),
    });

    const resDel = await request(app)
      .delete(`/api/admin/teachers/${teacherId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(resDel.status, 200);

    const checkUser = await users.findOne({ id: teacherId });
    assert.equal(checkUser, null);

    const checkPaper = await papers.findOne({ id: paperId });
    assert.ok(checkPaper);
    assert.equal(checkPaper.teacherName, teacherName);
    assert.equal(checkPaper.uploaderDeleted, true);

    const checkAssignment = await assignments.findOne({ id: assignmentId });
    assert.ok(checkAssignment);
    assert.equal(checkAssignment.teacherName, teacherName);
    assert.equal(checkAssignment.teacherDeleted, true);

    await papers.deleteOne({ id: paperId });
    await assignments.deleteOne({ id: assignmentId });
  });

  await t.test("5. Delete a non-existent teacher returns 404", async () => {
    const resDel = await request(app)
      .delete("/api/admin/teachers/non_existent_teacher_id_12345")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(resDel.status, 404);
    assert.equal(resDel.body.error, "Teacher not found");
  });
});
