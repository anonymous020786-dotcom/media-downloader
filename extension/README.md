# MediaDL browser extension

One extension for **Chrome, Edge, Brave, Opera, Vivaldi** and **Firefox** that sends
anything you're looking at to your own MediaDL server, then drops the finished file
into your **Downloads/MediaDL** folder.

## Get it

Every green build on `master` is published to the
[**extension-latest** release](https://github.com/anonymous020786-dotcom/media-downloader/releases/tag/extension-latest):

| File | Browsers |
|---|---|
| `mediadl-chromium-<version>.zip` | Chrome, Edge, Brave, Opera, Vivaldi, Arc |
| `mediadl-firefox-<version>.zip`  | Firefox 128+ (desktop) |

Or build it yourself: `node extension/build.mjs` → `extension/dist/`.

## Install

**Chrome / Edge / Brave / Opera / Vivaldi**
1. Unzip `mediadl-chromium-….zip` into a folder you'll keep.
2. Open `chrome://extensions` (Edge: `edge://extensions`, Opera: `opera://extensions`).
3. Turn on **Developer mode**, click **Load unpacked**, pick the unzipped folder.
4. Pin the MediaDL icon. To update later, unzip the new version over the same folder and click ↻.

**Firefox**
- Quick try: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick the
  zip. (Temporary add-ons are removed when Firefox restarts.)
- Permanent: Firefox only installs signed add-ons. Upload the zip once at
  [addons.mozilla.org/developers](https://addons.mozilla.org/developers/) as **"On your own"**
  (unlisted) — it's signed automatically in minutes and you get an `.xpi` to install.

**Safari** needs Apple's converter on a Mac (`xcrun safari-web-extension-converter extension/dist/chromium`)
and an Xcode build; it isn't produced automatically.

After installing, the settings page opens: press **Connect & test**. The extension talks to
MediaDL on this computer (`npm run dev` in the repo, default `http://localhost:4000`).

## What it does

| | |
|---|---|
| **This page** | Looks up the current page: title, thumbnail, length, available qualities with sizes. Choose **Video** (MP4/WebM/MKV, 144p → 4K) or **Audio only** (MP3/M4A/Opus/FLAC/WAV/OGG). Playlists/channels: how many items and where to start. More options: subtitles, embedded thumbnail & tags, SponsorBlock, trim start/end. |
| **Found** | Every video, audio, file link and magnet on the page, each with **MediaDL** (via your server) or **Save** (straight from the site). Optional: catch HLS/DASH streams from network traffic. |
| **Downloads** | Live progress, speed, time left, cancel, retry, save again. Badge on the icon = downloads running. |
| **Cookies** | For sites that need your login (age-restricted YouTube, Instagram, X…): send this browser's cookies for one site to your MediaDL server, to the Telegram bot, or save a `cookies.txt`. Nothing is read until you allow that site. |
| **Right-click** | On any link, video, image, page or selected URL: *Download with MediaDL* / *Download audio only*. |
| **Shortcuts** | `Alt+Shift+D` download page · `Alt+Shift+A` download audio · `Alt+Shift+M` open MediaDL. |
| **Full app** (⤢ in the popup, or right-click the icon → *Open MediaDL app*) | Everything MediaDL can do, in a tab: **Download** with every option · **Playlist picker** (tick the videos you want) · **Image gallery** (pick images from a page) · **Batch** (paste up to 200 links, or grab all open tabs) · **Search** (videos, web, files, images, torrents, news) · **RSS / Atom / M3U feeds** · **Queue** of everything on the server (also bot / website jobs): files, play, ZIP, merge video + audio, retry, stop all · **Schedules** (recurring downloads) · **Proxies / VPN** (add, test, default) · **Cookies** (per-site logins) · **Status** (services, engine versions). |
| **Every download option** | Subtitles + language, clip start/end, embed thumbnail/tags, thumbnail file, filename template, SponsorBlock, split by chapters, normalize loudness, proxy, speed limit, parallel fragments, screen-capture fallback, priority, **start later**, **repeat hourly/daily/weekly**, completion webhook. Remembered as defaults — except clip, start-later and repeat, which are always per download. |
| **Save directly** | Streams a video straight from the site into your Downloads with no copy kept on the server (popup ▶, right-click, or app). |
| **Auto-save & notifications** | Finished files are saved to Downloads/MediaDL and you get a notification (both can be turned off). |

## Permissions, and why

| Permission | Used for |
|---|---|
| `localhost`, `127.0.0.1` | Talking to your MediaDL server. Another address is asked for when you set it. |
| `activeTab`, `scripting` | Reading the media on the page you're on, only when you open the popup. |
| `contextMenus`, `notifications`, `alarms` | Right-click menu, notifications, checking progress in the background. |
| `downloads` | Saving finished files / `cookies.txt`. |
| `cookies` + per-site prompt | Cookie sharing — only for a site you allow, when you click. |
| `webRequest` + optional *all sites* | Stream detection — off until you turn it on in Settings. |
| `storage`, `clipboardWrite` | Settings and the download list; copying cookies for the Telegram bot. |

## Develop

`src/` is plain JavaScript — no bundler. `node extension/build.mjs` syntax-checks every script,
verifies every file the manifest and pages reference, then writes per-browser folders and zips
(`EXT_VERSION=2.0.5` overrides the version). CI also runs Mozilla's `web-ext lint` on the
Firefox build, runs `test/e2e.py` — the built extension in real Chromium against a running MediaDL,
with offline fixtures from `test/fixtures.py` — and publishes the zips to the release above on every
merge to `master`.
