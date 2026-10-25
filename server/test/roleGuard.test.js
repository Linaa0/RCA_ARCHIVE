const test = require("node:test");
const assert = require("node:assert/strict");
const { requireStudent } = require("../src/middleware/roleGuard");

function runGuard(user) {
  const result = { statusCode: null, body: null };
  const req = { user };
  const res = {
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  let nextCalled = false;

  requireStudent(req, res, () => {
    nextCalled = true;
  });

  return { ...result, nextCalled };
}

test("student routes allow students and admins with a class profile", () => {
  assert.equal(runGuard({ role: "student" }).nextCalled, true);
  assert.equal(runGuard({ role: "admin", class: "Y1A" }).nextCalled, true);
});

test("student routes reject admins without a class and other roles", () => {
  const noClass = runGuard({ role: "admin", class: "" });
  assert.equal(noClass.statusCode, 403);
  assert.deepEqual(noClass.body, { error: "Student access required" });

  const teacher = runGuard({ role: "teacher", class: "Y1A" });
  assert.equal(teacher.statusCode, 403);
});
