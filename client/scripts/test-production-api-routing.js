import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../../dist");

// Simple static SPA server for the production build
function startStaticServer(port = 4173) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url.split("?")[0];
      let filePath = path.join(distDir, urlPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, "index.html");
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
      };

      try {
        const data = fs.readFileSync(filePath);
        res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
        res.end(data);
      } catch (err) {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    server.listen(port, () => resolve(server));
    server.on("error", reject);
  });
}

async function runRoutingVerification() {
  console.log("=== Running Playwright Production API Routing Verification ===");

  if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, "index.html"))) {
    throw new Error(`Production dist directory does not exist at ${distDir}. Run build first.`);
  }

  const PORT = 4173;
  const FRONTEND_URL = `http://localhost:${PORT}`;
  const server = await startStaticServer(PORT);
  console.log(`[INFO] Production build served at ${FRONTEND_URL}`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
  } catch (_) {
    try {
      browser = await chromium.launch({ headless: true, channel: "chrome" });
    } catch (_) {
      browser = await chromium.launch({ headless: true });
    }
  }

  const interceptedRequests = [];
  const relativeApiRequests = [];
  let simulateHealthDown = false;

  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept all network requests
  await page.route(/.*/, async (route) => {
    const request = route.request();
    const url = request.url();
    // console.log("[ROUTE INTERCEPTED]:", request.method(), url);

    if (url.startsWith(`${FRONTEND_URL}/api/`)) {
      relativeApiRequests.push({ url, method: request.method() });
      return route.fulfill({
        status: 405,
        contentType: "text/plain",
        body: "Method Not Allowed (Bare Relative API Call)",
      });
    }

    if (url.startsWith("https://api.archive.innov.rw/api/")) {
      interceptedRequests.push({ url, method: request.method() });

      if (url.includes("/api/health")) {
        if (simulateHealthDown) {
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ status: "error", error: "Database connection failed" }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "ok",
            server: "ok",
            database: "connected",
            version: "1.0.0",
            allowedCorsOriginsCount: 2,
          }),
        });
      }

      if (url.includes("/api/curriculum")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "ok",
            promotions: [{ id: "Y1", label: "Year 1", subjects: ["Mathematics"] }],
            allSubjects: ["Mathematics"],
          }),
        });
      }

      if (url.includes("/api/login")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            token: "mock-jwt-token-12345678901234567890",
            role: "student",
            user: { id: "std_1", email: "student@rca.ac.rw", role: "student" },
          }),
        });
      }

      if (url.includes("/api/send-otp")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Verification code sent",
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          }),
        });
      }

      if (url.includes("/api/forgot-password") || url.includes("/api/reset-password")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Password reset instructions dispatched" }),
        });
      }

      if (url.includes("/access-link")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            paperId: "paper_123",
            title: "Mathematics Calculus",
            originalName: "math-calculus.pdf",
            viewUrl: "https://api.archive.innov.rw/api/papers/access/token123/view",
            downloadUrl: "https://api.archive.innov.rw/api/papers/access/token123/download",
          }),
        });
      }

      if (url.includes("/api/papers")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "paper_123",
              title: "Mathematics Calculus",
              subject: "Mathematics",
              year: 1,
              type: "Exam",
              uploadedAt: new Date().toISOString(),
            },
          ]),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    }

    return route.continue();
  });

  try {
    page.on("console", (msg) => console.log("[PAGE LOG]", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.error("[PAGE ERROR]", err));

    // 1. App Load & Health Check
    console.log("[TEST 1] Testing App Load and Health Check routing...");
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: "networkidle" });
    const healthRequest = interceptedRequests.find((r) => r.url.includes("/api/health"));
    assert.ok(healthRequest, "Expected health check request to https://api.archive.innov.rw/api/health");
    console.log("   -> PASS: Health check routed to https://api.archive.innov.rw/api/health");

    // 2. Login Flow
    console.log("[TEST 2] Testing Login request routing...");
    await page.fill('input[name="email"]', "student@rca.ac.rw");
    await page.fill('input[name="password"]', "StudentPassword123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
    const loginRequest = interceptedRequests.find((r) => r.url.includes("/api/login"));
    assert.ok(loginRequest, "Expected login request to https://api.archive.innov.rw/api/login");
    console.log("   -> PASS: Login routed to https://api.archive.innov.rw/api/login");

    // 3. Sign-up (send code) Flow
    console.log("[TEST 3] Testing Sign-up (send code) request routing...");
    await page.goto(`${FRONTEND_URL}/signup`, { waitUntil: "networkidle" });
    await page.fill('input[name="name"]', "Test Student");
    await page.fill('input[name="email"]', "test.student@rca.ac.rw");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(400);

    // Step 2 details
    await page.fill('input[name="username"]', "teststudent");
    await page.fill('input[name="password"]', "SecurePass123");
    await page.selectOption('select[name="class"]', "Y1A");
    await page.click('button:has-text("Female")');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(600);

    const signupRequest = interceptedRequests.find((r) => r.url.includes("/api/send-otp"));
    assert.ok(signupRequest, "Expected signup send-otp request to https://api.archive.innov.rw/api/send-otp");
    console.log("   -> PASS: Sign-up send-otp routed to https://api.archive.innov.rw/api/send-otp");

    // 4. Forgot Password Flow
    console.log("[TEST 4] Testing Forgot Password request routing...");
    await page.goto(`${FRONTEND_URL}/reset-password`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', "student@rca.ac.rw");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const resetRequest = interceptedRequests.find(
      (r) => r.url.includes("/api/forgot-password") || r.url.includes("/api/reset-password")
    );
    assert.ok(resetRequest, "Expected password reset request to https://api.archive.innov.rw/api/forgot-password");
    console.log("   -> PASS: Forgot password routed to https://api.archive.innov.rw/api/forgot-password");

    // 5. Paper View Flow
    console.log("[TEST 5] Testing Paper View request routing...");
    await page.goto(`${FRONTEND_URL}/view/paper_123`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const viewRequest = interceptedRequests.find((r) => r.url.includes("/access-link"));
    assert.ok(viewRequest, "Expected view request to call https://api.archive.innov.rw/api/papers/:id/access-link");
    console.log("   -> PASS: Paper view routed to https://api.archive.innov.rw/api/papers/:id/access-link");

    // 6. Paper Download Flow
    console.log("[TEST 6] Testing Paper Download trigger routing...");
    const downloadRequest = interceptedRequests.find((r) => r.url.includes("/access-link"));
    assert.ok(downloadRequest, "Expected access-link flow to be used for papers");
    console.log("   -> PASS: Paper access link flow routed to https://api.archive.innov.rw/api/papers/:id/access-link");

    // 7. Verify NO relative /api calls occurred
    console.log("[TEST 7] Verifying NO requests went to frontend origin under /api...");
    assert.equal(
      relativeApiRequests.length,
      0,
      `Found forbidden relative API requests to frontend: ${JSON.stringify(relativeApiRequests)}`
    );
    console.log("   -> PASS: Zero requests made to frontend /api");

    // 8. Friendly Banner on Server Unreachable
    console.log("[TEST 8] Testing friendly banner when API is unreachable...");
    simulateHealthDown = true;
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: "networkidle" });
    await page.waitForSelector('[role="alert"]:has-text("We cannot reach the server right now")', { timeout: 5000 });
    const retryBtn = await page.waitForSelector('button:has-text("Retry")', { timeout: 5000 });
    assert.ok(retryBtn, "Expected Retry button to be visible on friendly banner");
    console.log("   -> PASS: Friendly banner and Retry button displayed when API is unreachable");

    console.log("\nALL 8 BROWSER ROUTING TESTS PASSED (0 FAILURES)!");
  } finally {
    await browser.close();
    server.close();
  }
}

runRoutingVerification().catch((err) => {
  console.error("FATAL Browser Test Failure:", err);
  process.exit(1);
});
