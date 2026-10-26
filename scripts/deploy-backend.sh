#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${RCA_ARCHIVE_APP_DIR:-/opt/apps/rca_archive}"
CONFIG_ENV="${RCA_ARCHIVE_CONFIG_ENV:-/opt/configs/rca_archive/.env}"
BACKEND_DIR="$APP_DIR/server"
PM2_NAME="${RCA_ARCHIVE_PM2_NAME:-rca-archive-backend}"
REPO_ROOT="${GITHUB_WORKSPACE:-$(cd "$(dirname "$0")/.." && pwd)}"

read_port() {
  local env_file="$1"
  local port
  port=$(grep -E '^PORT=' "$env_file" | tail -1 | cut -d= -f2- | tr -d ' \r"'"'"'' | sed 's/#.*//')
  if [[ "$port" =~ ^[0-9]+$ ]]; then
    echo "$port"
  else
    echo "5009"
  fi
}

wait_for_health() {
  local port="$1"
  local label="$2"
  local max_attempts="${3:-60}"
  local sleep_seconds="${4:-3}"
  local url="http://127.0.0.1:${port}/api/health"

  echo "Waiting for ${label} at ${url} (up to $((max_attempts * sleep_seconds))s)..."

  for i in $(seq 1 "$max_attempts"); do
    if curl -fsS \
      --connect-timeout 5 \
      --max-time 20 \
      --retry 2 \
      --retry-delay 2 \
      --retry-all-errors \
      "$url" >/dev/null 2>&1; then
      echo "${label} is healthy on port ${port} (attempt ${i}/${max_attempts})"
      return 0
    fi
    echo "Health check pending... (${i}/${max_attempts})"
    sleep "$sleep_seconds"
  done

  echo "ERROR: ${label} did not become healthy after $((max_attempts * sleep_seconds))s"
  echo "--- Safe Process Status Summary ---"
  pm2 jlist 2>/dev/null | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      try {
        const list = JSON.parse(s);
        if (!list.length) { console.log("No PM2 processes found for this user."); return; }
        for (const p of list) {
          const up = p.pm2_env.pm_uptime ? Math.round((Date.now()-p.pm2_env.pm_uptime)/60000) : 0;
          console.log(`${p.name}: status=${p.pm2_env.status} restarts=${p.pm2_env.restart_time} uptime_min=${up} memory_mb=${Math.round((p.monit.memory||0)/1048576)}`);
        }
      } catch (e) { console.log("Could not read PM2 status."); }
    });' || true
  return 1
}

if [[ ! -f "$CONFIG_ENV" ]]; then
  echo "ERROR: Configuration file is missing at: $CONFIG_ENV"
  echo "Deployment aborted before changing or stopping running application."
  exit 1
fi

if [[ ! -r "$CONFIG_ENV" ]]; then
  echo "ERROR: Configuration file is not readable at: $CONFIG_ENV"
  echo "Deployment aborted before changing or stopping running application."
  exit 1
fi

echo "Running pre-flight environment settings check..."
node "$REPO_ROOT/server/scripts/check-env.js" "$CONFIG_ENV"

echo "Deploying RCA Archive backend from $REPO_ROOT to $APP_DIR"

SYNC_HELPER="$REPO_ROOT/scripts/backend-sync.sh"
# Backups live outside the deployed code tree so a deploy can never remove them.
BACKUP_ROOT="${RCA_ARCHIVE_BACKUP_DIR:-/opt/backups/rca_archive}"
if ! mkdir -p "$BACKUP_ROOT" 2>/dev/null; then
  BACKUP_ROOT="${HOME}/rca_archive_backups"
fi

mkdir -p "$BACKEND_DIR" "$BACKEND_DIR/uploads" "$BACKEND_DIR/submissions"

echo "Creating safety backup of uploads and submissions in $BACKUP_ROOT..."
bash "$SYNC_HELPER" backup "$BACKEND_DIR" "$CONFIG_ENV" "$BACKUP_ROOT" || echo "Backup step reported a problem, continuing deploy."

# rsync --delete removes files that are not in the repository. Every runtime
# data folder (uploads, submissions, backups, tmp, logs and any UPLOADS_DIR or
# SUBMISSIONS_DIR inside the app directory) is excluded so it is never touched.
bash "$SYNC_HELPER" sync "$REPO_ROOT/server" "$BACKEND_DIR" "$CONFIG_ENV"

cp "$REPO_ROOT/server/ecosystem.config.cjs" "$APP_DIR/ecosystem.config.cjs"

ln -sf "$CONFIG_ENV" "$APP_DIR/.env"
ln -sf "$CONFIG_ENV" "$BACKEND_DIR/.env"

PORT=$(read_port "$CONFIG_ENV")
export PORT

echo "Installing backend dependencies in $BACKEND_DIR..."
cd "$BACKEND_DIR"

npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm config set maxsockets 3

install_deps() {
  npm ci --omit=dev --no-audit --no-fund
}

MAX_ATTEMPTS=5
attempt=1
until install_deps; do
  if (( attempt >= MAX_ATTEMPTS )); then
    echo "ERROR: npm ci failed after ${MAX_ATTEMPTS} attempts"
    exit 1
  fi
  echo "npm ci failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in 15s..."
  sleep 15
  (( attempt++ )) || true
done

echo "Reloading PM2 process: $PM2_NAME"
cd "$APP_DIR"
export RCA_ARCHIVE_APP_DIR="$APP_DIR"
export RCA_ARCHIVE_CONFIG_ENV="$CONFIG_ENV"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

wait_for_health "$PORT" "$PM2_NAME" 60 3

echo "Deploy finished. Backend: $BACKEND_DIR (port ${PORT})"
