const path = require("path");

const appDir = process.env.RCA_ARCHIVE_APP_DIR || "/opt/apps/rca_archive";
const configEnv =
  process.env.RCA_ARCHIVE_CONFIG_ENV || "/opt/configs/rca_archive/.env";
const appCommit = process.env.APP_COMMIT || process.env.GITHUB_SHA || "";

module.exports = {
  apps: [
    {
      name: "rca-archive-backend",
      cwd: path.join(appDir, "server"),
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
        APP_COMMIT: appCommit,
      },
      env_file: configEnv,
    },
  ],
};
