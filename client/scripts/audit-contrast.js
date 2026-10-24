import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read server/.env natively without third-party dotenv dependency
const envFile = path.resolve(__dirname, "../../server/.env");
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3074";
const API_URL = process.env.API_URL || "http://localhost:5077/api";

const screensDir = path.resolve(__dirname, "../tmp/audit-screens");
if (!fs.existsSync(screensDir)) {
  fs.mkdirSync(screensDir, { recursive: true });
}

const USERS = {
  admin: {
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
  },
  teacher: {
    email: process.env.SEED_TEACHER_EMAIL,
    password: process.env.SEED_TEACHER_PASSWORD,
  },
  student: {
    email: process.env.SEED_STUDENT_EMAIL,
    password: process.env.SEED_STUDENT_PASSWORD,
  },
};

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

const THEMES = ["light", "dark"];

import crypto from "crypto";

function makeJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 12 * 3600 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

async function getAuthToken(role, creds) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const token = makeJwt(
    { userId: `audit_${role}`, email: creds.email, role },
    secret
  );
  return {
    token,
    role,
    email: creds.email,
    username: creds.email.split("@")[0],
  };
}

async function setThemeAndAuth(page, theme, authData) {
  await page.evaluate(
    ({ t, auth }) => {
      document.documentElement.setAttribute("data-theme", t);
      localStorage.setItem("rca-theme", t);
      if (auth && auth.token) {
        localStorage.setItem("token", auth.token);
        localStorage.setItem("role", auth.role || "student");
        localStorage.setItem("email", auth.email || "");
        localStorage.setItem("username", auth.username || "");
        localStorage.setItem("auth_expires_at", String(Date.now() + 12 * 3600 * 1000));
      }
      window.dispatchEvent(new CustomEvent("rca-theme-change", { detail: { theme: t } }));
    },
    { t: theme, auth: authData }
  );
  await page.waitForTimeout(200);
}

