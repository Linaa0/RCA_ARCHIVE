#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function maskValue(val) {
  if (!val) return "(empty)";
  if (val.length <= 4) return "****";
  return val.slice(0, 2) + "****" + val.slice(-2);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let envFilePath = process.env.RCA_ARCHIVE_CONFIG_ENV || "/opt/configs/rca_archive/.env";
  const updates = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--file" && args[i + 1]) {
      envFilePath = args[i + 1];
      i++;
    } else if (arg.startsWith("--file=")) {
      envFilePath = arg.split("=")[1];
    } else if (arg.includes("=")) {
      const idx = arg.indexOf("=");
      const key = arg.slice(0, idx).trim();
      const val = arg.slice(idx + 1).trim();
      if (key) {
        updates[key] = val;
      }
    }
  }

  // Also read from environment variables prefixed with SYNC_ENV_
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("SYNC_ENV_")) {
      const realKey = k.replace(/^SYNC_ENV_/, "");
      updates[realKey] = v;
    }
  }

  return { envFilePath, updates };
}

function updateEnvContent(content, updates) {
  const lines = content.split(/\r?\n/);
  const updatedKeys = new Set();
  const resultLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      resultLines.push(line);
      continue;
    }

    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) {
      const key = match[1];
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        const newVal = updates[key];
        // Quote if containing spaces, hashes, or quotes
        const formattedVal = newVal.includes(" ") || newVal.includes("#") || newVal.includes('"')
          ? `"${newVal.replace(/"/g, '\\"')}"`
          : newVal;
        resultLines.push(`${key}=${formattedVal}`);
        updatedKeys.add(key);
        console.log(`Updated setting: ${key} (masked: ${maskValue(newVal)})`);
        continue;
      }
    }

    resultLines.push(line);
  }

  // Append new keys that were not present in existing file
  for (const [key, val] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      const formattedVal = val.includes(" ") || val.includes("#") || val.includes('"')
        ? `"${val.replace(/"/g, '\\"')}"`
        : val;
      resultLines.push(`${key}=${formattedVal}`);
      console.log(`Added new setting: ${key} (masked: ${maskValue(val)})`);
    }
  }

  return resultLines.join("\n") + "\n";
}

function main() {
  const { envFilePath, updates } = parseArgs();

  if (Object.keys(updates).length === 0) {
    console.log("No setting updates provided. Specify KEY=VALUE arguments.");
    process.exit(0);
  }

  if (!fs.existsSync(envFilePath)) {
    console.error(`Target environment file not found: ${envFilePath}`);
    process.exit(1);
  }

  console.log(`Syncing settings for environment file: ${envFilePath}`);

  const originalContent = fs.readFileSync(envFilePath, "utf8");
  const backupPath = `${envFilePath}.bak-${Date.now()}`;
  fs.writeFileSync(backupPath, originalContent, "utf8");
  console.log(`Created backup at: ${backupPath}`);

  const newContent = updateEnvContent(originalContent, updates);
  const tempPath = `${envFilePath}.tmp-${Date.now()}`;
  fs.writeFileSync(tempPath, newContent, "utf8");

  // Validate the temporary file before applying
  const checkScriptPath = path.resolve(__dirname, "../server/scripts/check-env.js");
  if (fs.existsSync(checkScriptPath)) {
    try {
      execFileSync(process.execPath, [checkScriptPath, tempPath], { stdio: "inherit" });
      console.log("Pre-flight check passed for new environment settings.");
    } catch (err) {
      console.error("Pre-flight check failed. Aborting environment update without modifying active file.");
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      process.exit(1);
    }
  }

  // Atomically replace target file
  fs.renameSync(tempPath, envFilePath);
  console.log("Environment settings successfully updated and saved.");
}

main();
