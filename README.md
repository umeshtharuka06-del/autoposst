# AutoPost — Telegram AI Social Media Automation

Self-hosted, Telegram-controlled automation: send a photo/video/album with a caption to your bot and it will

1. save the media locally and the metadata to PostgreSQL,
2. generate platform-specific content with OpenAI (Facebook caption, Pinterest SEO title/description/keywords/alt text, hashtags, CTA) in **English, Sinhala and Tamil** (natural rewrites, not literal translations),
3. auto-publish to **Facebook Pages** and **Pinterest boards**,
4. create a **Reddit draft for human review** (Reddit is never auto-posted),
5. retry failures with exponential backoff and log everything.

No website. No dashboard. Everything happens in Telegram.

## Stack

Node.js 22 · TypeScript (strict) · grammY · PostgreSQL + Prisma · BullMQ + Redis · OpenAI Responses API · Docker Compose

## Quick start (Ubuntu VPS)

```bash
git clone <your-repo> autopost && cd autopost
chmod +x install.sh update.sh backup.sh restore.sh
./install.sh
```

The installer creates `.env` with generated database/Redis passwords and encryption key, then asks you to fill in:

| Variable | Where to get it |
|---|---|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) → `/newbot` |
| `TELEGRAM_ALLOWED_USER_IDS` | your numeric ID from [@userinfobot](https://t.me/userinfobot); first ID = owner |
| `OPENAI_API_KEY` | platform.openai.com |
| `REDDIT_*` (optional) | reddit.com/prefs/apps → script app + refresh token |

Facebook and Pinterest credentials are added later **inside Telegram** (`/facebook add`, `/pinterest token`) and stored AES-256-GCM encrypted.

Full guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Telegram commands

| Command | Purpose |
|---|---|
| `/start` `/help` | intro / all commands |
| `/status` | queues, post pipeline, platform health |
| `/post` | latest post + action buttons |
| `/publish [postId]` | publish a ready post now |
| `/schedule +2h [postId]` | schedule (also `YYYY-MM-DD HH:mm`) |
| `/retry [postId]` | re-queue failed publishes |
| `/cancel [postId]` | cancel pending/scheduled post |
| `/language` | default publish language (EN/SI/TA) |
| `/facebook` | manage Pages: `add <id> <token>`, `default`, `remove` |
| `/pinterest` | `token <t>`, `boards` (sync), `default`, `remove` |
| `/reddit` | review drafts: list, `show <id>`, `sub <id> <subreddit>` |
| `/settings` | tone picker, `autopublish on\|off`, stored settings |
| `/logs` | recent job logs + dead-letter failures |

## Pipeline

```
Telegram media  →  media queue (download, thumbnail, compress)
                →  ai queue (OpenAI: 3 platforms × 3 languages, structured JSON)
                →  Reddit draft → human approval via inline buttons
                →  publish queue → Facebook + Pinterest (retry ×5, exp. backoff)
                →  dead-letter queue + failed_jobs on final failure
```

## Reddit policy

This project deliberately does **not** mass-post to Reddit. For each post it generates one subreddit-aware draft, fetches the subreddit's rules for the reviewer, and posts **only after a human taps Approve** — one submission per approval.

## Operations

```bash
docker compose logs -f app   # live logs
./update.sh                  # pull, rebuild, migrate, restart
./backup.sh                  # pg_dump + media archive into backups/
./restore.sh backups/<stamp> # full restore
```
