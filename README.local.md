# MediaDL — local build

Runs entirely on your machine: **no Docker, no Redis, no MySQL, no Kafka, no
Supabase, no login.** Three processes talk to each other over `localhost`:

| Process        | Port | What it is                          |
|----------------|------|-------------------------------------|
| python-service | 8000 | yt-dlp / gallery-dl / ffmpeg downloader (FastAPI) |
| backend        | 4000 | Express API + Socket.io + job queue  |
| frontend       | 3000 | Next.js UI                           |

Job queue, download progress, saved proxies and saved cookies live **in memory**
and reset when you stop the backend. Nothing is stored: the download engines
assemble a job in a temp staging area (`<OS-temp>/mediadl/<job-id>/`, override
with `DOWNLOAD_DIR`), it's streamed to you, then the directory is deleted — see
"Where do downloads go?".

## Prerequisites

- **Node.js 20+**
- **Python 3.12 or 3.13** installed and on `PATH` as `python`
  (`winget install Python.Python.3.13` on Windows). Setup builds an isolated
  `.venv` from it — your global Python is untouched.
- **ffmpeg** — needed for video/audio merging, HLS and conversion.
  - Windows: `winget install Gyan.FFmpeg` (setup auto-finds a winget install even
    before you reopen the terminal)
  - macOS: `brew install ffmpeg` · Debian/Ubuntu: `apt install ffmpeg`
- **aria2c** — strongly recommended. 16-connection parallel downloads, ~5–15×
  faster on progressive/direct files and beats per-stream throttling; also
  required for torrent/magnet links. Without it downloads fall back to a single
  connection.
  - Windows: `winget install aria2.aria2` (the python service auto-finds the
    winget install even before you reopen the terminal)
  - macOS: `brew install aria2` · Debian/Ubuntu: `apt install aria2`
  - Or set `ARIA2C_PATH=/full/path/to/aria2c` in the repo-root `.env`.

## Setup

```bash
npm run install:all
```

Installs the root tooling + `backend/` + `frontend/`, then `npm run setup:py`:
creates `./.venv`, installs every Python engine (yt-dlp, gallery-dl, streamlink,
you-get, ddgs, curl_cffi, lxml, Playwright) and downloads the Playwright Chromium
build. Re-run `npm run setup:py` alone to rebuild the venv.

## Run

```bash
npm run dev
```

Starts all three processes (frontend + backend hot-reload). Open
**http://localhost:3000**.

Individually: `npm run dev:py`, `npm run dev:api`, `npm run dev:web`.
Production build: `npm run build && npm start`.

## Where do downloads go?

**Nothing is kept on the server.** Two paths:

- **Direct** (the ⚡ button, and the default in the Telegram bot) — the backend
  resolves the real media URL and **pipes it straight from the source to your
  device**, with an on-the-fly ffmpeg remux for HLS/DASH. No job, no queue, no
  disk. Not available for playlists / galleries / torrents.
- **Queue** (the Download button) — the download engines (yt-dlp / ffmpeg /
  aria2c) **must** have a scratch directory to assemble fragments and mux
  separate video+audio tracks — by default `<OS-temp>/mediadl/<job-id>/`, so it
  never touches the project folder. Override with `DOWNLOAD_DIR` (a tmpfs RAM
  disk on a server = zero disk writes).

The finished file is streamed to **your browser** — **Download** → your download
folder, **Save as…** → a folder picker (Chrome/Edge) — and then the whole job
directory is removed `DOWNLOAD_GRACE_SECONDS` (default 300) after the last byte
is sent. Video seeking or grabbing more files pushes that back; **Download ZIP**
(grab-all) purges immediately. Set `DOWNLOAD_GRACE_SECONDS=0` to delete the
moment the first download finishes.

## Configuration

Defaults live in the repo-root `.env` and `frontend/.env.local` — nothing to fill
in. Optional keys:

- `PROXY_POOL` — preset proxies: `"Germany|http://de.example:8080;US|socks5://us.example:1080"`
- `MAX_CONCURRENT_DOWNLOADS`, `WORKER_CONCURRENCY`, `DOWNLOAD_GRACE_SECONDS`, `DOWNLOAD_DIR`
- `ARIA2C_PATH`, `FFMPEG_PATH` — override binary locations (both auto-detected)
- `PUBLIC_BASE_URL` — base for links/stream URLs handed to a client (defaults to
  the request host; set it to a reachable address for the Telegram bot)
- `NEXT_PUBLIC_GA_ID` (`frontend/.env.local`) — Google Analytics 4 ID, e.g.
  `G-XXXXXXXXXX`. Blank = no analytics script is loaded at all.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (`frontend/.env.local`) + `TURNSTILE_SECRET_KEY`
  (root `.env`) — Cloudflare Turnstile human-verification on the download API.
  Set **both** to enable; blank = the download endpoints accept requests with no
  CAPTCHA (the default for local use). Keys:
  <https://dash.cloudflare.com/?to=/:account/turnstile>

## What was removed

Auth / accounts / admin dashboard / blog / pricing / contact-form storage / push
notifications / S3 upload / download history / Movies & TV (TMDB) / News feed /
AdSense / Tawk.to chat / reCAPTCHA / country switcher / video player (`/player`) /
social people search (`/people`) / server-side storage manager (`/api/storage*`,
disk-usage checks, automatic TTL cleanup) / the standalone Format Converter
(`/tools/convert`, `/api/download/convert`).

(Google Analytics and Cloudflare Turnstile were removed as always-on, then
re-added as **opt-in** integrations — see Configuration above.)

Kept: the download tools, playlists, profiles, batch, merge, web search,
screen-capture, language switcher, and the proxy & cookie helpers. Picking an
output format still happens at download time. The live download queue
(`/api/jobs`) shows what is running / recently finished this session.

The old Docker / K8s / nginx / VPS deploy files are kept under `legacy/`.
