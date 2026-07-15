#!/usr/bin/env bash
# Restores a backup created by backup.sh. Usage: ./restore.sh backups/20260715_120000
set -euo pipefail
cd "$(dirname "$0")"

if [ $# -ne 1 ] || [ ! -d "$1" ]; then
  echo "Usage: ./restore.sh <backup-directory>" >&2
  echo "Available backups:" >&2
  ls -1d backups/*/ 2>/dev/null >&2 || echo "  (none)" >&2
  exit 1
fi
SRC="$1"

read -r -p "This OVERWRITES the current database and media storage. Type 'restore' to continue: " CONFIRM
if [ "$CONFIRM" != "restore" ]; then
  echo "Aborted."
  exit 1
fi

# shellcheck disable=SC1091
source <(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' .env || true)
POSTGRES_USER=${POSTGRES_USER:-autopost}
POSTGRES_DB=${POSTGRES_DB:-autopost}

echo "==> Stopping app..."
docker compose stop app

echo "==> Restoring database..."
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  < "${SRC}/db.dump"

echo "==> Restoring media storage..."
rm -rf storage
tar -xzf "${SRC}/storage.tar.gz"

echo "==> Starting app..."
docker compose up -d app

echo "==> Restore complete from ${SRC}"
