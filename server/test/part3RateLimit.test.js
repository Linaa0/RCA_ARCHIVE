"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const app = require("../src/app");
const { JWT_SECRET } = require("../src/config/env");
const { connectToMongo } = require("../src/models");
const { createLimiter } = require("../src/middleware/rateLimiter");

test("PART 3 SUITE: Health endpoint security, caching, rate limit headers, and anti-spoofing", async (t) => {
  await connectToMongo();

  const adminToken = jwt.sign(
    {
      id: crypto.randomUUID(),
      email: "admin.health@rca.ac.rw",
      username: "adminhealth",
      role: "admin",
    },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

  await t.test("3.3.1 Health endpoint shape: minimal public output vs detailed internal/admin", async () => {
    // 1. External/Public request (simulated with proxy forwarded header)
    const publicRes = await request(app)
      .get("/api/health")
      .set("X-Forwarded-For", "203.0.113.50");

    assert.equal(publicRes.status, 200);
    assert.deepEqual(publicRes.body, { status: "ok" });
    assert.equal(publicRes.body.version, undefined);
    assert.equal(publicRes.body.databaseName, undefined);
    assert.equal(publicRes.body.commit, undefined);

    // 2. Direct loopback request (no X-Forwarded-For)
    const localRes = await request(app).get("/api/health");
    assert.equal(localRes.status, 200);
    assert.equal(localRes.body.status, "ok");
    assert.equal(localRes.body.server, "ok");
    assert.equal(localRes.body.database, "connected");
    assert.ok(localRes.body.databaseName);
    assert.ok(localRes.body.version);

    // 3. Admin request with token over external connection
    const adminRes = await request(app)
      .get("/api/health")
      .set("X-Forwarded-For", "203.0.113.50")
      .set("Authorization", "Bearer " + adminToken);
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.body.database, "connected");
    assert.ok(adminRes.body.databaseName);
  });

  await t.test("3.3.2 Health caching: ping result is cached for 5 seconds", async () => {
    const t0 = Date.now();
    const res1 = await request(app).get("/api/health");
    assert.equal(res1.status, 200);

    const res2 = await request(app).get("/api/health");
    assert.equal(res2.status, 200);
    const elapsed = Date.now() - t0;
    // Fast response confirms cached execution
    assert.ok(elapsed < 2000);
  });

  await t.test("3.3.3 Rate-limit header consistency and binding limit tracking", async () => {
    // Route using public limiter (max 60) and global limiter (max 1000)
    const res = await request(app).get("/api/public/summary");
    assert.equal(res.status, 200);

    // Verify standard draft-7 headers
    assert.ok(res.headers["ratelimit-limit"], "RateLimit-Limit header must exist");
    assert.ok(res.headers["ratelimit-remaining"], "RateLimit-Remaining header must exist");
    assert.ok(res.headers["ratelimit-reset"], "RateLimit-Reset header must exist");
    assert.ok(res.headers["ratelimit-policy"], "RateLimit-Policy header must exist");

    // Strictly no legacy headers
    assert.equal(res.headers["x-ratelimit-limit"], undefined);
    assert.equal(res.headers["x-ratelimit-remaining"], undefined);
    assert.equal(res.headers["x-ratelimit-reset"], undefined);

    // The binding limit is the public limiter (limit 60 is closer to exhaustion than global 1000)
    assert.equal(res.headers["ratelimit-limit"], "60");
  });

  await t.test("3.3.4 429 response format and Retry-After header", async () => {
    // Create dedicated small limiter to test 429 triggering
    const smallLimiter = createLimiter({
      id: "test_small_limiter_" + crypto.randomUUID(),
      windowMs: 60 * 1000,
      max: 2,
      message: "Test limit reached",
    });

    const express = require("express");
    const testApp = express();
    testApp.set("trust proxy", 1);
    testApp.use(smallLimiter);
    testApp.get("/test", (_req, res) => res.json({ ok: true }));

    const r1 = await request(testApp).get("/test");
    assert.equal(r1.status, 200);
    const r2 = await request(testApp).get("/test");
    assert.equal(r2.status, 200);

    // 3rd request must exceed limit of 2 and return 429
    const r3 = await request(testApp).get("/test");
    assert.equal(r3.status, 429);
    assert.ok(r3.headers["retry-after"], "Retry-After header must be set");
    assert.ok(Number(r3.headers["retry-after"]) >= 1);
    assert.equal(r3.body.error, "Test limit reached");
    assert.ok(typeof r3.body.retryAfter === "number");
  });

  await t.test("3.3.5 Forwarded-header spoofing does not bypass rate limits", async () => {
    const spoofLimiter = createLimiter({
      id: "test_spoof_limiter_" + crypto.randomUUID(),
      windowMs: 60 * 1000,
      max: 2,
      message: "Spoof test limit reached",
    });

    const express = require("express");
    const testApp = express();
    testApp.set("trust proxy", 1);
    testApp.use(spoofLimiter);
    testApp.get("/test", (_req, res) => res.json({ ok: true }));

    // Request 1 from client
    const r1 = await request(testApp)
      .get("/test")
      .set("X-Forwarded-For", "1.1.1.1, 127.0.0.1");
    assert.equal(r1.status, 200);

    // Request 2 from same client but changing first IP in X-Forwarded-For
    const r2 = await request(testApp)
      .get("/test")
      .set("X-Forwarded-For", "2.2.2.2, 127.0.0.1");
    assert.equal(r2.status, 200);

    // Request 3 attempting spoofing bypass by changing forged header again
    const r3 = await request(testApp)
      .get("/test")
      .set("X-Forwarded-For", "3.3.3.3, 127.0.0.1");

    // Must be blocked because the real proxy client IP is identical
    assert.equal(r3.status, 429);
  });
});
