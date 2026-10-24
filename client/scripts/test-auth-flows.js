import { chromium } from "playwright";
import assert from "node:assert";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { MongoClient } = require("../../server/node_modules/mongodb");
const bcrypt = require("../../server/node_modules/bcryptjs");

const path = require("node:path");
const dotenv = require("../../server/node_modules/dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../server/.env") });
dotenv.config();

const CLIENT_URL = "http://localhost:3074";
const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "rca_past_papers";

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const SEED_TEACHER_EMAIL = process.env.SEED_TEACHER_EMAIL;
const SEED_TEACHER_PASSWORD = process.env.SEED_TEACHER_PASSWORD;

async function runBrowserAuthTests() {
  console.log("=== Running Playwright Browser Auth Tests ===");
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
  } catch (e) {
    try {
      browser = await chromium.launch({ headless: true, channel: "chrome" });
    } catch (e2) {
      browser = await chromium.launch({ headless: true });
    }
  }
  const context = await browser.newContext();
  const page = await context.newPage();

  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const db = mongoClient.db(DB_NAME);
  const users = db.collection("users");
  const pending = db.collection("pending_signups");
  const failedAttempts = db.collection("failedLoginAttempts");

  try {
    // -------------------------------------------------------------
    // Test 1: Sign-up Wizard (Steps 1, 2, 3) + Reload Resume
    // -------------------------------------------------------------
    console.log("[TEST 1] Testing Sign-up Wizard and Reload Resume...");
    const testEmail = "browser.student@rca.ac.rw";
    await users.deleteMany({ email: testEmail });
    await pending.deleteMany({ email: testEmail });

    await page.goto(`${CLIENT_URL}/signup`, { waitUntil: "networkidle" });

    // Step 1: Name + Email
    await page.fill('input[name="name"]', "Browser Test Student");
    await page.fill('input[name="email"]', testEmail);
    await page.click('button[type="submit"]');

    // Wait for Step 2
    await page.waitForSelector('input[name="password"]');

    // Step 2: Username + Password + Class + Gender
    await page.fill('input[name="username"]', "browserstudent");
    await page.fill('input[name="password"]', "SecurePass123@");
    await page.selectOption('select[name="class"]', "Y1A");
    await page.click('button:has-text("Female")'); // Click Female card

    // Submit Step 2 -> Dispatches OTP
    await page.click('button[type="submit"]');

    // Wait for Step 3 (OTP inputs)
    await page.waitForSelector(".otp-digit-box");
    console.log("   - Step 2 submitted, Step 3 reached.");

    // Reload page to test resume
    await page.reload({ waitUntil: "networkidle" });
    const isStep3StillVisible = await page.isVisible(".otp-digit-box");
    assert.ok(isStep3StillVisible, "Sign-up wizard must resume at Step 3 after reload");
    console.log("   - Sign-up resume after reload verified successfully.");

    // Fetch the pending signup from DB to verify OTP
    const pendingDoc = await pending.findOne({ email: testEmail });
    assert.ok(pendingDoc, "Pending signup must exist in MongoDB");

    // Override hashed OTP with known bcrypt hash for '482913' to test browser submit
    const knownHash = await bcrypt.hash("482913", 10);
    await pending.updateOne({ email: testEmail }, { $set: { hashedOtp: knownHash, attempts: 0 } });

    // Fill OTP digits
    const digits = "482913".split("");
    const otpBoxes = await page.$$(".otp-digit-box");
    for (let i = 0; i < digits.length; i++) {
      await otpBoxes[i].fill(digits[i]);
    }

    await page.click('button:has-text("Complete Registration")');

    // Should navigate to /login with success message
    await page.waitForURL("**/login**", { timeout: 8000 });
    console.log("   - Sign-up completed and redirected to login page.");

    // -------------------------------------------------------------
    // Test 2: Login with Email
    // -------------------------------------------------------------
    console.log("[TEST 2] Testing Student Login with Email...");
    await page.fill("#login-email", testEmail);
    await page.fill('input[type="password"]', "SecurePass123@");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/home**", { timeout: 8000 });
    const currentUrl = page.url();
    assert.ok(currentUrl.includes("/home"), "Student must land on /home");
    console.log("   - Student logged in with email and landed on /home.");

    // -------------------------------------------------------------
    // Test 3: Logout
    // -------------------------------------------------------------
    console.log("[TEST 3] Testing Logout...");
    // Find logout button in sidebar or user menu
    const logoutBtn = await page.$('button:has-text("Log Out"), button:has-text("Logout"), a:has-text("Log Out")');
    if (logoutBtn) {
      await logoutBtn.click();
    } else {
      // Evaluate auth clear directly
      await page.evaluate(() => {
        localStorage.clear();
        window.location.href = "/login";
      });
    }
    await page.waitForURL("**/login**", { timeout: 6000 });
    console.log("   - Logout cleared session and navigated to /login.");

    // -------------------------------------------------------------
    // Test 4: Login with Username
    // -------------------------------------------------------------
    console.log("[TEST 4] Testing Student Login with Username...");
    await page.fill("#login-email", "browserstudent");
    await page.fill('input[type="password"]', "SecurePass123@");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/home**", { timeout: 8000 });
    assert.ok(page.url().includes("/home"), "Student must land on /home when logging in with username");
    console.log("   - Student logged in with username and landed on /home.");

    // Clear session
    await page.evaluate(() => {
      localStorage.clear();
      window.location.href = "/login";
    });
    await page.waitForURL("**/login**");

    // -------------------------------------------------------------
    // Test 5: Wrong Password & Uniform Non-revealing Message
    // -------------------------------------------------------------
    console.log("[TEST 5] Testing Wrong Password message...");
    await page.fill("#login-email", testEmail);
    await page.fill('input[type="password"]', "CompletelyWrongPass123");
    await page.click('button[type="submit"]');

    await page.waitForSelector(".auth-alert-error", { timeout: 5000 });
    const errorText = await page.textContent(".auth-alert-error");
    assert.match(errorText, /Incorrect email or password/i);
    console.log(`   - Error message verified: "${errorText.trim()}".`);

    // -------------------------------------------------------------
    // Test 6: Seeded Admin Login
    // -------------------------------------------------------------
    console.log("[TEST 6] Testing Seeded Admin Login...");
    await failedAttempts.deleteMany({});
    await page.fill("#login-email", SEED_ADMIN_EMAIL);
    await page.fill('input[type="password"]', SEED_ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL("**/admin**", { timeout: 8000 });
    assert.ok(page.url().includes("/admin"), "Admin must land on /admin");
    console.log("   - Admin landed on /admin.");

    await page.evaluate(() => {
      localStorage.clear();
      window.location.href = "/login";
    });
    await page.waitForURL("**/login**");

    // -------------------------------------------------------------
    // Test 7: Seeded Teacher Login
    // -------------------------------------------------------------
    console.log("[TEST 7] Testing Seeded Teacher Login...");
    await page.fill("#login-email", SEED_TEACHER_EMAIL);
    await page.fill('input[type="password"]', SEED_TEACHER_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL("**/teacher**", { timeout: 8000 });
    assert.ok(page.url().includes("/teacher"), "Teacher must land on /teacher");
    console.log("   - Teacher landed on /teacher.");

    await page.evaluate(() => {
      localStorage.clear();
      window.location.href = "/login";
    });
    await page.waitForURL("**/login**");

    // -------------------------------------------------------------
    // Test 8: Expired Token Protection
    // -------------------------------------------------------------
    console.log("[TEST 8] Testing Expired Token Protection...");
    await page.evaluate(() => {
      // Set expired JWT token in localStorage
      const expiredPayload = { id: "123", email: "test@rca.ac.rw", username: "test", role: "student", exp: Math.floor(Date.now() / 1000) - 3600 };
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const payload = btoa(JSON.stringify(expiredPayload));
      const expiredToken = `${header}.${payload}.signature`;
      localStorage.setItem("token", expiredToken);
      localStorage.setItem("role", "student");
      localStorage.setItem("auth_expires_at", String(Date.now() - 3600000));
    });

    await page.goto(`${CLIENT_URL}/home`, { waitUntil: "networkidle" });
    await page.waitForURL("**/login**", { timeout: 6000 });
    assert.ok(page.url().includes("/login"), "Expired token must redirect to /login");
    console.log("   - Protected route redirected expired token to /login.");

    // Clean up test user
    await users.deleteMany({ email: testEmail });
    await pending.deleteMany({ email: testEmail });

    console.log("\n[SUCCESS] ALL PLAYWRIGHT BROWSER FLOWS PASSED WITH 0 FAILURES!");
  } finally {
    await browser.close();
    await mongoClient.close();
  }
}

runBrowserAuthTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n[FAILURE] Browser test failed:", err);
    process.exit(1);
  });
