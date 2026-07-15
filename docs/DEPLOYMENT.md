# Deployment Guide

Two supported paths — **Portainer Stacks (recommended)** and plain Docker Compose CLI. Neither uses a `.env` file: all configuration is plain environment variables.

## A. Portainer Stacks (one-click)

Requirements: Portainer CE with a Docker environment on Ubuntu (or any Linux host).

1. **Portainer → Stacks → Add stack**
2. **Build method: Repository**
   - Repository URL: your git repo URL
   - Compose path: `docker-compose.yml`
   (Portainer builds the app image from the bundled `Dockerfile` automatically.)
3. **Environment variables** — add these in the UI panel:

   | Variable | Required | Value |
   |---|---|---|
   | `TELEGRAM_BOT_TOKEN` | ✅ | from [@BotFather](https://t.me/BotFather) |
   | `TELEGRAM_ALLOWED_USER_IDS` | ✅ | comma-separated numeric IDs ([@userinfobot](https://t.me/userinfobot)); first = owner |
   | `OPENAI_API_KEY` | ✅ | platform.openai.com |
   | `POSTGRES_PASSWORD` | ✅ | long random string |
   | `REDIS_PASSWORD` | ✅ | long random string |
   | `ENCRYPTION_KEY` | ✅ | exactly 64 hex chars (`openssl rand -hex 32`) |
   | `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_REFRESH_TOKEN` / `REDDIT_USER_AGENT` | optional | reddit.com/prefs/apps (script app) |
   | `OPENAI_MODEL`, `LOG_LEVEL`, `TZ`, `WORKER_CONCURRENCY`, … | optional | see comments at the top of `docker-compose.yml` for all defaults |

   Tip: `./install.sh secrets` (or `openssl rand -hex 24` / `-hex 32`) generates the three secret values.

4. **Deploy the stack.** Migrations run automatically on container start. Message your bot `/start`.

**Updating:** Stacks → your stack → *Pull and redeploy* (git) — environment variables are kept by Portainer.

**Data:** everything lives in named volumes `pgdata`, `redisdata`, `mediadata` — redeploys never touch them.

⚠️ Keep `ENCRYPTION_KEY` safe outside Portainer too: platform tokens in the database are encrypted with it and a restored backup is unreadable without it.

## B. Docker Compose CLI

Configuration comes from the shell environment (compose interpolates `${VARS}` directly):

```bash
git clone <your-repo-url> autopost && cd autopost
chmod +x install.sh update.sh backup.sh restore.sh docker-entrypoint.sh
./install.sh        # prompts for required values, generates secrets, deploys
```

`install.sh` never writes a `.env` file — it prints the generated secrets once; store them in your password manager and export them before future `docker compose up` / `./update.sh` runs.

## Connect the platforms (both paths, inside Telegram)

- **Facebook:** get a long-lived Page token (Graph API Explorer, `pages_manage_posts` + `pages_read_engagement`), then `/facebook add <pageId> <token>`. Repeat per Page; `/facebook default <pageId>`.
- **Pinterest:** `/pinterest token <accessToken>` (scopes `boards:read pins:read pins:write`), then `/pinterest boards`, then `/pinterest default <boardId>`.
- **Reddit (drafts only):** set the four `REDDIT_*` stack variables and redeploy. Reddit is never auto-posted — each post produces one draft that you approve or reject in Telegram.

## Day-2 operations

| Task | Portainer | CLI |
|---|---|---|
| Logs | Containers → app → Logs | `docker compose logs -f app` |
| Update | Stack → Pull and redeploy | `./update.sh` (vars exported in shell) |
| Backup | `PG_CONTAINER=<stack>-postgres-1 APP_CONTAINER=<stack>-app-1 ./backup.sh` | `./backup.sh` |
| Restore | same, with `./restore.sh backups/<stamp>` | `./restore.sh backups/<stamp>` |

Backups read database credentials from inside the running containers, so they work without any local configuration.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Stack fails: `variable is required` | a required Portainer environment variable is missing — the error names it |
| Bot silent | app container logs; check `TELEGRAM_BOT_TOKEN` and allowlist IDs |
| `Invalid environment configuration` in app logs | the app prints exactly which variable is wrong (e.g. `ENCRYPTION_KEY must be 64 hex chars`) |
| Facebook `code 190` | Page token expired — `/facebook add` again with a fresh long-lived token |
| Pinterest 401 | `/pinterest token <new>` |
| Publishes stuck FAILED | `/logs` for the reason, `/retry` to re-queue |
