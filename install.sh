#!/usr/bin/env bash
# AutoPost installer — no .env file is used or created.
#
# Two modes:
#   ./install.sh secrets   Generate the secret values to paste into the
#                          Portainer Stack "Environment variables" panel.
#   ./install.sh           Local CLI deploy: prompts for required values,
#                          exports them into the shell environment and runs
#                          docker compose (compose reads shell env directly).
#
# Portainer deployment itself needs NO script: add the repo as a Stack,
# fill in the environment variables in the UI, click Deploy.
set -euo pipefail
cd "$(dirname "$0")"

gen_secrets() {
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
  echo "REDIS_PASSWORD=$(openssl rand -hex 24)"
  echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
}

if [ "${1:-}" = "secrets" ]; then
  echo "# Paste these into Portainer -> Stack -> Environment variables,"
  echo "# together with your own values for:"
  echo "#   TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_IDS, OPENAI_API_KEY"
  echo "#   (optional) REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN, REDDIT_USER_AGENT"
  echo ""
  gen_secrets
  exit 0
fi

echo "==> AutoPost local CLI install (for Portainer, run: ./install.sh secrets)"

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin missing. Install docker-compose-plugin and re-run." >&2
  exit 1
fi

prompt_var() {
  local name="$1" current="${!1:-}"
  if [ -z "$current" ]; then
    read -r -p "  ${name}: " value
    export "${name}=${value}"
  else
    echo "  ${name}: (from shell env)"
  fi
}

echo "==> Required configuration (values are exported to the shell, never written to disk):"
prompt_var TELEGRAM_BOT_TOKEN
prompt_var TELEGRAM_ALLOWED_USER_IDS
prompt_var OPENAI_API_KEY

export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -hex 24)}"
export REDIS_PASSWORD="${REDIS_PASSWORD:-$(openssl rand -hex 24)}"
export ENCRYPTION_KEY="${ENCRYPTION_KEY:-$(openssl rand -hex 32)}"

echo ""
echo "==> SAVE THESE VALUES NOW (needed for every future 'docker compose up' and for restores):"
echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
echo "REDIS_PASSWORD=${REDIS_PASSWORD}"
echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}"
echo ""
read -r -p "Press ENTER once you have stored them safely..."

echo "==> Building and starting containers..."
docker compose build
docker compose up -d

echo "==> Waiting for app to come up..."
sleep 5
docker compose logs --tail=20 app

echo ""
echo "==> Done. Message the bot on Telegram and send /start."
echo "    Logs: docker compose logs -f app"
