# RCA Archive Server Operations Guide

This guide explains how to manage, inspect, and update the RCA Archive production backend entirely through GitHub Actions without requiring direct SSH terminal access.

---

## 1. Architecture Overview

- **Host Environment**: Ubuntu Linux VPS running a GitHub Actions self-hosted runner.
- **Application Directory**: `/opt/apps/rca_archive`
- **Configuration Path**: `/opt/configs/rca_archive/.env`
- **Process Manager**: PM2 running process `rca-archive-backend` in fork mode (instances: 1).
- **Reverse Proxy**: Nginx routing `api.archive.innov.rw` to `127.0.0.1:5009` with WebSocket upgrade for Socket.IO.
- **Database**: Local MongoDB service (`mongodb://127.0.0.1:27017/rca_past_papers`).
- **Data Storage**:
  - `UPLOADS_DIR`: Uploaded past papers and lecture notes (default: `server/uploads`).
  - `SUBMISSIONS_DIR`: Student assignment submissions and attachments (default: `server/submissions`).
  - **Recommendation**: In production, configure `UPLOADS_DIR` and `SUBMISSIONS_DIR` in `/opt/configs/rca_archive/.env` to point to a dedicated storage location outside the code repository (for example `/opt/data/rca_archive/uploads` and `/opt/data/rca_archive/submissions`). Deployments automatically exclude all runtime data folders and create a pre-deploy backup in `/opt/backups/rca_archive/`.

---

## 2. Remote Operations via GitHub Actions

Because direct SSH access is restricted, all administrative server management is performed via GitHub Actions workflows executing on the self-hosted runner.

### A. Deploy Backend Changes (`deploy-backend.yml`)
- **Trigger**: Automatic on git push to `main` with changes in `server/**`, `scripts/deploy-backend.sh`, or manual dispatch via the Actions tab.
- **Actions Performed**:
  1. Runs pre-flight settings verification: `node server/scripts/check-env.js /opt/configs/rca_archive/.env`.
  2. Syncs server directory using `rsync` while preserving active storage uploads and dependencies.
  3. Re-installs production dependencies with exponential backoff retries.
  4. Reloads PM2 service via `pm2 startOrReload ecosystem.config.cjs --update-env`.
  5. Performs health check at `http://127.0.0.1:${PORT}/api/health` up to 180 seconds.
  6. Outputs safe process metrics on completion.

### B. Update Server Configuration (`update-server-env.yml`)
- **Trigger**: Manual via GitHub Actions tab ("Run workflow").
- **Inputs**:
  - `variable_name`: The key to set or modify (e.g., `MAIL_PROVIDER`, `BREVO_API_KEY`, `RESEND_API_KEY`, `SMTP_PASS`, `SEED_ADMIN_PASSWORD`).
  - `variable_value`: The new value. The workflow automatically masks this value in GitHub logs using `::add-mask::`.
  - `reload_pm2`: Boolean (default: true). Automatically reloads PM2 so the changes take effect immediately.
- **Safety Features**:
  1. Creates an atomic timestamped backup copy (`/opt/configs/rca_archive/.env.bak-<timestamp>`).
  2. Validates new configuration with `server/scripts/check-env.js` before saving.
  3. Aborts and preserves original file if pre-flight validation fails.
  4. Replaces target file atomically.

### C. Inspect Server Status (`server-status.yml`)
- **Trigger**: Daily scheduled run at 06:00 UTC or manual dispatch.
- **Reported Information**:
  - Disk utilization (`df -h /`).
  - Memory consumption (`free -h`).
  - System load averages and server uptime.
  - Safe PM2 process metrics (PID, status, restarts, memory usage, CPU).
  - Internal HTTP `/api/health` and `/api/curriculum` endpoint status.
  - Zero sensitive configuration data or secrets exposed.

### D. Continuous Integration (`ci.yml`)
- **Trigger**: Automatic on all pull requests and pushes to `main`.
- **Environment**: Standard GitHub-hosted `ubuntu-latest` runner.
- **Checks**:
  - Starts clean MongoDB 6.0 service container.
  - Runs full 30-test server test suite (`npm test`).
  - Builds the production React client (`npm run build`).

---

## 3. Pre-Flight Validation Rules

The pre-flight validation utility (`server/scripts/check-env.js`) enforces the following production rules before any deployment or configuration update:

1. `NODE_ENV`: Must be set to `production`. Setting to `development` is rejected.
2. `JWT_SECRET`: Must be defined and contain at least 32 characters.
3. `MONGO_URI`: Must be configured and point to a valid local database.
4. `ADMIN_BOOTSTRAP_PASSWORD`: Legacy cleartext password keys are rejected and must be deleted.
5. Email Provider Settings:
   - When `MAIL_PROVIDER=smtp`: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` must be defined.
   - When `MAIL_PROVIDER=resend`: `RESEND_API_KEY` and `EMAIL_FROM` must be defined.
   - When `MAIL_PROVIDER=brevo`: `BREVO_API_KEY` and `EMAIL_FROM` must be defined.

---

## 4. Secret Hygiene and Audit Protections

- Secrets, passwords, API keys, and OTP codes are strictly barred from git commits, logs, and workflow outputs.
- In `scripts/sync-server-env.js`, updated values are masked to display only prefix and suffix indicators.
- PM2 log dumps that previously exposed command-line arguments and process environment tables have been replaced with safe JSON process summaries.
- In case of failure during health checks, only status codes and safe resource summaries are printed.
