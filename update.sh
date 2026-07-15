#!/usr/bin/env bash
# Update helper — no .env file is used.
#
# Portainer: update from the UI instead (Stacks -> your stack ->
# "Pull and redeploy" / re-deploy from git). This script is for CLI deploys.
#
# CLI deploys read configuration from the shell environment. Export the same
# variables you used at install time (POSTGRES_PASSWORD, REDIS_PASSWORD,
# ENCRYPTION_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_IDS,
# OPENAI_API_KEY, ...) before running.
set -euo pipefail
cd "$(dirname "$0")"

for required in POSTGRES_PASSWORD REDIS_PASSWORD ENCRYPTION_KEY TELEGRAM_BOT_TOKEN TELEGRAM_ALLOWED_USER_IDS OPENAI_API_KEY; do
  if [ -z "${!required:-}" ]; then
    echo "ERROR: ${required} is not set in the shell environment." >&2
    echo "Export your deployment variables first, then re-run ./update.sh" >&2
    exit 1
  fi
done

echo "==> Backing up before update..."
./backup.sh || echo "WARN: backup failed, continuing"

if [ -d .git ]; then
  echo "==> Pulling latest code..."
  git pull --ff-only
fi

echo "==> Rebuilding..."
docker compose build app

echo "==> Restarting (migrations run automatically on start)..."
docker compose up -d

docker compose logs --tail=20 app
echo "==> Update complete."
