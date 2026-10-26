#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_ENV="${RCA_ARCHIVE_CONFIG_ENV:-/opt/configs/rca_archive/.env}"

if [[ ! -r "$CONFIG_ENV" ]]; then
  if [[ -r "$REPO_ROOT/server/.env" ]]; then
    CONFIG_ENV="$REPO_ROOT/server/.env"
  else
    echo "ERROR: Could not read environment file at $CONFIG_ENV or $REPO_ROOT/server/.env"
    exit 1
  fi
fi

echo "Using environment configuration: $CONFIG_ENV"

DB_NAME=$(grep -E '^MONGO_DB_NAME=' "$CONFIG_ENV" | tail -1 | cut -d= -f2- | tr -d ' \r"'"'"'' | sed 's/#.*//')
if [[ -z "$DB_NAME" ]]; then
  DB_NAME="rca_past_papers"
fi

echo "=== RCA Archive Server Database Reset ==="
echo "Target database: $DB_NAME"

cd "$REPO_ROOT/server"
node scripts/reset-db.js --confirm --allow-remote "--db-name=$DB_NAME" "--env-file=$CONFIG_ENV"

PM2_NAME="${RCA_ARCHIVE_PM2_NAME:-rca-archive-backend}"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    echo "Restarting PM2 process $PM2_NAME..."
    pm2 restart "$PM2_NAME" || true
  fi
fi

PORT=$(grep -E '^PORT=' "$CONFIG_ENV" | tail -1 | cut -d= -f2- | tr -d ' \r"'"'"'' | sed 's/#.*//')
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  PORT=5077
fi

HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
echo "Verifying health endpoint at $HEALTH_URL..."
sleep 2

if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  echo "Server health check passed on port $PORT"
else
  echo "Notice: Health check at $HEALTH_URL could not be reached immediately, check PM2 logs if needed."
fi

echo "Database reset and reseed completed successfully."
