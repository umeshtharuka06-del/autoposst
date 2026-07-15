#!/usr/bin/env bash
# Dumps PostgreSQL and archives media storage into ./backups/<timestamp>/
set -euo pipefail
cd "$(dirname "$0")"

STAMP=$(date +%Y%m%d_%H%M%S)
DEST="backups/${STAMP}"
mkdir -p "$DEST"

# shellcheck disable=SC1091
source <(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' .env || true)
POSTGRES_USER=${POSTGRES_USER:-autopost}
POSTGRES_DB=${POSTGRES_DB:-autopost}

echo "==> Dumping database..."
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "${DEST}/db.dump"

echo "==> Archiving media storage..."
tar -czf "${DEST}/storage.tar.gz" storage/

echo "==> Copying .env (contains secrets — keep backups private!)"
cp .env "${DEST}/env.backup"

# Keep the 14 most recent backups.
ls -1dt backups/*/ 2>/dev/null | tail -n +15 | xargs -r rm -rf

echo "==> Backup complete: ${DEST}"
