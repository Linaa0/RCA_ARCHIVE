const path = require("path");

const appDir = process.env.RCA_ARCHIVE_APP_DIR || "/opt/apps/rca_archive";
const configEnv =
  process.env.RCA_ARCHIVE_CONFIG_ENV || "/opt/configs/rca_archive/.env";

module.exports = {
  apps: [
    {
      name: "rca-archive-backend",
      cwd: path.join(appDir, "rcabackend"),
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
      },
      env_file: configEnv,
    },
  ],
};
