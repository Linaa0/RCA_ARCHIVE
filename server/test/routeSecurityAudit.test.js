"use strict";

const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../src/app");
const { PUBLIC_ROUTES } = require("../src/config/publicRoutes");

test("PART 5 ROUTE SECURITY AUDIT SUITE", async (t) => {
  await t.test("5.1 Global security headers are present on all responses", async () => {
    const res = await request(app).get("/api/health");
    assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
    assert.strictEqual(res.headers["x-frame-options"], "DENY");
    assert.strictEqual(res.headers["cross-origin-opener-policy"], "same-origin");
    assert.ok(res.headers["permissions-policy"].includes("camera=()"));
    assert.ok(!res.headers["x-powered-by"]);
  });

  await t.test("5.2 Public routes match the documented allowlist exactly", async () => {
    const expectedAllowlist = [
      "/api/health",
      "/api/login",
      "/api/signup",
      "/api/send-otp",
      "/api/send-teacher-otp",
      "/api/verify-otp",
      "/api/forgot-password",
      "/api/reset-password",
      "/api/auth/refresh",
      "/api/refresh",
      "/api/public/curriculum",
      "/api/public/summary",
    ];

    for (const route of expectedAllowlist) {
      assert.ok(
        PUBLIC_ROUTES.some((r) => r.path === route),
        `Expected ${route} to be in PUBLIC_ROUTES allowlist`
      );
    }
  });

  await t.test("5.3 Deny-by-default: unauthorized access to private routes returns 401", async () => {
    const privateEndpoints = [
      { method: "get", path: "/api/papers" },
      { method: "get", path: "/api/curriculum" },
      { method: "get", path: "/api/stats" },
      { method: "get", path: "/api/users" },
      { method: "get", path: "/api/assignments" },
      { method: "get", path: "/api/notifications" },
      { method: "get", path: "/api/admin/stats" },
      { method: "post", path: "/api/logout" },
      { method: "post", path: "/api/logout-all" },
      { method: "post", path: "/api/upload" },
    ];

    for (const ep of privateEndpoints) {
      const res = await request(app)[ep.method](ep.path);
      assert.strictEqual(
        res.status,
        401,
        `Expected ${ep.method.toUpperCase()} ${ep.path} to return 401 unauthorized, got ${res.status}`
      );
    }
  });

  await t.test("5.4 Public health check does not leak database name or internals to untrusted IP", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("X-Forwarded-For", "198.51.100.25");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { status: "ok" });
    assert.strictEqual(res.body.databaseName, undefined);
    assert.strictEqual(res.body.version, undefined);
  });
});
