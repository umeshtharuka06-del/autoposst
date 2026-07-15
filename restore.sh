#!/usr/bin/env bash
# Restores a backup created by backup.sh — no .env file used.
# Usage: ./restore.sh backups/20260715_120000
#
# For Portainer stacks set container names explicitly:
#   PG_CONTAINER=autopost-postgres-1 APP_CONTAINER=autopost-app-1 ./restore.sh backups/<stamp>
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

pg_exec() {
  if [ -n "${PG_CONTAINER:-}" ]; then
    docker exec -i "$PG_CONTAINER" "$@"
  else
    docker compose exec -T postgres "$@"
  fi
}

app_exec() {
  if [ -n "${APP_CONTAINER:-}" ]; then
    docker exec -i "$APP_CONTAINER" "$@"
  else
    docker compose exec -T app "$@"
  fi
}

stop_app() {
  if [ -n "${APP_CONTAINER:-}" ]; then
    docker stop "$APP_CONTAINER"
  else
    docker compose stop app
  fi
}

start_app() {
  if [ -n "${APP_CONTAINER:-}" ]; then
    docker start "$APP_CONTAINER"
  else
    docker compose up -d app
  fi
}

echo "==> Restoring database (credentials read from the postgres container env)..."
pg_exec sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < "${SRC}/db.dump"

echo "==> Stopping app..."
stop_app

echo "==> Restoring media volume..."
start_app
sleep 3
app_exec sh -c 'rm -rf /app/storage/media && mkdir -p /app/storage'
app_exec tar -xzf - -C /app < "${SRC}/storage.tar.gz"

echo "==> Restarting app..."
if [ -n "${APP_CONTAINER:-}" ]; then docker restart "$APP_CONTAINER"; else docker compose restart app; fi

echo "==> Restore complete from ${SRC}"
