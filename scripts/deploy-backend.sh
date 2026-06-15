#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${RCA_ARCHIVE_APP_DIR:-/opt/apps/rca_archive}"
CONFIG_ENV="${RCA_ARCHIVE_CONFIG_ENV:-/opt/configs/rca_archive/.env}"
BACKEND_DIR="$APP_DIR/rcabackend"
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
  pm2 logs "$PM2_NAME" --lines 30 --nostream || true
  return 1
}

if [[ ! -f "$CONFIG_ENV" ]]; then
  echo "ERROR: Missing $CONFIG_ENV"
  exit 1
fi

echo "Deploying RCA Archive backend from $REPO_ROOT to $APP_DIR"

mkdir -p "$BACKEND_DIR" "$BACKEND_DIR/uploads"

rsync -a --delete \
  --exclude node_modules \
  --exclude uploads \
  "$REPO_ROOT/rcabackend/" "$BACKEND_DIR/"

cp "$REPO_ROOT/ecosystem.config.cjs" "$APP_DIR/ecosystem.config.cjs"

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
