import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3074";
const API_URL = process.env.API_URL || "http://localhost:5077/api";

const USERS = {
  admin: {
    email: process.env.SEED_ADMIN_EMAIL || "deenovdunya01@gmail.com",
    password: process.env.SEED_ADMIN_PASSWORD || "admintesting123@",
  },
  teacher: {
    email: process.env.SEED_TEACHER_EMAIL || "linaaishimwe777@gmail.com",
    password: process.env.SEED_TEACHER_PASSWORD || "teachertesting123@",
  },
  student: {
    email: process.env.SEED_STUDENT_EMAIL || "ishimwelina06@gmail.com",
    password: process.env.SEED_STUDENT_PASSWORD || "studentteacher123@",
  },
};

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

const THEMES = ["light", "dark"];

async function getAuthToken(creds) {
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    });
    if (!res.ok) {
      console.warn(`API login failed for ${creds.email}: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`API login network error for ${creds.email}:`, err.message);
    return null;
  }
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
    const auth = await getAuthToken(creds);
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
