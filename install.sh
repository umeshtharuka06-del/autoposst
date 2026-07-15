#!/usr/bin/env bash
# One-shot installer for Ubuntu VPS (20.04+). Run as a sudo-capable user.
set -euo pipefail

cd "$(dirname "$0")"

echo "==> AutoPost installer"

# --- Docker ---
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin missing. Install docker-compose-plugin and re-run." >&2
  exit 1
fi

# --- .env ---
if [ ! -f .env ]; then
  echo "==> Creating .env from template..."
  cp .env.example .env
  PG_PASS=$(openssl rand -hex 24)
  REDIS_PASS=$(openssl rand -hex 24)
  ENC_KEY=$(openssl rand -hex 32)
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|" .env
  sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=${REDIS_PASS}|" .env
  sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${ENC_KEY}|" .env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://autopost:${PG_PASS}@postgres:5432/autopost?schema=public|" .env
  echo ""
  echo "!!! EDIT .env NOW and set:"
  echo "    TELEGRAM_BOT_TOKEN        (from @BotFather)"
  echo "    TELEGRAM_ALLOWED_USER_IDS (your numeric Telegram ID — @userinfobot)"
  echo "    OPENAI_API_KEY"
  echo "    (optional) REDDIT_* credentials"
  echo ""
  read -r -p "Press ENTER when .env is ready..."
fi

mkdir -p storage/media backups

echo "==> Building and starting containers..."
docker compose build
docker compose up -d

echo "==> Waiting for app to come up..."
sleep 5
docker compose logs --tail=20 app

echo ""
echo "==> Done. The bot is running. Message it on Telegram and send /start."
echo "    Logs:    docker compose logs -f app"
echo "    Update:  ./update.sh"
echo "    Backup:  ./backup.sh"
