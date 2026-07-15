#!/usr/bin/env bash
# Pulls the latest code, rebuilds and restarts with zero manual steps.
set -euo pipefail
cd "$(dirname "$0")"

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
