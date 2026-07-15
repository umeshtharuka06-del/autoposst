# Ubuntu VPS Deployment Guide

Tested on Ubuntu 22.04/24.04, 1 vCPU / 2 GB RAM minimum (2 GB+ recommended for video processing).

## 1. Prepare the server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl openssl

# firewall: the bot uses outbound long polling only — no inbound ports needed
sudo ufw allow OpenSSH
sudo ufw enable
```

Create a non-root user if you don't have one:

```bash
sudo adduser autopost && sudo usermod -aG sudo autopost
su - autopost
```

## 2. Get the code and install

```bash
git clone <your-repo-url> autopost
cd autopost
chmod +x install.sh update.sh backup.sh restore.sh docker-entrypoint.sh
./install.sh
```

`install.sh` installs Docker if missing, generates strong secrets into `.env`, builds the images, applies Prisma migrations automatically on container start, and launches everything.

> If you were just added to the `docker` group, log out and back in before re-running.

## 3. Create the Telegram bot

1. Open [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN`.
2. Get your numeric user ID from [@userinfobot](https://t.me/userinfobot) → put it in `TELEGRAM_ALLOWED_USER_IDS` (comma-separate additional editors; the **first** ID is the owner/admin).
3. `docker compose up -d` (restart after editing `.env`).
4. Message the bot: `/start`.

Security note: the bot uses long polling (no public webhook, no open ports). Every update is checked against the user-ID allowlist; strangers are silently ignored and logged.

## 4. Connect Facebook

1. Create an app at developers.facebook.com, add the **Pages API**.
2. In [Graph API Explorer](https://developers.facebook.com/tools/explorer):
   - select your app, request `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`,
   - generate a user token, then exchange for a **long-lived** token,
   - call `GET /me/accounts` to obtain each Page's **id** and long-lived **Page access token**.
3. In Telegram: `/facebook add <pageId> <pageToken>` — the token is verified against the Graph API and stored AES-256-GCM encrypted. Repeat for multiple Pages; `/facebook default <pageId>` picks the publish target (no default = publish to all active pages).

## 5. Connect Pinterest

1. Create an app at developers.pinterest.com with `boards:read`, `pins:read`, `pins:write` scopes and complete the OAuth flow to obtain an access token.
2. In Telegram:
   - `/pinterest token <accessToken>` (verified + stored encrypted)
   - `/pinterest boards` (syncs your boards)
   - `/pinterest default <boardId>`

## 6. Connect Reddit (optional — drafts only)

1. reddit.com/prefs/apps → create **script** app → note client id + secret.
2. Obtain a refresh token with the `submit read` scopes (any standard OAuth helper works).
3. Fill `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_REFRESH_TOKEN`, `REDDIT_USER_AGENT` in `.env` and `docker compose up -d`.

Reddit posts are **never automatic**: each Telegram post produces one draft, the bot shows the target subreddit's rules, and nothing is submitted until you tap **Approve** — one submission per approval.

## 7. Day-2 operations

| Task | Command |
|---|---|
| Live logs | `docker compose logs -f app` |
| Restart | `docker compose restart app` |
| Update to latest code | `./update.sh` (backs up first) |
| Backup (DB + media + .env) | `./backup.sh` → `backups/<timestamp>/` |
| Restore | `./restore.sh backups/<timestamp>` |
| Nightly backups | `crontab -e` → `0 3 * * * cd /home/autopost/autopost && ./backup.sh >> backups/cron.log 2>&1` |

Copy `backups/` off-site regularly (contains secrets — restrict access).

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Bot silent | `docker compose logs app` — check `TELEGRAM_BOT_TOKEN`, allowlist IDs |
| `Invalid environment configuration` on start | the app prints exactly which `.env` variable is wrong |
| Facebook `code 190` | Page token expired — regenerate long-lived token, `/facebook add` again |
| Pinterest 401 | token expired — `/pinterest token <new>` |
| Publishes stuck in FAILED | `/logs` for the reason, `/retry` to re-queue |
| Disk filling up | old media in `storage/media/<postId>` can be pruned after publishing |
