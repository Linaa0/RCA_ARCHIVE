"use strict";

const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../src/app");
const {
  getPromotions,
  getSubjectsForPromotion,
  getSubjectsForClass,
} = require("../src/config/curriculum");

test("PART 6 CURRICULUM SUITE: Verification of Y1 Short Courses and Computer Basics", async (t) => {
  await t.test("6.1 Y1 promotion definition includes Short Courses and Computer Basics", () => {
    const promotions = getPromotions();
    const y1 = promotions.find((p) => p.id === "Y1");
    assert.ok(y1, "Y1 promotion exists");
    assert.ok(
      y1.subjects.includes("Computer Basics"),
      "Y1 promotion must include Computer Basics"
    );
    assert.ok(
      y1.subjects.includes("Short Courses"),
      "Y1 promotion must include Short Courses"
    );
  });

  await t.test("6.2 getSubjectsForPromotion('Y1') includes Short Courses and Computer Basics", () => {
    const subjects = getSubjectsForPromotion("Y1");
    assert.ok(
      subjects.includes("Computer Basics"),
      "getSubjectsForPromotion('Y1') must include Computer Basics"
    );
    assert.ok(
      subjects.includes("Short Courses"),
      "getSubjectsForPromotion('Y1') must include Short Courses"
    );
  });

  await t.test("6.3 All Y1 classes (Y1A, Y1B, Y1C) include Short Courses and Computer Basics", () => {
    const y1Classes = ["Y1A", "Y1B", "Y1C"];
    for (const cls of y1Classes) {
      const subjects = getSubjectsForClass(cls);
      assert.ok(
        subjects.includes("Computer Basics"),
        `${cls} must include Computer Basics`
      );
      assert.ok(
        subjects.includes("Short Courses"),
        `${cls} must include Short Courses`
      );
    }
  });

  await t.test("6.4 Public curriculum endpoint serves Computer Basics and Short Courses for Y1", async () => {
    const res = await request(app).get("/api/public/curriculum");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "ok");

    const y1 = (res.body.promotions || []).find((p) => p.id === "Y1");
    assert.ok(y1, "Public response includes Y1 promotion");
    assert.ok(
      y1.subjects.includes("Computer Basics"),
      "Public Y1 subjects includes Computer Basics"
    );
    assert.ok(
      y1.subjects.includes("Short Courses"),
      "Public Y1 subjects includes Short Courses"
    );
  });
});
