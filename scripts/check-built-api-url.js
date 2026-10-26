#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const assetsDir = path.join(distDir, "assets");

console.log("[check-built-api-url] Building client with VITE_API_URL unset...");

const cleanEnv = { ...process.env };
delete cleanEnv.VITE_API_URL;
cleanEnv.NODE_ENV = "production";

const clientEnvPath = path.join(rootDir, "client", ".env");
const clientEnvBak = path.join(rootDir, "client", ".env.tmp_build_check");
let envMoved = false;

if (fs.existsSync(clientEnvPath)) {
  fs.renameSync(clientEnvPath, clientEnvBak);
  envMoved = true;
}

try {
  execSync("node scripts/build-client.js", {
    cwd: rootDir,
    env: cleanEnv,
    stdio: "inherit",
  });
} catch (err) {
  console.error("[check-built-api-url] Build failed:", err.message);
  process.exit(1);
} finally {
  if (envMoved && fs.existsSync(clientEnvBak)) {
    fs.renameSync(clientEnvBak, clientEnvPath);
  }
}

if (!fs.existsSync(assetsDir)) {
  console.error(`[check-built-api-url] Assets directory not found at: ${assetsDir}`);
  process.exit(1);
}

const jsFiles = fs.readdirSync(assetsDir).filter((file) => file.endsWith(".js"));
if (jsFiles.length === 0) {
  console.error("[check-built-api-url] No JavaScript bundle files found in assets directory.");
  process.exit(1);
}

let foundProductionApi = false;
const bareRelativeViolations = [];

const TARGET_API_URL = "https://api.archive.innov.rw/api";
const BARE_PATTERNS = [
  /href\s*[:=]\s*["']\/api\//,
  /fetch\s*\(\s*["']\/api\//,
  /window\.open\s*\(\s*["']\/api\//,
  /baseURL\s*:\s*["']\/api["']/,
];

for (const jsFile of jsFiles) {
  const filePath = path.join(assetsDir, jsFile);
  const content = fs.readFileSync(filePath, "utf8");

  if (content.includes(TARGET_API_URL)) {
    foundProductionApi = true;
  }

  for (const pattern of BARE_PATTERNS) {
    if (pattern.test(content)) {
      bareRelativeViolations.push({ file: jsFile, pattern: pattern.toString() });
    }
  }
}

if (!foundProductionApi) {
  console.error(
    `[check-built-api-url] FAIL: Production API URL "${TARGET_API_URL}" was not found in the built bundles.`
  );
  process.exit(1);
}

if (bareRelativeViolations.length > 0) {
  console.error(
    `[check-built-api-url] FAIL: Found bare relative "/api" request patterns in bundles:`,
    bareRelativeViolations
  );
  process.exit(1);
}

console.log(
  "[check-built-api-url] PASS: Production API address verified in bundle and zero bare relative /api requests detected."
);
process.exit(0);
