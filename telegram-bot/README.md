# MediaDL Telegram bot

A chat front-end for the local MediaDL stack. It talks to the Express backend
(`localhost:4000`) over the same REST routes the web UI uses — analyze, download,
merge, batch, search, queue, proxy and cookie management — and streams finished
files straight into the chat.

```
Telegram  ⇄  telegram-bot  ⇄  backend :4000  ⇄  python-service :8000
```

## Setup

1. Talk to [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token.
2. In the **repo-root `.env`**:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-...
   TELEGRAM_ALLOWED_USERS=
   ```
3. Install + run (from the repo root):
   ```
   npm run install:all          # or: npm --prefix telegram-bot install
   npm run dev                  # start python + backend + web
   npm run dev:bot              # start the bot (separate terminal)
   # or run everything together:
   npm run dev:all
   ```
4. Message your bot once. It replies with your numeric Telegram id — put that in
   `TELEGRAM_ALLOWED_USERS` (comma-separated for more than one) and restart the bot.

Production: `npm run start` for the stack, `npm run start:bot` for the bot.

## Access control

Nobody can use the bot until their id is in `TELEGRAM_ALLOWED_USERS`
(`TELEGRAM_ALLOW_ALL=true` disables the check — only do that on a machine that is
not exposed). The backend itself has no auth in the local build, so the bot's
allow-list is the only gate.

## File delivery

**A single video / audio / image / file is delivered as a "direct download"
link.** Tapping it makes the server resolve the real media URL and pipe it
straight from the source to your device — with an on-the-fly ffmpeg remux for
HLS/DASH. Nothing is queued, nothing is written to the server. Playlists,
galleries and torrents still run as a job (they need a working directory) and
follow the rules below.

`TELEGRAM_DELIVERY` picks how those *job* files reach the chat:

| value | behaviour |
|---|---|
| `auto` (default) | upload to Telegram; fall back to a link if the upload stalls past `TELEGRAM_UPLOAD_TIMEOUT_SEC` (45 s) |
| `link` | never upload — always send a direct download link |
| `upload` | always upload, never fall back |

**If videos download but never appear in the chat, your ISP is throttling
uploads to `api.telegram.org`** (extremely common — the connection can be
2 KB/s outbound while downloads run fine). Set `TELEGRAM_DELIVERY=link`.

Link URLs use `BOT_PUBLIC_BASE_URL` if set; otherwise the bot auto-detects this
machine's LAN IP so the link opens on a phone on the **same Wi-Fi**. For access
from anywhere, point `BOT_PUBLIC_BASE_URL` at a tunnel (`cloudflared tunnel
--url http://localhost:4000`).

The stock Bot API also caps every upload at 50 MB (`TELEGRAM_MAX_UPLOAD_MB`,
default 49) — bigger files always go out as links. A local
[`telegram-bot-api`](https://github.com/tdlib/telegram-bot-api) server via
`TELEGRAM_API_ROOT` raises that to ~2 GB (but doesn't help a throttled uplink).

## Panel

`/menu` opens an inline control panel — Download · Search · Queue · Settings ·
Proxy · Cookies · Status — with back/close navigation. Everything is also
reachable by command.

## Commands

| | |
|---|---|
| send a link | analyze it → download card (quality / audio / clip / options) |
| `/best`, `/audio`, `/mp3 <url>` | quick grabs |
| `/info`, `/thumb <url>` | metadata / poster only |
| `/subs <url> [langs]` | subtitles only |
| `/gif <url> <start> [end]` | make a GIF |
| `/capture <url> [secs]` | screen-record MSE/blob streams |
| `/batch` | queue many links (one per line) |
| `/playlist <url> [n]` | playlist / channel / profile |
| `/feed <rss\|m3u>` | choose items from a feed |
| `/later <mins> <url>` | delayed download |
| `/schedule <hourly\|daily\|weekly> <url>`, `/schedules` | recurring |
| `/search`, `/searchvideo`, `/searchimage`, `/searchfile <ext> <q>`, `/torrents`, `/news` | search |
| `/jobs`, `/cancel [id]`, `/retry <id>`, `/files <id>` | queue control |
| `/merge <id> <video> <audio>` | merge separate audio + video |
| `/settings` | quality, format, subtitles, SponsorBlock, proxy, speed limit… |
| `/proxy`, `/cookies` | proxy/VPN pool and per-site login cookies |
| `/status`, `/sites`, `/engines`, `/whoami` | system info |

Per-user settings persist to `telegram-bot/data/state.json`. The job queue and
saved proxies/cookies live in the backend's memory and reset with it; downloaded
files are wiped from the server shortly after delivery. Images arrive as albums;
oversized files come back as links. In groups the bot only acts on commands or
when @mentioned / replied to.
