const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

test("SYNC SERVER ENV: safely updates configuration without printing secrets", () => {
  const tempEnv = path.resolve(__dirname, "test-sync.env");
  const initialContent = [
    "NODE_ENV=production",
    "PORT=5009",
    "JWT_SECRET=012345678901234567890123456789012345",
    "MONGO_URI=mongodb://127.0.0.1:27017/rca_past_papers",
    "MAIL_PROVIDER=resend",
    "RESEND_API_KEY=re_123456789secretkey",
    "EMAIL_FROM=initial@rca.ac.rw",
  ].join("\n") + "\n";

  fs.writeFileSync(tempEnv, initialContent, "utf8");

  const syncScript = path.resolve(__dirname, "../../scripts/sync-server-env.js");

  try {
    const output = execFileSync(
      process.execPath,
      [syncScript, `--file=${tempEnv}`, "EMAIL_FROM=updated@rca.ac.rw"],
      { encoding: "utf8" }
    );

    assert.ok(output.includes("Updated setting: EMAIL_FROM"));
    assert.ok(!output.includes("re_123456789secretkey"));

    const updated = fs.readFileSync(tempEnv, "utf8");
    assert.ok(updated.includes("EMAIL_FROM=updated@rca.ac.rw"));
    assert.ok(updated.includes("NODE_ENV=production"));
  } finally {
    if (fs.existsSync(tempEnv)) fs.unlinkSync(tempEnv);
    const files = fs.readdirSync(__dirname);
    for (const f of files) {
      if (f.startsWith("test-sync.env.bak")) {
        fs.unlinkSync(path.join(__dirname, f));
      }
    }
  }
});
