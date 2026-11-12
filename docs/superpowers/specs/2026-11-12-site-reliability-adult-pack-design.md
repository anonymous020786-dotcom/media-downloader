# Site reliability + adult site pack — design

Date: 2026-11-12 · Branch: `feat/site-pack`

## Goal

Make every category of site (general, social, adult, music, photos, free OTT,
live cams) actually download through the MediaDL bot, and add the
toppornsites.com top-82 list with real download support.

A probe of ~40 real URLs (2026-11-12) showed the gap is *reach and error
handling*, not extractor count:

- Adult tubes and TikTok time out / fail DNS from India (ISP + national blocks).
- Vimeo / Rumble return 403 to our IP.
- `/analyze` swallows the yt-dlp exception, so failures come back as an empty
  `page` with no reason; a transient network error on a Shorts URL is reported
  as "login required" **and cached for an hour**.
- Audio-only sources (SoundCloud, Bandcamp, Mixcloud, JioSaavn) come back as
  `video` with zero options.

## Non-goals

- DRM (Widevine / PlayReady / FairPlay) — detected and reported, never bypassed.
- Sites yt-dlp lists as piracy (`Piracy` extractor, e.g. sxyprn) — not worked around.
- Private / paid live-cam shows. Only free public shows are recordable.

## 1. Egress routing (`python-service/egress.py`)

Routes: `direct` (default) · `warp` (Cloudflare WARP local proxy,
`EGRESS_WARP_PROXY`, default `socks5://127.0.0.1:40000`) · user proxy
(explicit request field — always wins).

- **Static list**: known-blocked domains (adult tubes, cam sites, TikTok) go via WARP.
- **Pinned direct**: Indian OTT / music (sonyliv, jiosaavn, zee5, jiocinema,
  hotstar, mxplayer) never go via WARP — they geo-lock to India.
- **Learned**: a direct attempt that fails with a *network-class* error
  (connect timeout, DNS failure, connection reset, 403 from anti-bot) and then
  succeeds via WARP adds the registrable domain to the learned list for 24 h.
- `EGRESS_MODE=auto|off|all` (default `auto`; `off` when WARP isn't reachable —
  checked once at startup and every 5 min).
- Applied in: `_ytdlp_info`, `_ytdlp_dl`, `_render_media`, and `_client()`
  (httpx `mounts` per routed domain, so every custom handler is covered
  without edits). Editable at runtime: `GET/POST /egress`.
- Deploy: `install.sh` installs `cloudflare-warp`, registers, sets
  `mode proxy`, `proxy port 40000`, connects. Idempotent.

## 2. Error classification (`python-service/errors.py`)

`classify(exc_text) -> reason` ∈ `network | blocked | login | geo | drm |
removed | extractor_broken | unsupported | piracy | unknown`, with a
user-facing `hint`. `/analyze` attaches `{"error": {reason, hint, engine}}`
to any degraded result. **Cache only results with real media**
(qualities, format options, audio formats, images, entries or a resolved
direct URL). `login-required` labelling is used only when the classifier says
`login`.

## 3. Audio-only sources

When yt-dlp returns formats with audio but no video track: keep
`type: "video"` (wire-compatible with backend/frontend/bot/extension) and add
`audio_only: true` and `audio_options: [{abr, ext, acodec, format_id}]`.
The bot renders audio buttons for these instead of empty video qualities.

## 4. Adult site pack (`python-service/sites/`)

Covers toppornsites.com #1–82.

| Group | How | Sites |
|---|---|---|
| yt-dlp native (17) | egress only | xvideos, pornhub, xhamster, xnxx, youporn, eporner, redtube, spankbang, tnaflix, beeg, tube8, 4tube, youjizz, stripchat, chaturbate, camsoda, flirt4free |
| KVS platform | `sites/kvs.py` — one generic extractor for Kernel Video Sharing (`flashvars` → `video_url`/`video_alt_url*`, `license_code` de-obfuscation, `function/0/` prefix) + domain table + fingerprint auto-detect | pornhat, porn300, pornone, sexvid, fuq, ok.xxx, xgroovy, zbporn, theyarehuge, perfectgirls, rat.xxx, 3movs, xbabe, maturetube, vipwank, qorno, melonstube, megatube, bigporn, hqporn, bustybus, pornid, shameless, hotporntubes, zzztube, handjobhub, xcafe, jennymovies, colliderporn, grannytube, … |
| Generic HTML5 / JSON-LD player | `sites/html5.py` — `<video><source>`, JSON-LD `VideoObject.contentUrl`, `og:video`, inline `.mp4/.m3u8` with quality labels | porn.com, superporn, letsporn, cumlouder, porndoe, pussyspace, xxxbunker, tubev, … (anything KVS doesn't claim) |
| Aggregators / search | `sites/aggregators.py` — follow out-link / redirect to the source tube, re-analyze; listing pages → `type: "playlist"` of resolvable entries | ixxx, tubegalore, tiava, alohatube, dinotube, lobstertube, badjojo, pornmd, pornplanner, mypornbible, iporntv, mopoga |
| Live cams | `sites/cams.py` — public-show HLS discovery (yt-dlp where native, else headless capture of `.m3u8`) → `is_live: true`; recording via yt-dlp with `RECORD_MAX_MINUTES` cap | imlive, jerkroulette, camhours, rabbitscams, jerkmate, ichatonline, camsfinder, xtease, royalcamslive, sweepsex, dirtyroulette, jasmin/awejmp, amateur.tv |

Dispatch: `sites.match(url)` runs before yt-dlp in `_do_analyze` only for
domains in the pack *that yt-dlp doesn't cover*; download goes through the
existing `direct`/`stream` paths using the resolved media URL + Referer.

Unknown sites: after yt-dlp fails, KVS fingerprint → HTML5 extractor → existing
headless render fallback.

## 5. Bot (telegram-bot)

- **Adult toggle** per user (`adult: false` default for new users, `true` for
  `TELEGRAM_ADMIN_IDS`). Off → links to adult-pack domains get a short
  "adult content is off — /settings" reply; adult search results filtered.
- **Clear failures**: render `error.hint` + a one-tap action (open cookie
  manager for `login`, retry for `network`).
- **Audio-only**: show audio buttons when `audio_only`.
- **Auto-detect paste**: any message with a URL already analyzes; add category
  badge (🎬 video · 🎵 audio · 🖼 photos · 🔴 live · 📁 file · 🔞 adult) to the
  analysis card. Live → "Record 5 / 15 / 30 min" buttons.

## 6. Verification

- `python-service/tests/` (pytest): classifier on recorded error strings;
  egress routing decisions + learning/expiry; KVS license-code decoding and
  flashvars parsing on fixture HTML; HTML5 extractor on fixture HTML;
  aggregator link resolution on fixtures.
- `scripts/site-probe.py`: curated stable URL per site/category, run against a
  live service; prints a pass/weak/fail table. Live site verification of the
  pack requires WARP (sites are blocked on the dev network).
