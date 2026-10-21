const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("[build-client] Starting client build...");

const rootDir = path.resolve(__dirname, "..");
const clientDir = path.join(rootDir, "client");
const clientDist = path.join(clientDir, "dist");
const rootDist = path.join(rootDir, "dist");

try {
  // Execute client build
  execSync("npm run build", { cwd: clientDir, stdio: "inherit" });

  if (!fs.existsSync(clientDist)) {
    console.error(`[build-client] ERROR: Expected build output at ${clientDist} but it was not found.`);
    process.exit(1);
  }

  // Ensure root dist exists and copy files
  if (fs.existsSync(rootDist)) {
    fs.rmSync(rootDist, { recursive: true, force: true });
  }
  fs.mkdirSync(rootDist, { recursive: true });
  fs.cpSync(clientDist, rootDist, { recursive: true });

  console.log(`[build-client] Successfully built and synced dist/ to both client/dist and ./dist`);
} catch (error) {
  console.error("[build-client] Build failed:", error.message);
  process.exit(1);
}
