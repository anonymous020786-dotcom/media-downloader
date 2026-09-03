# MediaDL — local build

Runs entirely on your machine: **no Docker, no Redis, no MySQL, no Kafka, no
Supabase, no login.** Three processes talk to each other over `localhost`:

| Process        | Port | What it is                          |
|----------------|------|-------------------------------------|
| python-service | 8000 | yt-dlp / gallery-dl / ffmpeg downloader (FastAPI) |
| backend        | 4000 | Express API + Socket.io + job queue  |
| frontend       | 3000 | Next.js UI                           |

Job queue, download progress, saved proxies and saved cookies live **in memory**
and reset when you stop the backend. Downloaded files land in `./downloads/<job-id>/`
temporarily and are wiped after ~30 min (see "Where do downloads go?").

## Prerequisites

- **Node.js 20+**
- **Python 3.12 or 3.13** installed and on `PATH` as `python`
  (`winget install Python.Python.3.13` on Windows). Setup builds an isolated
  `.venv` from it — your global Python is untouched.
- **ffmpeg** — needed for video/audio merging, HLS and conversion.
  - Windows: `winget install Gyan.FFmpeg` (setup auto-finds a winget install even
    before you reopen the terminal)
  - macOS: `brew install ffmpeg` · Debian/Ubuntu: `apt install ffmpeg`

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

The server fetches the media, then **your browser** downloads it —
**Download** → your browser's download folder, **Save as…** → a folder picker
(Chrome/Edge). Nothing is kept on the server: a finished job's files are wiped
`DOWNLOAD_TTL_MINUTES` (default 30) after it completes, and "Download ZIP"
(grab-all) wipes them immediately.

## Configuration

Defaults live in the repo-root `.env` and `frontend/.env.local` — nothing to fill
in. Optional keys:

- `PROXY_POOL` — preset proxies: `"Germany|http://de.example:8080;US|socks5://us.example:1080"`
- `MAX_CONCURRENT_DOWNLOADS`, `WORKER_CONCURRENCY`, `DOWNLOAD_TTL_MINUTES`

## What was removed

Auth / accounts / admin dashboard / blog / pricing / contact-form storage / push
notifications / S3 upload / download history / Movies & TV (TMDB) / News feed /
Google Analytics / AdSense / Tawk.to chat / reCAPTCHA / country switcher.

Kept: the download tools, playlists, profiles, batch, convert, merge, web
search, social people search, player, screen-capture, language switcher, and the
proxy & cookie helpers. The live download queue (`/api/jobs`) shows what is
running / recently finished this session.

The old Docker / K8s / nginx / VPS deploy files are kept under `legacy/`.
