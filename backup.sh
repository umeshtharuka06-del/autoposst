#!/usr/bin/env bash
# Backs up PostgreSQL + media into ./backups/<timestamp>/ — no .env file used.
# Credentials are read from INSIDE the running containers, so nothing needs
# to be configured to run a backup.
#
# Works for CLI deploys (docker compose in this directory) and for Portainer
# stacks: set PG_CONTAINER / APP_CONTAINER to the container names, e.g.
#   PG_CONTAINER=autopost-postgres-1 APP_CONTAINER=autopost-app-1 ./backup.sh
set -euo pipefail
cd "$(dirname "$0")"

STAMP=$(date +%Y%m%d_%H%M%S)
DEST="backups/${STAMP}"
mkdir -p "$DEST"

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

echo "==> Dumping database (credentials read from the postgres container env)..."
pg_exec sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "${DEST}/db.dump"

echo "==> Archiving media volume..."
app_exec tar -czf - -C /app storage > "${DEST}/storage.tar.gz"

# Keep the 14 most recent backups.
ls -1dt backups/*/ 2>/dev/null | tail -n +15 | xargs -r rm -rf

echo "==> Backup complete: ${DEST}"
echo "    NOTE: platform tokens in the DB are AES-encrypted with ENCRYPTION_KEY."
echo "    Keep your ENCRYPTION_KEY (from Portainer env vars) stored safely —"
echo "    a restored database is useless without it."