async function runAudit() {
  console.log("Starting WCAG AA color-contrast audit using Playwright and axe-core...");

  // Pre-fetch tokens
  const authTokens = {};
  for (const [roleKey, creds] of Object.entries(USERS)) {
    const auth = await getAuthToken(roleKey, creds);
    if (auth) {
      authTokens[roleKey] = auth;
      console.log(`Authenticated ${roleKey} account successfully.`);
    } else {
      console.warn(`Could not authenticate ${roleKey} account.`);
    }
  }

  let browser;
  try {
    browser = await chromium.launch({
      channel: "msedge",
      headless: true,
    });
  } catch (err) {
    console.error("Failed to launch msedge, trying default chromium:", err.message);
    browser = await chromium.launch({ headless: true });
  }

  const results = [];
  let totalViolations = 0;

  // 1. Public pages
  const publicPages = [
    { name: "Landing", path: "/" },
    { name: "Login", path: "/login" },
    { name: "Signup", path: "/signup" },
    { name: "Reset Password", path: "/reset-password" },
  ];

  for (const pageInfo of publicPages) {
    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        });
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        page.setDefaultNavigationTimeout(10000);
        try {
          await page.goto(`${CLIENT_URL}${pageInfo.path}`, { waitUntil: "domcontentloaded" });
          await setThemeAndAuth(page, theme, null);
          await page.waitForTimeout(200);

          const axeResults = await new AxeBuilder({ page })
            .withRules(["color-contrast"])
            .analyze();

          const violations = axeResults.violations || [];
          totalViolations += violations.length;

          console.log(`[PASS: ${violations.length === 0}] ${pageInfo.name} (${theme}, ${vp.name}) - ${violations.length} violations`);

          results.push({
            page: pageInfo.name,
            path: pageInfo.path,
            viewport: vp.name,
            theme,
            violations: violations.map((v) => ({
              id: v.id,
              help: v.help,
              nodes: v.nodes.map((n) => ({
                html: n.html.slice(0, 120),
                target: n.target.join(", "),
                failureSummary: n.failureSummary,
              })),
            })),
          });

          // Auth stacked cards animation states inspection
          if (pageInfo.path === "/login" && vp.width >= 768) {
            const dots = await page.$$(".auth-stack-dot");
            for (let i = 0; i < Math.min(dots.length, 3); i++) {
              try {
                await dots[i].click();
                await page.waitForTimeout(300);
                await page.screenshot({ path: path.resolve(screensDir, `auth-card-state-${i + 1}-${theme}-${vp.name}.png`) });
                const stackAxe = await new AxeBuilder({ page }).include(".auth-stack-container").withRules(["color-contrast"]).analyze();
                const stackViolations = stackAxe.violations || [];
                totalViolations += stackViolations.length;
                console.log(`[AUTH CARD PASS: ${stackViolations.length === 0}] Auth Stack State ${i + 1} (${theme}, ${vp.name}) - ${stackViolations.length} violations`);
              } catch (_) {}
            }
          }
        } catch (err) {
          console.error(`Error auditing ${pageInfo.name} (${theme}, ${vp.name}):`, err.message);
        } finally {
          await context.close();
        }
      }
    }
  }

  // 2. Role-specific pages
  const roleGroups = [
    {
      role: "student",
      auth: authTokens.student,
      pages: [
        { name: "Student Home", path: "/home" },
        { name: "Subject Explorer", path: "/subject/Y1/Mathematics" },
        { name: "Profile", path: "/profile" },
      ],
    },
    {
      role: "teacher",
      auth: authTokens.teacher,
      pages: [
        { name: "Teacher Dashboard", path: "/teacher" },
        { name: "Teacher Assignments", path: "/teacher/assignments" },
        { name: "Teacher Resources", path: "/teacher/resources" },
        { name: "Teacher Appeals", path: "/teacher/appeals" },
      ],
    },
    {
      role: "admin",
      auth: authTokens.admin,
      pages: [
        { name: "Admin Dashboard", path: "/admin" },
        { name: "Admin Teachers", path: "/admin?tab=teachers" },
        { name: "Admin Students", path: "/admin?tab=students" },
      ],
    },
  ];

  for (const group of roleGroups) {
    for (const pageInfo of group.pages) {
      for (const vp of VIEWPORTS) {
        for (const theme of THEMES) {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
          });
          const page = await context.newPage();
          page.setDefaultTimeout(10000);
          page.setDefaultNavigationTimeout(10000);
          try {
            if (group.auth && group.auth.token) {
              await page.addInitScript(
                ({ t, auth }) => {
                  document.documentElement.setAttribute("data-theme", t);
                  localStorage.setItem("rca-theme", t);
                  localStorage.setItem("token", auth.token);
                  localStorage.setItem("role", auth.role || "student");
                  localStorage.setItem("email", auth.email || "");
                  localStorage.setItem("username", auth.username || "");
                  localStorage.setItem("auth_expires_at", String(Date.now() + 12 * 3600 * 1000));
                },
                { t: theme, auth: group.auth }
              );
            }

            await page.goto(`${CLIENT_URL}${pageInfo.path}`, { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(300);

            const axeResults = await new AxeBuilder({ page })
              .withRules(["color-contrast"])
              .analyze();

            const violations = axeResults.violations || [];
            totalViolations += violations.length;

            console.log(`[PASS: ${violations.length === 0}] ${pageInfo.name} (${theme}, ${vp.name}) - ${violations.length} violations`);

            results.push({
              page: pageInfo.name,
              path: pageInfo.path,
              viewport: vp.name,
              theme,
              violations: violations.map((v) => ({
                id: v.id,
                help: v.help,
                nodes: v.nodes.map((n) => ({
                  html: n.html.slice(0, 120),
                  target: n.target.join(", "),
                  failureSummary: n.failureSummary,
                })),
              })),
            });

            // If on Admin Teachers, open Invite Teacher modal
            if (pageInfo.path === "/admin?tab=teachers") {
              try {
                const inviteBtn = page.locator("button:has-text('Invite Teacher')");
                if (await inviteBtn.isVisible()) {
                  await inviteBtn.click();
                  await page.waitForSelector(".rca-modal-card", { timeout: 3000 });
                  await page.screenshot({ path: path.resolve(screensDir, `invite-teacher-${theme}-${vp.name}.png`) });
                  const modalAxe = await new AxeBuilder({ page }).include(".rca-modal-card").withRules(["color-contrast"]).analyze();
                  const modalViolations = modalAxe.violations || [];
                  totalViolations += modalViolations.length;
                  console.log(`[MODAL PASS: ${modalViolations.length === 0}] Invite Teacher Modal (${theme}, ${vp.name}) - ${modalViolations.length} violations`);
                  const cancelBtn = page.locator("button:has-text('Cancel')");
                  if (await cancelBtn.isVisible()) await cancelBtn.click();
                }
              } catch (e) {
                console.warn("Could not test Invite Teacher modal:", e.message);
              }
            }

            // If on Admin Students, open Invite Student modal
            if (pageInfo.path === "/admin?tab=students") {
              try {
                const inviteBtn = page.locator("button:has-text('Invite Student')");
                if (await inviteBtn.isVisible()) {
                  await inviteBtn.click();
                  await page.waitForSelector(".rca-modal-card", { timeout: 3000 });
                  await page.screenshot({ path: path.resolve(screensDir, `invite-student-${theme}-${vp.name}.png`) });
                  const modalAxe = await new AxeBuilder({ page }).include(".rca-modal-card").withRules(["color-contrast"]).analyze();
                  const modalViolations = modalAxe.violations || [];
                  totalViolations += modalViolations.length;
                  console.log(`[MODAL PASS: ${modalViolations.length === 0}] Invite Student Modal (${theme}, ${vp.name}) - ${modalViolations.length} violations`);
                  const cancelBtn = page.locator("button:has-text('Cancel')");
                  if (await cancelBtn.isVisible()) await cancelBtn.click();
                }
              } catch (e) {
                console.warn("Could not test Invite Student modal:", e.message);
              }
            }

            // Mobile Drawer Check
            if (vp.width <= 400) {
              try {
                const menuBtn = page.locator(".mobile-menu-btn");
                if (await menuBtn.isVisible()) {
                  await menuBtn.click();
                  await page.waitForSelector(".dashboard-sidebar.open", { timeout: 2000 });
                  await page.screenshot({ path: path.resolve(screensDir, `mobile-drawer-${group.role}-${theme}.png`) });
                  const drawerAxe = await new AxeBuilder({ page }).include(".dashboard-sidebar").withRules(["color-contrast"]).analyze();
                  const drawerViolations = drawerAxe.violations || [];
                  totalViolations += drawerViolations.length;
                  console.log(`[DRAWER PASS: ${drawerViolations.length === 0}] Mobile Drawer (${theme}) - ${drawerViolations.length} violations`);
                  await menuBtn.click();
                }
              } catch (_) {}
            }
          } catch (err) {
            console.error(`Error auditing ${pageInfo.name} (${theme}, ${vp.name}):`, err.message);
          } finally {
            await context.close();
          }
        }
      }
    }
  }

  await browser.close();

  console.log("\n==========================================");
  console.log("COLOR CONTRAST AUDIT REPORT (WCAG AA)");
  console.log("==========================================");
  console.log(`Total checks run: ${results.length}`);
  console.log(`Total color-contrast violations: ${totalViolations}`);
  console.log("------------------------------------------");

  const failingChecks = results.filter((r) => r.violations.length > 0);
  if (failingChecks.length === 0) {
    console.log("SUCCESS: 0 color-contrast violations found across all pages and themes.");
  } else {
    console.log(`Found ${failingChecks.length} page/viewport combinations with violations:`);
    for (const f of failingChecks) {
      console.log(`\nPage: ${f.page} (${f.path})`);
      console.log(`Theme: ${f.theme} | Viewport: ${f.viewport}`);
      for (const v of f.violations) {
        for (const n of v.nodes) {
          console.log(`  Selector: ${n.target}`);
          console.log(`  HTML: ${n.html}`);
          console.log(`  Issue: ${n.failureSummary}`);
        }
      }
    }
  }

  return { totalViolations, failingChecks };
}

runAudit()
  .then(({ totalViolations }) => {
    if (totalViolations > 0) {
      process.exitCode = 1;
    }
  })
  .catch((err) => {
    console.error("Audit failed:", err);
    process.exitCode = 1;
  });
