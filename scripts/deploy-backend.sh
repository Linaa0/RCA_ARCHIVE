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

print_port_listener() {
  local port="$1"
  local raw
  raw=$(ss -ltnp "sport = :${port}" 2>/dev/null || ss -ltnp 2>/dev/null | grep -E ":${port}\b" || true)
  if [[ -z "$raw" ]]; then
    echo "Port ${port} listener: not available"
    return
  fi

  local proc
  proc=$(echo "$raw" | sed -nE 's/.*users:\(\("([^"]+)".*/\1/p' | head -n1)
  local pid
  pid=$(echo "$raw" | sed -nE 's/.*pid=([0-9]+).*/\1/p' | head -n1)
  local user=""
  if [[ -n "$pid" ]]; then
    user=$(ps -o user= -p "$pid" 2>/dev/null | tr -d ' ' || true)
    if [[ -z "$proc" ]]; then
      proc=$(ps -o comm= -p "$pid" 2>/dev/null | tr -d ' ' || true)
    fi
  fi

  if [[ -n "$proc" && -n "$user" ]]; then
    echo "Port ${port} listener: user=${user} process=${proc}"
  elif [[ -n "$proc" ]]; then
    echo "Port ${port} listener: process=${proc}"
  else
    echo "Port ${port} listener: not available"
  fi
}

print_current_pm2_process() {
  local target_name="$1"
  local updated_folder="$2"

  echo "=== Current PM2 Process Inspection (${target_name}) ==="
  pm2 jlist 2>/dev/null | node -e '
    let s = "";
    process.stdin.on("data", d => s += d).on("end", () => {
      try {
        const list = JSON.parse(s);
        if (!Array.isArray(list)) {
          console.log("No PM2 process list available.");
          return;
        }
        const target = list.find(p => p.name === process.argv[1]);
        if (!target) {
          console.log(`Process "${process.argv[1]}" is not currently running in PM2.`);
          return;
        }
        const cwd = target.pm2_env?.pm_cwd || "unknown";
        const script = target.pm2_env?.pm_exec_path || "unknown";
        console.log(`Process name: ${target.name}`);
        console.log(`Working directory: ${cwd}`);
        console.log(`Script path: ${script}`);
        const updated = process.argv[2];
        if (cwd === updated) {
          console.log(`Working directory matches updated deployment folder: ${updated}`);
        } else {
          console.log(`Working directory differs: running from ${cwd}, updated folder is ${updated}`);
        }
      } catch (e) {
        console.log("Could not inspect current PM2 process.");
      }
    });' "$target_name" "$updated_folder" || true
}

verify_deployment() {
  local port="$1"
  local expected_commit="$2"
  local max_attempts="${3:-60}"
  local sleep_seconds="${4:-3}"
  local health_url="http://127.0.0.1:${port}/api/health"
  local curriculum_url="http://127.0.0.1:${port}/api/curriculum"

  echo "Verifying deployment at ${health_url} and ${curriculum_url} (expected commit: ${expected_commit})..."

  local last_health_code=""
  local last_curriculum_code=""
  local last_returned_commit=""

  for i in $(seq 1 "$max_attempts"); do
    local health_response
    health_response=$(curl -s -w "\n%{http_code}" --connect-timeout 5 --max-time 15 "$health_url" 2>/dev/null || true)
    last_health_code=$(echo "$health_response" | tail -n1)
    local health_body
    health_body=$(echo "$health_response" | sed '$d')

    last_curriculum_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 15 "$curriculum_url" 2>/dev/null || true)

    last_returned_commit=$(echo "$health_body" | node -e '
      let s = "";
      process.stdin.on("data", c => s += c).on("end", () => {
        try {
          const j = JSON.parse(s);
          console.log(j.commit || "");
        } catch (e) {
          console.log("");
        }
      });' 2>/dev/null || true)

    local commit_ok=0
    if [[ -z "$expected_commit" || "$expected_commit" == "unknown" ]]; then
      commit_ok=1
    elif [[ "$last_returned_commit" == "$expected_commit" ]]; then
      commit_ok=1
    fi

    if [[ "$last_health_code" == "200" && "$last_curriculum_code" != "404" && "$last_curriculum_code" == "200" && "$commit_ok" -eq 1 ]]; then
      echo "Verification passed on port ${port} (attempt ${i}/${max_attempts}):"
      echo "  /api/health: HTTP 200, commit=${last_returned_commit}"
      echo "  /api/curriculum: HTTP ${last_curriculum_code}"
      return 0
    fi

    echo "Verification pending (${i}/${max_attempts}): health=${last_health_code:-none}, curriculum=${last_curriculum_code:-none}, commit=${last_returned_commit:-none}..."
    sleep "$sleep_seconds"
  done

  echo ""
  echo "ERROR: Deployment verification failed after $((max_attempts * sleep_seconds))s"

  if [[ "$last_curriculum_code" == "404" ]]; then
    echo "Verification error: /api/curriculum returned 404 Not Found"
  elif [[ -n "$expected_commit" && "$expected_commit" != "unknown" && "$last_returned_commit" != "$expected_commit" ]]; then
    echo "Verification error: Deployed commit mismatch: expected '${expected_commit}', but server returned '${last_returned_commit:-none}'"
  elif [[ "$last_health_code" != "200" ]]; then
    echo "Verification error: /api/health returned HTTP ${last_health_code:-none}"
  elif [[ "$last_curriculum_code" != "200" ]]; then
    echo "Verification error: /api/curriculum returned HTTP ${last_curriculum_code:-none}"
  fi

  print_port_listener "$port"
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

print_current_pm2_process "rca-archive-backend" "$BACKEND_DIR"

APP_COMMIT="${GITHUB_SHA:-$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")}"
export APP_COMMIT
echo "Exported APP_COMMIT: ${APP_COMMIT}"

echo "Deleting PM2 process: rca-archive-backend (if present)"
pm2 delete "rca-archive-backend" 2>/dev/null || true

echo "Starting PM2 process from ecosystem.config.cjs"
cd "$APP_DIR"
export RCA_ARCHIVE_APP_DIR="$APP_DIR"
export RCA_ARCHIVE_CONFIG_ENV="$CONFIG_ENV"
pm2 start ecosystem.config.cjs --update-env
pm2 save

verify_deployment "$PORT" "$APP_COMMIT" 60 3

echo "Deploy finished. Backend: $BACKEND_DIR (port ${PORT})"
