"""
MediaDL Python Service v3.0
─────────────────────────────────────────────────────────────────────────────
Capabilities
  • Single video / image / page  (yt-dlp + ffmpeg + httpx)
  • Playlist / Channel           (YouTube, SoundCloud, Spotify …)
  • Profile / Gallery            (Instagram, TikTok, X/Twitter, Reddit …)
  • HLS / DASH / AES-128 encrypted streams  (ffmpeg direct)
  • Unlimited items with --ignoreerrors
  • Anti-blocking: UA rotation, random delays, cookie injection, proxy
  • Audio extraction: MP3 / M4A / Opus / OGG
  • Subtitles: download + embed
  • Thumbnail embed
  • Metadata embed
  • Storage management
  • Concurrent fragment downloads (16×)
─────────────────────────────────────────────────────────────────────────────
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
import yt_dlp
import httpx
from PIL import Image
from bs4 import BeautifulSoup
import redis.asyncio as aioredis
import redis as _sync_redis_lib
import asyncio
import aiofiles
import os, json, io, re, random, tempfile, shutil
from pathlib import Path
from typing import Optional, Literal
from urllib.parse import urlparse, urljoin

# ── Config ────────────────────────────────────────────────────────────────────
DOWNLOAD_DIR    = Path(os.getenv("DOWNLOAD_DIR",    "/downloads"))
REDIS_URL        = os.getenv("REDIS_URL",            "redis://redis:6379")
MAX_CONCURRENT   = int(os.getenv("MAX_CONCURRENT_DOWNLOADS", "5"))
MAX_PAGE_IMAGES  = int(os.getenv("MAX_PAGE_IMAGES",  "2000"))
VERIFY_SSL       = os.getenv("VERIFY_SSL", "true").lower() not in ("false", "0", "no")

# ── Globals ───────────────────────────────────────────────────────────────────
_sem:          asyncio.Semaphore
_aredis:       aioredis.Redis
_sredis:       _sync_redis_lib.Redis

_UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
]
_BASE_HDR = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
}
def _ua() -> str: return random.choice(_UA_POOL)

# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _sem, _aredis, _sredis
    _sem    = asyncio.Semaphore(MAX_CONCURRENT)
    _aredis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    _sredis = _sync_redis_lib.Redis.from_url(REDIS_URL, decode_responses=True)
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield
    await _aredis.aclose()
    _sredis.close()

app = FastAPI(lifespan=lifespan, title="MediaDL", version="3.0.0")
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
_cors_origins = ["*"] if _raw_origins == "*" else [o.strip() for o in _raw_origins.split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_cors_origins, allow_methods=["POST", "GET"], allow_headers=["*"])

# ── Models ────────────────────────────────────────────────────────────────────
class AnalyzeReq(BaseModel):
    url: str
    @field_validator("url")
    @classmethod
    def _http(cls, v):
        v = v.strip()
        if not v.startswith(("http://","https://","magnet:")):
            raise ValueError("URL must start with http://, https:// or magnet:")
        return v

class DownloadReq(BaseModel):
    url:             str
    job_id:          str
    media_type:      Literal["video","image","page","playlist","profile","file","torrent"]
    format:          str            = "mp4"
    quality:         Optional[str]  = "best"
    # Playlist / profile options
    max_items:       Optional[int]  = None   # None = unlimited
    start_index:     int            = 1
    # Output options
    subtitles:       bool           = False
    subtitle_langs:  Optional[list] = None   # e.g. ["en", "es"] — defaults to ["en","en-US"]
    embed_thumbnail: bool           = False
    embed_metadata:  bool           = True
    # Anti-blocking
    cookies:         Optional[str]  = None   # Netscape cookie text
    proxy:           Optional[str]  = None   # http://... or socks5://...
    # Screen-capture (record playback) — for blob:/MSE streams with no downloadable URL
    capture:         bool           = False
    capture_seconds: Optional[int]  = None   # cap recording length (default: video duration)
    # Clip extraction — download a time range only
    start_time:          Optional[str]  = None   # HH:MM:SS or MM:SS
    end_time:            Optional[str]  = None   # HH:MM:SS or MM:SS
    # Post-processing
    sponsor_block:        bool           = False  # remove YouTube sponsor/intro/outro segments
    split_chapters:       bool           = False  # split into per-chapter files
    normalize_audio:      bool           = False  # FFmpeg loudnorm equalisation
    write_thumbnail:      bool           = False  # save thumbnail as separate file
    output_template:      Optional[str]  = None   # custom yt-dlp outtmpl
    # Network
    speed_limit:          Optional[str]  = None   # e.g. "5M" = 5 MB/s
    concurrent_fragments: int            = 16     # parallel HLS/DASH fragments

# ── Progress helpers ──────────────────────────────────────────────────────────
async def _prog(jid: str, d: dict): await _aredis.set(f"job:{jid}:progress", json.dumps(d), ex=86400)
def _prog_s(jid: str, d: dict):    _sredis.set(f"job:{jid}:progress", json.dumps(d), ex=86400)

# ── Headless-browser rendering (for JS-heavy sites / any website) ──────────────
_render_sem = asyncio.Semaphore(2)   # chromium is heavy — cap concurrent renders

_JS_EXTRACT = """
() => {
  const abs = (u) => { try { return new URL(u, location.href).href } catch { return null } };
  const images = new Set(), videos = new Set();
  // <img> + lazy attrs + srcset
  document.querySelectorAll('img').forEach(img => {
    ['src','currentSrc','data-src','data-original','data-lazy-src','data-hi-res','data-full-url'].forEach(a => {
      const v = img[a] || img.getAttribute(a); if (v) { const u = abs(v); if (u) images.add(u); }
    });
    const ss = img.getAttribute('srcset'); if (ss) ss.split(',').forEach(p => { const u = abs(p.trim().split(' ')[0]); if (u) images.add(u); });
  });
  // <picture><source srcset>
  document.querySelectorAll('source[srcset]').forEach(s => {
    s.getAttribute('srcset').split(',').forEach(p => { const u = abs(p.trim().split(' ')[0]); if (u) { (s.type && s.type.startsWith('image') ? images : images).add(u); } });
  });
  // CSS background-image
  document.querySelectorAll('*').forEach(el => {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg.includes('url(')) { const m = bg.match(/url\\(["']?([^"')]+)["']?\\)/); if (m) { const u = abs(m[1]); if (u && u.startsWith('http')) images.add(u); } }
  });
  // <video> + <source>
  document.querySelectorAll('video').forEach(v => {
    if (v.src) { const u = abs(v.src); if (u) videos.add(u); }
    if (v.currentSrc) { const u = abs(v.currentSrc); if (u) videos.add(u); }
    v.querySelectorAll('source').forEach(s => { if (s.src) { const u = abs(s.src); if (u) videos.add(u); } });
  });
  // og / twitter meta
  document.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"]').forEach(m => { const u = abs(m.content); if (u) images.add(u); });
  document.querySelectorAll('meta[property="og:video"],meta[property="og:video:url"],meta[property="og:video:secure_url"]').forEach(m => { const u = abs(m.content); if (u) videos.add(u); });
  // anchors to media files
  document.querySelectorAll('a[href]').forEach(a => {
    const h = a.href || '';
    if (/\\.(jpe?g|png|gif|webp|avif|bmp|svg|tiff?)(\\?|$)/i.test(h)) images.add(h);
    if (/\\.(mp4|webm|mkv|mov|m3u8|mpd)(\\?|$)/i.test(h)) videos.add(h);
  });
  return { images: [...images].filter(u => u && u.startsWith('http')), videos: [...videos].filter(u => u && u.startsWith('http')) };
}
"""

# Streaming hosts / patterns that signal a real (often hidden) media URL
_VIDEO_HINTS = ("m3u8", "mpd", "/hls/", "/dash/", "videoplayback", "googlevideo",
                "/manifest", "mime=video", "/segment", ".ts?", "master.json",
                "cdn", "media", "stream")
_MEDIA_EXT = (".mp4", ".webm", ".mkv", ".mov", ".m3u8", ".mpd", ".ts", ".m4s", ".flv")

# Captured request headers for found media (so downloads can replay referer/cookies)
_LAST_MEDIA_HEADERS: dict[str, dict] = {}

async def _render_media(url: str, proxy: Optional[str] = None,
                        scroll: bool = True, timeout_ms: int = 45000,
                        want_video: bool = False):
    """Render a page in headless Chromium and extract image + video URLs.
       Sniffs ALL network traffic (XHR/fetch/media) — catches hidden HLS/DASH/mp4
       URLs that only appear in the network tab. Returns (images, videos)."""
    from playwright.async_api import async_playwright
    images: set[str] = set()
    videos: set[str] = set()

    def _classify(u: str, ct: str = "", headers: Optional[dict] = None):
        if not u or not u.startswith("http"): return
        base = u.split("?")[0].lower()
        low = u.lower()
        if "image/" in ct or base.endswith((".jpg",".jpeg",".png",".gif",".webp",".avif",".bmp",".svg",".tiff")):
            images.add(u)
        elif ("video/" in ct or "audio/" in ct or "mpegurl" in ct or "dash+xml" in ct or "octet-stream" in ct
              or base.endswith(_MEDIA_EXT) or any(h in low for h in _VIDEO_HINTS)):
            # Avoid obvious non-media even if 'cdn'/'media' substring matched
            if base.endswith((".js",".css",".json",".woff",".woff2",".svg",".png",".jpg",".jpeg",".gif",".webp",".ico")):
                if base.endswith((".m3u8",".mpd")): pass
                else: return
            videos.add(u)
            if headers:
                _LAST_MEDIA_HEADERS[u] = headers

    async with _render_sem:
        try:
            async with async_playwright() as p:
                launch_args = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
                               "--autoplay-policy=no-user-gesture-required"]
                browser = await p.chromium.launch(headless=True, args=launch_args,
                                                   proxy={"server": proxy} if proxy else None)
                ctx = await browser.new_context(
                    user_agent=_ua(), viewport={"width": 1920, "height": 1080},
                    ignore_https_errors=True,
                )
                page = await ctx.new_page()

                def _on_request(req):
                    try:
                        _classify(req.url, "", dict(req.headers or {}))
                    except Exception: pass

                def _on_response(resp):
                    try:
                        _classify(resp.url, (resp.headers or {}).get("content-type", ""),
                                  dict(resp.request.headers or {}))
                    except Exception: pass

                page.on("request", _on_request)
                page.on("response", _on_response)

                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                except Exception:
                    pass
                try:
                    await page.wait_for_load_state("networkidle", timeout=12000)
                except Exception:
                    pass

                # Try to trigger lazy/click-to-play video players (the real URL
                # often only loads after pressing play)
                if want_video:
                    for sel in ("video", "button[aria-label*='lay' i]", ".vjs-big-play-button",
                                ".play-button", "[class*='play']", ".ytp-large-play-button"):
                        try:
                            el = await page.query_selector(sel)
                            if el:
                                await el.click(timeout=2500, force=True)
                                await page.wait_for_timeout(1500)
                        except Exception:
                            pass
                    # Also try to .play() any video element directly
                    try:
                        await page.evaluate("document.querySelectorAll('video').forEach(v=>{try{v.muted=true;v.play()}catch(e){}})")
                        await page.wait_for_timeout(2500)
                    except Exception:
                        pass

                if scroll:
                    # Infinite-scroll + "load more" handling for SPA/social feeds
                    last_h = 0
                    for i in range(25):
                        try:
                            await page.mouse.wheel(0, 30000)
                            await page.wait_for_timeout(600)
                            if i % 4 == 0:
                                # Click common "load more / show more" buttons
                                await page.evaluate("""() => {
                                  const rx = /load more|show more|view more|see more|more photos|next/i;
                                  document.querySelectorAll('button,a,div[role=button],span[role=button]').forEach(b => {
                                    if (rx.test((b.textContent||'').trim())) { try { b.click() } catch(e){} }
                                  });
                                }""")
                            h = await page.evaluate("() => document.body.scrollHeight")
                            if h == last_h and i > 4:
                                break   # page stopped growing
                            last_h = h
                        except Exception:
                            break

                try:
                    dom = await page.evaluate(_JS_EXTRACT)
                    images |= set(dom.get("images", []))
                    videos |= set(dom.get("videos", []))
                except Exception:
                    pass

                # Give late XHR/media requests a moment, then snapshot
                try:
                    await page.wait_for_timeout(1500)
                except Exception:
                    pass

                await browser.close()
        except Exception:
            pass

    # Drop blob: URLs (not downloadable) from videos
    videos = {v for v in videos if not v.startswith("blob:")}
    return list(images), list(videos)


def _rank_video(urls: list[str]) -> list[str]:
    """Prefer HLS/DASH manifests, then mp4/webm, then ts."""
    def score(u: str) -> int:
        b = u.split("?")[0].lower()
        if b.endswith(".m3u8"): return 0
        if b.endswith(".mpd"):  return 1
        if b.endswith(".mp4"):  return 2
        if b.endswith(".webm"): return 3
        if b.endswith((".mkv",".mov")): return 4
        if b.endswith(".ts"):   return 6
        return 5
    return sorted(urls, key=score)

# ─────────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health(): return {"status":"ok","version":"3.0.0","max_concurrent":MAX_CONCURRENT}

@app.get("/health/deep")
async def health_deep():
    """Deep health — pings dependencies and checks the extractor engines."""
    checks: dict = {}
    # Redis
    try:
        await _aredis.ping(); checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"down: {str(e)[:80]}"
    # Engines present
    ev = _engine_versions()
    checks["engines"] = {k: ("ok" if v else "missing") for k, v in ev.items()}
    # Downloads dir writable
    try:
        t = DOWNLOAD_DIR / ".healthcheck"
        t.write_text("ok"); t.unlink()
        checks["downloads_dir"] = "ok"
    except Exception as e:
        checks["downloads_dir"] = f"not writable: {str(e)[:60]}"
    ok = checks.get("redis") == "ok" and checks.get("downloads_dir") == "ok"
    return {"status": "ok" if ok else "degraded", "checks": checks, "versions": ev}


# ── Extraction engine status & one-click self-update ──────────────────────────
import sys as _sys, subprocess as _sp
_ENGINE_PKGS = ["yt-dlp", "gallery-dl", "streamlink", "you-get", "ddgs"]

def _engine_versions() -> dict:
    import importlib.metadata as _md
    out: dict = {}
    for pkg in _ENGINE_PKGS:
        try: out[pkg] = _md.version(pkg)
        except Exception: out[pkg] = None
    try:
        r = _sp.run(["ffmpeg","-version"], capture_output=True, text=True, timeout=10)
        out["ffmpeg"] = r.stdout.split("\n")[0].split(" ")[2] if r.returncode == 0 else None
    except Exception:
        out["ffmpeg"] = None
    return out

@app.get("/engines")
async def engines():
    return {"engines": _engine_versions()}


_SITES_CACHE: dict = {}

def _supported_sites() -> dict:
    """Count the REAL supported-site registries across engines. yt-dlp + gallery-dl
       name thousands of sites explicitly; the headless-render + generic HEAD-probe
       fallback then covers everything else — so practical coverage is unbounded."""
    if _SITES_CACHE:
        return _SITES_CACHE
    yt = gd = 0
    try:
        from yt_dlp.extractor import gen_extractor_classes
        yt = sum(1 for e in gen_extractor_classes()
                 if e.IE_NAME and "generic" not in e.IE_NAME.lower())
    except Exception:
        pass
    try:
        import gallery_dl.extractor as _gde
        gd = len({getattr(e, "category", "") for e in _gde.extractors() if getattr(e, "category", "")})
    except Exception:
        pass
    named = yt + gd
    out = {
        "named_extractors": named,
        "by_engine": {"yt-dlp": yt, "gallery-dl": gd},
        "generic_fallback": True,
        "note": "Named site extractors across yt-dlp + gallery-dl. Any other site is "
                "handled by the headless-render + direct HEAD-probe fallback — coverage "
                "is effectively unlimited for any URL serving media or files.",
    }
    _SITES_CACHE.update(out)
    return out

@app.get("/engines/sites")
async def engines_sites():
    return await asyncio.get_event_loop().run_in_executor(None, _supported_sites)

@app.post("/engines/update")
async def engines_update():
    """pip install -U the extractor engines. Subprocess engines (gallery-dl/you-get/
       streamlink) take effect immediately; yt-dlp (imported in-process) applies after
       the next container restart."""
    before = _engine_versions()
    def _upd():
        try:
            _sp.run([_sys.executable, "-m", "pip", "install", "-U", "--no-cache-dir", *_ENGINE_PKGS],
                    capture_output=True, text=True, timeout=600)
        except Exception:
            pass
    await asyncio.get_event_loop().run_in_executor(None, _upd)
    after = _engine_versions()
    changed = [p for p in _ENGINE_PKGS if before.get(p) != after.get(p)]
    return {"before": before, "after": after, "changed": changed,
            "note": "yt-dlp changes apply after the python-service restarts; other engines are live now."}


import hashlib as _hashlib
ANALYZE_CACHE_TTL = int(os.getenv("ANALYZE_CACHE_TTL", "3600"))

def _cache_key(prefix: str, url: str) -> str:
    return f"cache:{prefix}:{_hashlib.sha1(url.encode()).hexdigest()}"

async def _cache_get(key: str):
    try:
        v = await _aredis.get(key)
        return json.loads(v) if v else None
    except Exception:
        return None

async def _cache_set(key: str, value: dict, ttl: int = ANALYZE_CACHE_TTL):
    try:
        await _aredis.set(key, json.dumps(value), ex=ttl)
    except Exception:
        pass


@app.post("/analyze")
async def analyze(req: AnalyzeReq):
    url = req.url
    # Fast path: cached analysis (skip slow yt-dlp/render for repeat URLs)
    ck = _cache_key("analyze", url)
    cached = await _cache_get(ck)
    if cached:
        cached["_cached"] = True
        return cached
    result = await _do_analyze(url)
    # Cache everything except the cheap 'page' fallback (we want fresh image scrapes)
    if result.get("type") != "page":
        await _cache_set(ck, result)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# CUSTOM SITE EXTRACTORS  (sites yt-dlp doesn't support)
# ─────────────────────────────────────────────────────────────────────────────

_PAT_COM_RE = re.compile(r'^https?://(?:www\.)?pat\.com/-?(\d+(?:\d+)*)$')

# Pixeldrain  https://pixeldrain.com/u/{id}  or  /l/{id}  (list)
_PIXELDRAIN_RE = re.compile(
    r'^https?://(?:www\.)?pixeldrain\.com/(?:u|l)/([A-Za-z0-9_-]+)', re.I)

# Streamtape  https://streamtape.com/v/{id}
_STREAMTAPE_RE = re.compile(
    r'^https?://(?:www\.)?streamtape\.(?:com|to|cc|net|xyz|site)/(?:v|e)/([A-Za-z0-9_-]+)', re.I)

# Bunkr  https://bunkr.sk/v/{slug}  or  /i/{slug}  or  /a/{slug}  (album)
_BUNKR_RE = re.compile(
    r'^https?://bunkr\.(?:sk|si|ph|cr|fi|su|is|to|la|ru|black)/([aiv])/([A-Za-z0-9_.-]+)', re.I)

# Erome  https://www.erome.com/a/{id}
_EROME_RE = re.compile(
    r'^https?://(?:www\.)?erome\.com/a/([A-Za-z0-9_-]+)', re.I)

# Doodstream  https://dood.wf/d/{id}  (many mirror domains)
_DOODSTREAM_RE = re.compile(
    r'^https?://(?:www\.)?(?:dood|ds2play)\.'
    r'(?:wf|cx|sh|pm|yt|so|to|la|li|ru|re|stream|cloud|watch|tube|live|rest|pro|xxx|red|boo|fun|id|link|run|one|pw|biz|monster|watch|video|site|click|surf)/(?:d|e|f|v|[A-Za-z0-9]+)/([A-Za-z0-9_-]+)', re.I)

# Cyberdrop  https://cyberdrop.me/a/{id}
_CYBERDROP_RE = re.compile(
    r'^https?://(?:www\.)?cyberdrop\.(?:me|cc|to|nl|org)/(?:a|f)/([A-Za-z0-9_-]+)', re.I)

# Mixdrop  https://mixdrop.sb/f/{id}
_MIXDROP_RE = re.compile(
    r'^https?://(?:www\.)?mixdrop\.(?:sb|co|bz|to|club|vc|ag|ch|gl|ps|sx|ac|pk|ws)/(?:f|e)/([A-Za-z0-9_-]+)', re.I)


def _is_custom_site(url: str) -> bool:
    return bool(
        _PAT_COM_RE.match(url) or _PIXELDRAIN_RE.match(url) or _STREAMTAPE_RE.match(url) or
        _BUNKR_RE.match(url) or _EROME_RE.match(url) or _DOODSTREAM_RE.match(url) or
        _CYBERDROP_RE.match(url) or _MIXDROP_RE.match(url)
    )


# ── Pixeldrain ────────────────────────────────────────────────────────────────

async def _analyze_pixeldrain(url: str) -> dict:
    m = _PIXELDRAIN_RE.match(url)
    if not m:
        raise ValueError("Invalid pixeldrain URL")
    fid = m.group(1)
    is_list = "/l/" in url.lower()

    try:
        async with httpx.AsyncClient(follow_redirects=True,
                                     timeout=httpx.Timeout(10, connect=8),
                                     verify=VERIFY_SSL) as c:
            if is_list:
                r = await c.get(f"https://pixeldrain.com/api/list/{fid}",
                    headers={"User-Agent": _ua()})
                if r.status_code == 200:
                    data = r.json()
                    files = data.get("files", [])
                    return {
                        "type": "playlist",
                        "title": data.get("title", f"Pixeldrain list {fid}"),
                        "extractor": "pixeldrain",
                        "playlist_count": len(files),
                        "_pd_list_id": fid,
                    }
            r = await c.get(f"https://pixeldrain.com/api/file/{fid}/info",
                headers={"User-Agent": _ua(), "Accept": "application/json"})
            if r.status_code == 200:
                d = r.json()
                ct = d.get("mime_type", "")
                is_video = ct.startswith("video/") or ct.startswith("audio/")
                return {
                    "type": "video" if is_video else "file",
                    "title": d.get("name", fid),
                    "thumbnail": None, "duration": None,
                    "uploader": d.get("user_name", ""),
                    "extractor": "pixeldrain",
                    "qualities": [], "video_formats": ["original"],
                    "size": d.get("size"), "content_type": ct,
                    "_pd_file_id": fid,
                }
    except Exception:
        pass
    return {"type": "file", "title": f"Pixeldrain {fid}", "extractor": "pixeldrain",
            "_pd_file_id": fid, "video_formats": ["original"]}


async def _dl_pixeldrain(req: DownloadReq, job_dir: Path):
    m = _PIXELDRAIN_RE.match(req.url)
    if not m:
        raise HTTPException(400, "Invalid pixeldrain URL")
    fid = m.group(1)
    is_list = "/l/" in req.url.lower()

    await _prog(req.job_id, {"status": "downloading", "progress": 2})

    if is_list:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15, verify=VERIFY_SSL) as c:
            r = await c.get(f"https://pixeldrain.com/api/list/{fid}",
                headers={"User-Agent": _ua()})
        files = r.json().get("files", []) if r.status_code == 200 else []
        total = len(files)
        for i, f in enumerate(files, 1):
            sub_url = f"https://pixeldrain.com/api/file/{f['id']}?download"
            out = _uniq(job_dir, _safe(f.get("name", f["id"])))
            hdrs = {"User-Agent": _ua(), "Accept": "*/*",
                    "Referer": "https://pixeldrain.com/"}
            ok = await _aria2_dl(sub_url, out, req.job_id, "https://pixeldrain.com/", req.proxy)
            if not ok:
                async with httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(None, connect=20),
                                             verify=VERIFY_SSL, headers=hdrs) as c:
                    async with c.stream("GET", sub_url) as resp:
                        if resp.status_code in (200, 206):
                            async with aiofiles.open(out, "wb") as fo:
                                async for chunk in resp.aiter_bytes(1 << 20):
                                    await fo.write(chunk)
            _prog_s(req.job_id, {"status": "downloading", "progress": min(95, int(i / total * 95))})
    else:
        dl_url = f"https://pixeldrain.com/api/file/{fid}?download"
        out = _uniq(job_dir, f"{fid}.bin")
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=15, verify=VERIFY_SSL) as c:
                r = await c.get(f"https://pixeldrain.com/api/file/{fid}/info",
                    headers={"User-Agent": _ua()})
            if r.status_code == 200:
                name = r.json().get("name", fid)
                out = _uniq(job_dir, _safe(name))
        except Exception:
            pass

        ok = await _aria2_dl(dl_url, out, req.job_id, "https://pixeldrain.com/", req.proxy)
        if not ok:
            async with httpx.AsyncClient(follow_redirects=True, http2=True,
                                         timeout=httpx.Timeout(None, connect=20),
                                         verify=VERIFY_SSL, proxy=req.proxy or None,
                                         headers={"User-Agent": _ua()}) as c:
                async with c.stream("GET", dl_url) as resp:
                    resp.raise_for_status()
                    total_b = int(resp.headers.get("content-length", 0)) or 0
                    done = 0
                    async with aiofiles.open(out, "wb") as fo:
                        async for chunk in resp.aiter_bytes(1 << 20):
                            await fo.write(chunk)
                            done += len(chunk)
                            if total_b:
                                _prog_s(req.job_id, {"status": "downloading",
                                    "progress": min(95, int(done / total_b * 95)),
                                    "downloaded": done, "total": total_b})

    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    await _prog(req.job_id, {"status": "completed", "progress": 100, "files": files})


# ── Streamtape ────────────────────────────────────────────────────────────────

async def _analyze_streamtape(url: str) -> dict:
    m = _STREAMTAPE_RE.match(url)
    vid = m.group(1) if m else "unknown"
    return {
        "type": "video", "title": f"Streamtape video {vid}",
        "thumbnail": None, "duration": None, "uploader": "",
        "extractor": "streamtape", "qualities": [], "video_formats": ["mp4"],
        "_st_id": vid,
    }


async def _resolve_streamtape(url: str) -> Optional[str]:
    """Extract the real MP4 URL from a streamtape page."""
    m = _STREAMTAPE_RE.match(url)
    if not m:
        return None
    vid = m.group(1)
    # Try all known domains
    for domain in ["streamtape.com", "streamtape.to", "streamtape.cc", "streamta.pe"]:
        try:
            page_url = f"https://{domain}/v/{vid}"
            async with httpx.AsyncClient(follow_redirects=True, timeout=20, verify=VERIFY_SSL) as c:
                r = await c.get(page_url, headers={
                    "User-Agent": _ua(),
                    "Referer": f"https://{domain}/",
                })
            if r.status_code != 200:
                continue
            html = r.text
            # Pattern 1: two concatenated substrings that form the URL
            # innerHTML = ("//streamtape.com/get_video?...").substring(0) + ("xxxx...").substring(N)
            m2 = re.search(
                r'innerHTML\s*=\s*["\`]([^"\`]{20,300})["\`]\s*\+\s*["\`]([^"\`]{5,100})["\`]\.substring\((\d+)\)',
                html)
            if m2:
                part1, part2, n = m2.group(1), m2.group(2), int(m2.group(3))
                raw = part1 + part2[n:]
                if raw.startswith("//"):
                    raw = "https:" + raw
                return raw.split("&stream")[0] if "&stream=" in raw else raw

            # Pattern 2: robotlink element contains get_video URL directly
            m3 = re.search(r'id=["\']robotlink["\'][^>]*>([^<]{20,400})<', html)
            if m3:
                raw = m3.group(1).strip()
                if raw.startswith("//"):
                    raw = "https:" + raw
                return raw

            # Pattern 3: document.getElementById('robotlink') assignment
            m4 = re.search(
                r'getElementById\(["\']robotlink["\']\)\.innerHTML\s*=\s*["\`]([^"\`]{20,300})["\`]',
                html)
            if m4:
                raw = m4.group(1)
                if raw.startswith("//"):
                    raw = "https:" + raw
                return raw

            # Pattern 4: get_video URL embedded in a variable
            m5 = re.search(
                r'(?:var\s+\w+|=)\s*["\`]((?:https?:)?//[^"\'`\s]{20,300}get_video[^"\'`\s]{10,200})["\`]',
                html)
            if m5:
                raw = m5.group(1)
                if raw.startswith("//"):
                    raw = "https:" + raw
                return raw

        except Exception:
            continue
    return None


async def _dl_streamtape(req: DownloadReq, job_dir: Path):
    await _prog(req.job_id, {"status": "starting", "progress": 5, "info": "Resolving streamtape URL…"})
    video_url = await _resolve_streamtape(req.url)
    if not video_url:
        raise HTTPException(502, "Could not extract streamtape video URL — the video may have expired or been removed")
    await _prog(req.job_id, {"status": "downloading", "progress": 10})
    m = _STREAMTAPE_RE.match(req.url)
    vid = m.group(1) if m else "video"
    out = _uniq(job_dir, f"streamtape_{vid}.mp4")
    headers = {"User-Agent": _ua(), "Referer": req.url, "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8"}
    ok = await _aria2_dl(video_url, out, req.job_id, req.url, req.proxy)
    if not ok:
        async with httpx.AsyncClient(follow_redirects=True, http2=True,
                                     timeout=httpx.Timeout(None, connect=20),
                                     verify=VERIFY_SSL, proxy=req.proxy or None,
                                     headers=headers) as c:
            async with c.stream("GET", video_url) as resp:
                if resp.status_code == 403:
                    raise HTTPException(403, "Streamtape returned 403 — link may have expired")
                resp.raise_for_status()
                total_b = int(resp.headers.get("content-length", 0)) or 0
                done = 0
                async with aiofiles.open(out, "wb") as fo:
                    async for chunk in resp.aiter_bytes(1 << 20):
                        await fo.write(chunk)
                        done += len(chunk)
                        if total_b:
                            _prog_s(req.job_id, {"status": "downloading",
                                "progress": min(95, int(done / total_b * 95)),
                                "downloaded": done, "total": total_b})
    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    await _prog(req.job_id, {"status": "completed", "progress": 100, "files": files})


# ── Bunkr ─────────────────────────────────────────────────────────────────────

async def _analyze_bunkr(url: str) -> dict:
    m = _BUNKR_RE.match(url)
    if not m:
        raise ValueError("Invalid bunkr URL")
    kind, slug = m.group(1).lower(), m.group(2)
    is_album = kind == "a"
    return {
        "type": "playlist" if is_album else "video",
        "title": f"Bunkr {'album' if is_album else 'file'} {slug}",
        "thumbnail": None, "duration": None, "uploader": "",
        "extractor": "bunkr",
        "qualities": [], "video_formats": ["original"],
        "_bunkr_kind": kind, "_bunkr_slug": slug,
    }


_BUNKR_DOMAINS = ["bunkr.sk", "bunkr.si", "bunkr.ph", "bunkr.cr", "bunkr.fi"]


async def _bunkr_cdn_url(domain: str, kind: str, slug: str) -> Optional[str]:
    """Fetch a bunkr file/video/image page and return the CDN download URL."""
    page_url = f"https://{domain}/{kind}/{slug}"
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20, verify=VERIFY_SSL) as c:
            r = await c.get(page_url, headers={"User-Agent": _ua(), "Referer": f"https://{domain}/"})
        if r.status_code != 200:
            return None
        html = r.text
        # og:video (highest priority)
        m = re.search(r'<meta[^>]+(?:og:video)[^>]+content=["\']([^"\']{10,300})["\']', html, re.I)
        if m:
            return m.group(1)
        # <source src="...">
        m = re.search(r'<source[^>]+src=["\']([^"\']{10,300})["\']', html, re.I)
        if m:
            return m.group(1)
        # direct CDN links (cdn.bunkr.*, i-*.bunkr.*)
        m = re.search(r'https?://(?:cdn|i-[a-z]+)\.bunkr\.[a-z]+/[^"\'<>\s]{5,200}', html, re.I)
        if m:
            return m.group(0)
        # download button href
        m = re.search(r'href=["\']([^"\']{10,300}(?:cdn|download|bunkr)[^"\']{0,100})["\']', html, re.I)
        if m and m.group(1).startswith("http"):
            return m.group(1)
    except Exception:
        pass
    return None


async def _dl_bunkr(req: DownloadReq, job_dir: Path):
    m = _BUNKR_RE.match(req.url)
    if not m:
        raise HTTPException(400, "Invalid bunkr URL")
    kind, slug = m.group(1).lower(), m.group(2)
    # Determine domain from original URL
    dm = re.search(r'bunkr\.([a-z]+)/', req.url)
    domain = f"bunkr.{dm.group(1)}" if dm else "bunkr.sk"

    await _prog(req.job_id, {"status": "starting", "progress": 5})

    if kind == "a":
        # Album: scrape all file links from the album page
        async with httpx.AsyncClient(follow_redirects=True, timeout=20, verify=VERIFY_SSL) as c:
            r = await c.get(f"https://{domain}/a/{slug}",
                headers={"User-Agent": _ua(), "Referer": f"https://{domain}/"})
        html = r.text
        # Find all file links in the album
        file_links = re.findall(
            r'href=["\']https?://bunkr\.[a-z]+/([vi])/([A-Za-z0-9_.-]+)["\']', html, re.I)
        file_links = list(dict.fromkeys(file_links))  # dedupe
        if not file_links:
            raise HTTPException(404, "No files found in bunkr album")
        total = len(file_links)
        for i, (fkind, fslug) in enumerate(file_links, 1):
            cdn_url = await _bunkr_cdn_url(domain, fkind, fslug)
            if cdn_url:
                fname = cdn_url.split("/")[-1].split("?")[0] or f"bunkr_{fslug}"
                out = _uniq(job_dir, _safe(fname))
                ok = await _aria2_dl(cdn_url, out, req.job_id, f"https://{domain}/", req.proxy)
                if not ok:
                    async with httpx.AsyncClient(follow_redirects=True,
                                                 timeout=httpx.Timeout(None, connect=20),
                                                 verify=VERIFY_SSL, proxy=req.proxy or None,
                                                 headers={"User-Agent": _ua(), "Referer": f"https://{domain}/"}) as c:
                        async with c.stream("GET", cdn_url) as resp:
                            if resp.status_code in (200, 206):
                                async with aiofiles.open(out, "wb") as fo:
                                    async for chunk in resp.aiter_bytes(1 << 20):
                                        await fo.write(chunk)
            _prog_s(req.job_id, {"status": "downloading", "progress": min(95, int(i / total * 95))})
    else:
        # Single file/video
        cdn_url = await _bunkr_cdn_url(domain, kind, slug)
        if not cdn_url:
            raise HTTPException(404, f"Could not resolve bunkr CDN URL for {slug}")
        fname = cdn_url.split("/")[-1].split("?")[0] or f"bunkr_{slug}"
        out = _uniq(job_dir, _safe(fname))
        ok = await _aria2_dl(cdn_url, out, req.job_id, f"https://{domain}/", req.proxy)
        if not ok:
            async with httpx.AsyncClient(follow_redirects=True,
                                         http2=True, timeout=httpx.Timeout(None, connect=20),
                                         verify=VERIFY_SSL, proxy=req.proxy or None,
                                         headers={"User-Agent": _ua(), "Referer": f"https://{domain}/"}) as c:
                async with c.stream("GET", cdn_url) as resp:
                    resp.raise_for_status()
                    total_b = int(resp.headers.get("content-length", 0)) or 0
                    done = 0
                    async with aiofiles.open(out, "wb") as fo:
                        async for chunk in resp.aiter_bytes(1 << 20):
                            await fo.write(chunk)
                            done += len(chunk)
                            if total_b:
                                _prog_s(req.job_id, {"status": "downloading",
                                    "progress": min(95, int(done / total_b * 95)),
                                    "downloaded": done, "total": total_b})

    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    await _prog(req.job_id, {"status": "completed", "progress": 100, "files": files})


# ── Erome ─────────────────────────────────────────────────────────────────────

async def _analyze_erome(url: str) -> dict:
    m = _EROME_RE.match(url)
    album_id = m.group(1) if m else "unknown"
    return {
        "type": "playlist",
        "title": f"Erome album {album_id}",
        "thumbnail": None, "duration": None, "uploader": "",
        "extractor": "erome",
        "qualities": [], "video_formats": ["original"],
        "_erome_album": album_id,
    }


async def _dl_erome(req: DownloadReq, job_dir: Path):
    m = _EROME_RE.match(req.url)
    if not m:
        raise HTTPException(400, "Invalid erome URL")
    album_id = m.group(1)
    await _prog(req.job_id, {"status": "starting", "progress": 5})

    for domain in ["www.erome.com", "erome.com"]:
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=20, verify=VERIFY_SSL) as c:
                r = await c.get(f"https://{domain}/a/{album_id}", headers={
                    "User-Agent": _ua(),
                    "Referer": f"https://{domain}/",
                    "Accept": "text/html",
                })
            if r.status_code != 200:
                continue
            html = r.text
            # Video sources
            videos = list(dict.fromkeys(re.findall(
                r'<source[^>]+src=["\']([^"\']{10,400})["\']', html, re.I)))
            # Images (data-src for lazy-loaded, src for immediate)
            images = list(dict.fromkeys(re.findall(
                r'<img[^>]+(?:data-src|src)=["\']([^"\']{10,400}(?:jpg|jpeg|png|gif|webp)[^"\']{0,50})["\']',
                html, re.I)))
            items = [(u, "video") for u in videos] + [(u, "image") for u in images
                     if not any(s in u.lower() for s in ("icon","avatar","logo","thumb","profile"))]
            if not items:
                continue
            total = len(items)
            for i, (media_url, mtype) in enumerate(items, 1):
                if not media_url.startswith("http"):
                    continue
                fname = media_url.split("/")[-1].split("?")[0] or f"erome_{i}"
                out = _uniq(job_dir, _safe(fname))
                ok = await _aria2_dl(media_url, out, req.job_id, f"https://{domain}/", req.proxy)
                if not ok:
                    async with httpx.AsyncClient(follow_redirects=True,
                                                 timeout=httpx.Timeout(None, connect=20),
                                                 verify=VERIFY_SSL, proxy=req.proxy or None,
                                                 headers={"User-Agent": _ua(),
                                                          "Referer": f"https://{domain}/"}) as c:
                        async with c.stream("GET", media_url) as resp:
                            if resp.status_code in (200, 206):
                                async with aiofiles.open(out, "wb") as fo:
                                    async for chunk in resp.aiter_bytes(1 << 20):
                                        await fo.write(chunk)
                _prog_s(req.job_id, {"status": "downloading", "progress": min(95, int(i / total * 95))})
            files = [f.name for f in job_dir.iterdir() if f.is_file()]
            await _prog(req.job_id, {"status": "completed", "progress": 100, "files": files})
            return
        except Exception:
            continue
    raise HTTPException(502, "Could not reach erome.com")


# ── Doodstream ────────────────────────────────────────────────────────────────

async def _analyze_doodstream(url: str) -> dict:
    m = _DOODSTREAM_RE.match(url)
    vid = m.group(1) if m else "unknown"
    return {
        "type": "video", "title": f"Doodstream video {vid}",
        "thumbnail": None, "duration": None, "uploader": "",
        "extractor": "doodstream", "qualities": [], "video_formats": ["mp4"],
        "_dood_id": vid,
    }


async def _resolve_doodstream(url: str) -> Optional[str]:
    """Extract actual MP4 URL from doodstream page."""
    from urllib.parse import urlparse
    base = urlparse(url)
    origin = f"{base.scheme}://{base.netloc}"
    m = _DOODSTREAM_RE.match(url)
    if not m:
        return None
    vid = m.group(1)
    # Try watch page (not embed)
    for watch_url in [f"{origin}/d/{vid}", f"{origin}/f/{vid}", url]:
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=20, verify=VERIFY_SSL) as c:
                r = await c.get(watch_url, headers={"User-Agent": _ua(), "Referer": origin + "/"})
            if r.status_code != 200:
                continue
            html = r.text
            # Find the pass_md5 path
            pm = re.search(r"['\"/](\/pass_md5\/[^'\"/\s]{8,80}\/)['\"]", html)
            if not pm:
                continue
            pm_path = pm.group(1)
            # Fetch the pass_md5 URL → returns base CDN URL
            async with httpx.AsyncClient(follow_redirects=True, timeout=20, verify=VERIFY_SSL) as c:
                r2 = await c.get(f"{origin}{pm_path}", headers={
                    "User-Agent": _ua(), "Referer": watch_url,
                    "X-Requested-With": "XMLHttpRequest",
                })
            if r2.status_code != 200:
                continue
            base_url = r2.text.strip()
            if not base_url.startswith("http"):
                continue
            # Construct final URL: base_url + random(10) + ?token={hash}&expiry={ts*1000}
            import string, time
            rand = "".join(random.choices(string.ascii_letters + string.digits, k=10))
            hash_val = pm_path.split("/")[-2]
            expiry = str(int(time.time() * 1000))
            return f"{base_url}{rand}?token={hash_val}&expiry={expiry}"
        except Exception:
            continue
    return None


async def _dl_doodstream(req: DownloadReq, job_dir: Path):
    await _prog(req.job_id, {"status": "starting", "progress": 5, "info": "Resolving doodstream URL…"})
    video_url = await _resolve_doodstream(req.url)
    if not video_url:
        raise HTTPException(502, "Could not extract doodstream video URL — try a different mirror domain or check the video still exists")
    await _prog(req.job_id, {"status": "downloading", "progress": 10})
    m = _DOODSTREAM_RE.match(req.url)
    vid = m.group(1) if m else "video"
    out = _uniq(job_dir, f"dood_{vid}.mp4")
    headers = {"User-Agent": _ua(), "Referer": req.url, "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8"}
    ok = await _aria2_dl(video_url, out, req.job_id, req.url, req.proxy)
    if not ok:
        async with httpx.AsyncClient(follow_redirects=True, http2=True,
                                     timeout=httpx.Timeout(None, connect=20),
                                     verify=VERIFY_SSL, proxy=req.proxy or None,
                                     headers=headers) as c:
            async with c.stream("GET", video_url) as resp:
                resp.raise_for_status()
                total_b = int(resp.headers.get("content-length", 0)) or 0
                done = 0
                async with aiofiles.open(out, "wb") as fo:
                    async for chunk in resp.aiter_bytes(1 << 20):
                        await fo.write(chunk)
                        done += len(chunk)
                        if total_b:
                            _prog_s(req.job_id, {"status": "downloading",
                                "progress": min(95, int(done / total_b * 95)),
                                "downloaded": done, "total": total_b})
    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    await _prog(req.job_id, {"status": "completed", "progress": 100, "files": files})


# ── Cyberdrop ─────────────────────────────────────────────────────────────────

async def _analyze_cyberdrop(url: str) -> dict:
    m = _CYBERDROP_RE.match(url)
    aid = m.group(1) if m else "unknown"
    return {
        "type": "playlist",
        "title": f"Cyberdrop album {aid}",
        "thumbnail": None, "duration": None, "uploader": "",
        "extractor": "cyberdrop",
        "qualities": [], "video_formats": ["original"],
        "_cyberdrop_id": aid,
    }


async def _dl_cyberdrop(req: DownloadReq, job_dir: Path):
    m = _CYBERDROP_RE.match(req.url)
    if not m:
        raise HTTPException(400, "Invalid cyberdrop URL")
    aid = m.group(1)
    from urllib.parse import urlparse
    base_domain = urlparse(req.url).netloc
    await _prog(req.job_id, {"status": "starting", "progress": 5})

    for domain in [base_domain, "cyberdrop.me", "cyberdrop.cc"]:
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=20, verify=VERIFY_SSL) as c:
                r = await c.get(f"https://{domain}/a/{aid}", headers={
                    "User-Agent": _ua(), "Referer": f"https://{domain}/",
                })
            if r.status_code != 200:
                continue
            html = r.text
            # Find CDN file URLs
            cdn_links = list(dict.fromkeys(re.findall(
                r'https?://(?:cdn\.|f\.)[^"\'<>\s]{5,200}', html, re.I)))
            if not cdn_links:
                # Try href-based download links
                cdn_links = list(dict.fromkeys(re.findall(
                    r'href=["\']([^"\']{10,300}(?:cdn|download)[^"\']{0,100})["\']', html, re.I)))
                cdn_links = [u for u in cdn_links if u.startswith("http")]
            if not cdn_links:
                continue
            total = len(cdn_links)
            for i, link in enumerate(cdn_links, 1):
                fname = link.split("/")[-1].split("?")[0] or f"cyberdrop_{i}"
                out = _uniq(job_dir, _safe(fname))
                ok = await _aria2_dl(link, out, req.job_id, f"https://{domain}/", req.proxy)
                if not ok:
                    async with httpx.AsyncClient(follow_redirects=True,
                                                 timeout=httpx.Timeout(None, connect=20),
                                                 verify=VERIFY_SSL, proxy=req.proxy or None,
                                                 headers={"User-Agent": _ua(),
                                                          "Referer": f"https://{domain}/"}) as c:
                        async with c.stream("GET", link) as resp:
                            if resp.status_code in (200, 206):
                                async with aiofiles.open(out, "wb") as fo:
                                    async for chunk in resp.aiter_bytes(1 << 20):
                                        await fo.write(chunk)
                _prog_s(req.job_id, {"status": "downloading", "progress": min(95, int(i / total * 95))})
            files = [f.name for f in job_dir.iterdir() if f.is_file()]
            await _prog(req.job_id, {"status": "completed", "progress": 100, "files": files})
            return
        except Exception:
            continue
    raise HTTPException(502, "Could not reach cyberdrop — check the URL or try again later")


# ── Mixdrop ───────────────────────────────────────────────────────────────────

async def _analyze_mixdrop(url: str) -> dict:
    m = _MIXDROP_RE.match(url)
    fid = m.group(1) if m else "unknown"
    return {
        "type": "video", "title": f"Mixdrop video {fid}",
        "thumbnail": None, "duration": None, "uploader": "",
        "extractor": "mixdrop", "qualities": [], "video_formats": ["mp4"],
        "_mixdrop_id": fid,
    }


async def _resolve_mixdrop(url: str) -> Optional[str]:
    """Extract actual CDN URL from a Mixdrop page (MDCore.wurl)."""
    from urllib.parse import urlparse
    base_domain = urlparse(url).netloc or "mixdrop.sb"
    m = _MIXDROP_RE.match(url)
    if not m:
        return None
    fid = m.group(1)
    for domain in [base_domain, "mixdrop.sb", "mixdrop.co", "mixdrop.bz", "mixdrop.to"]:
        for path in [f"/f/{fid}", f"/e/{fid}"]:
            try:
                async with httpx.AsyncClient(follow_redirects=True, timeout=20, verify=VERIFY_SSL) as c:
                    r = await c.get(f"https://{domain}{path}", headers={
                        "User-Agent": _ua(),
                        "Referer": f"https://{domain}/",
                    })
                if r.status_code != 200:
                    continue
                html = r.text
                # MDCore.wurl = "https://..."
                mw = re.search(r'MDCore\.wurl\s*=\s*["\`]([^"\'`\s]{10,300})["\`]', html, re.I)
                if mw:
                    raw = mw.group(1)
                    if raw.startswith("//"):
                        raw = "https:" + raw
                    return raw
                # MDCore.vurl or MDCore.src
                mv = re.search(r'MDCore\.(?:vurl|src|url)\s*=\s*["\`]([^"\'`\s]{10,300})["\`]', html, re.I)
                if mv:
                    raw = mv.group(1)
                    if raw.startswith("//"):
                        raw = "https:" + raw
                    return raw
                # <source src="https://s-XX.mixdrop...">
                ms = re.search(r'<source[^>]+src=["\']([^"\']{10,300})["\']', html, re.I)
                if ms:
                    raw = ms.group(1)
                    if raw.startswith("//"):
                        raw = "https:" + raw
                    return raw
            except Exception:
                continue
    return None


async def _dl_mixdrop(req: DownloadReq, job_dir: Path):
    await _prog(req.job_id, {"status": "starting", "progress": 5, "info": "Resolving Mixdrop URL…"})
    video_url = await _resolve_mixdrop(req.url)
    if not video_url:
        raise HTTPException(502, "Could not extract Mixdrop video URL — the video may be unavailable or the page JS has changed")
    await _prog(req.job_id, {"status": "downloading", "progress": 10})
    m = _MIXDROP_RE.match(req.url)
    fid = m.group(1) if m else "video"
    out = _uniq(job_dir, f"mixdrop_{fid}.mp4")
    headers = {"User-Agent": _ua(), "Referer": req.url, "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8"}
    ok = await _aria2_dl(video_url, out, req.job_id, req.url, req.proxy)
    if not ok:
        async with httpx.AsyncClient(follow_redirects=True, http2=True,
                                     timeout=httpx.Timeout(None, connect=20),
                                     verify=VERIFY_SSL, proxy=req.proxy or None,
                                     headers=headers) as c:
            async with c.stream("GET", video_url) as resp:
                resp.raise_for_status()
                total_b = int(resp.headers.get("content-length", 0)) or 0
                done = 0
                async with aiofiles.open(out, "wb") as fo:
                    async for chunk in resp.aiter_bytes(1 << 20):
                        await fo.write(chunk)
                        done += len(chunk)
                        if total_b:
                            _prog_s(req.job_id, {"status": "downloading",
                                "progress": min(95, int(done / total_b * 95)),
                                "downloaded": done, "total": total_b})
    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    await _prog(req.job_id, {"status": "completed", "progress": 100, "files": files})

async def _pat_login(email: str, password: str) -> Optional[str]:
    """Login to pat.com via auth.externulls.com → returns Bearer JWT or None."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20, verify=VERIFY_SSL) as c:
            r = await c.post(
                "https://auth.externulls.com/login/",
                json={"email": email, "password": password, "scope": "pat"},
                headers={
                    "User-Agent": _ua(),
                    "Origin": "https://pat.com",
                    "Referer": "https://pat.com/",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code == 200:
                return r.json().get("token")
    except Exception:
        pass
    return None


def _pat_file_id(url: str) -> Optional[str]:
    """Extract numeric slug ID from a pat.com URL.
    https://pat.com/-0252924980226239  →  '252924980226239'
    The leading digit after '-' is a type prefix, not part of the ID.
    """
    m = _PAT_COM_RE.match(url)
    if not m:
        return None
    raw = m.group(1)
    return raw[1:] if len(raw) > 1 else raw


async def _pat_get_token(req_cookies: Optional[str], job_id: str) -> Optional[str]:
    """Extract or acquire a pat.com Bearer JWT from the cookies field."""
    if not req_cookies:
        return None
    m_tok = re.search(r'pat_token=([^\s;]+)', req_cookies)
    if m_tok:
        return m_tok.group(1)
    m_em = re.search(r'pat_email=([^\s;]+)', req_cookies)
    m_pw = re.search(r'pat_password=([^\s;]+)', req_cookies)
    if m_em and m_pw:
        await _prog(job_id, {"status": "starting", "progress": 2, "info": "Logging in to pat.com…"})
        token = await _pat_login(m_em.group(1), m_pw.group(1))
        if not token:
            raise HTTPException(401, "pat.com login failed — check email/password")
        return token
    return None


_PAT_QUALITY_PREF = [
    "avc1_1080p", "avc1_720p", "avc1_480p", "avc1_360p",
    "av1_1080p",  "av1_720p",  "av1_480p",  "av1_360p",
    "hevc_1080p", "hevc_720p",
]


async def _pat_resolve_stream(file_id: str, token: Optional[str], referer: str
                              ) -> tuple[Optional[str], Optional[str]]:
    """Call video.pat.com/{file_id} with Bearer auth.
    Returns (stream_url, cdn_file_id) where stream_url is the HLS master m3u8
    or a direct CDN URL.

    The CDN URL structure (from network analysis):
      https://video.pat.com/key={k},end={exp},limit={n}/data={d}/media=hls4A/
        {quality}/{cdn_file_id}.mp4/{segment}

    With Bearer auth the API likely returns a JSON with the signed base URL
    or redirects to it.
    """
    api_url = f"https://video.pat.com/{file_id}"
    headers = {
        "User-Agent": _ua(),
        "Referer": referer,
        "Origin": "https://pat.com",
        "Accept": "application/json, video/mp4, */*",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        async with httpx.AsyncClient(
            follow_redirects=False,  # capture redirect Location manually
            timeout=httpx.Timeout(20, connect=15),
            verify=VERIFY_SSL,
        ) as c:
            r = await c.get(api_url, headers=headers)

        # Case 1: API returns a redirect → Location is the CDN base or m3u8
        if r.status_code in (301, 302, 307, 308):
            loc = r.headers.get("location", "")
            if loc:
                # If it's already an m3u8 URL, return it
                if "m3u8" in loc:
                    return loc, None
                # Otherwise it's the CDN base → probe for m3u8
                cdn_base = loc.rstrip("/")
                return await _pat_build_m3u8(cdn_base, token), None

        # Case 2: JSON response with stream info
        if r.status_code == 200:
            ct = r.headers.get("content-type", "")
            if "json" in ct:
                data = r.json()
                # Extract stream URL from common field names
                for field in ("stream_url", "hls_url", "cdn_url", "url", "src", "source"):
                    val = data.get(field) or data.get("data", {}).get(field, "")
                    if val and val.startswith("http"):
                        if "m3u8" in val:
                            return val, data.get("cdn_file_id")
                        return await _pat_build_m3u8(val.rstrip("/"), token), data.get("cdn_file_id")
                # Maybe nested under "video" or "file"
                for nested in ("video", "file", "media", "content"):
                    sub = data.get(nested, {})
                    if isinstance(sub, dict):
                        for field in ("stream_url", "hls_url", "cdn_url", "url"):
                            val = sub.get(field, "")
                            if val and val.startswith("http"):
                                if "m3u8" in val:
                                    return val, sub.get("cdn_file_id") or sub.get("id")
                                return await _pat_build_m3u8(val.rstrip("/"), token), None
            # Case 3: video/mp4 direct stream (unlikely but handle it)
            if "video/" in ct or "application/octet-stream" in ct:
                return api_url, None  # caller will download as direct stream

        # Case 4: 403 without token → not authenticated
        if r.status_code == 403 and not token:
            return None, None

    except Exception:
        pass

    return None, None


async def _pat_build_m3u8(cdn_base: str, token: Optional[str]) -> Optional[str]:
    """Given a CDN base URL, find the HLS master playlist.
    CDN structure: {cdn_base}/media=hls4A/{quality}/{cdn_file_id}.mp4/index.m3u8
    """
    headers: dict = {"User-Agent": _ua(), "Accept": "*/*", "Referer": "https://pat.com/"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    # If cdn_base already contains media=hls4A, probe directly
    if "media=hls4A" in cdn_base:
        # Try master playlist at this level
        for name in ("master.m3u8", "index.m3u8", "playlist.m3u8"):
            url = f"{cdn_base}/{name}"
            try:
                async with httpx.AsyncClient(follow_redirects=True, timeout=10, verify=VERIFY_SSL) as c:
                    r = await c.head(url, headers=headers)
                if r.status_code == 200:
                    return url
            except Exception:
                pass
        return None

    # Try appending media=hls4A and quality variants
    async with httpx.AsyncClient(follow_redirects=True, timeout=10, verify=VERIFY_SSL) as c:
        for suffix in [
            "media=hls4A/master.m3u8",
            "media=hls4A/index.m3u8",
        ]:
            url = f"{cdn_base}/{suffix}"
            try:
                r = await c.head(url, headers=headers)
                if r.status_code == 200:
                    return url
            except Exception:
                pass
    return None


async def _analyze_pat_com(url: str, token: Optional[str] = None) -> dict:
    """Analyse a pat.com video URL. Returns video metadata."""
    file_id = _pat_file_id(url)
    if not file_id:
        raise ValueError(f"Cannot parse pat.com URL: {url}")

    title = f"pat.com video {file_id}"
    try:
        async with httpx.AsyncClient(follow_redirects=True,
                                     timeout=httpx.Timeout(10, connect=8),
                                     verify=VERIFY_SSL) as c:
            rp = await c.get(url, headers={"User-Agent": _ua(), "Accept": "text/html"})
            m2 = re.search(
                r'<meta[^>]+(?:og:title|twitter:title)[^>]+content=["\']([^"\']{1,200})', rp.text, re.I)
            if m2:
                title = m2.group(1).strip()
    except Exception:
        pass

    return {
        "type": "video",
        "title": title,
        "thumbnail": None,
        "duration": None,
        "uploader": "",
        "extractor": "pat.com",
        "qualities": _PAT_QUALITY_PREF[:4],  # show available quality labels
        "video_formats": ["mp4", "mkv"],
        "_pat_file_id": file_id,
        "_pat_needs_auth": not bool(token),
        "_pat_note": "Requires pat.com login — add pat_token=<JWT> or pat_email=x pat_password=y in Cookies",
    }


async def _dl_pat_com(req: DownloadReq, job_dir: Path):
    """Download a pat.com video (HLS stream via CDN).

    Video delivery: HLS fragmented-MP4 at video.pat.com
    CDN URL structure:
      https://video.pat.com/key={k},end={expiry},limit={n}/data={hash}/
        media=hls4A/{quality}/{cdn_file_id}.mp4/{segment}

    Auth: put one of these in the Cookies field:
      pat_token=<JWT>                         — use existing Bearer token
      pat_email=x@y.com pat_password=secret   — auto-login to get token
    """
    file_id = _pat_file_id(req.url)
    if not file_id:
        raise HTTPException(400, "Invalid pat.com URL")

    token = await _pat_get_token(req.cookies, req.job_id)

    await _prog(req.job_id, {"status": "starting", "progress": 5,
                              "info": "Resolving pat.com stream URL…"})

    # Step 1: resolve the signed CDN / m3u8 URL from the API
    stream_url, cdn_file_id = await _pat_resolve_stream(file_id, token, req.url)

    if not stream_url:
        if not token:
            raise HTTPException(
                401,
                "pat.com videos require login. "
                "Add  pat_token=<JWT>  or  pat_email=x pat_password=y  "
                "in the Cookies field."
            )
        raise HTTPException(502, "Could not resolve pat.com stream URL — the video may have been removed")

    await _prog(req.job_id, {"status": "downloading", "progress": 10})

    out_name = f"pat_{cdn_file_id or file_id}.mp4"
    out = _uniq(job_dir, out_name)

    # Step 2: download — HLS via ffmpeg, direct MP4 via aria2c/httpx
    is_hls = "m3u8" in stream_url or "m3u8" in stream_url.lower()

    if is_hls:
        # ffmpeg handles HLS natively: concat all segments → single MP4
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-headers", f"Referer: https://pat.com/\r\nOrigin: https://pat.com/\r\n"
                        + (f"Authorization: Bearer {token}\r\n" if token else ""),
            "-i", stream_url,
            "-c", "copy",
            "-movflags", "+faststart",
            str(out),
        ]
        if req.proxy:
            ffmpeg_cmd = ["ffmpeg", "-y",
                          "-http_proxy", req.proxy,
                          "-headers", ffmpeg_cmd[3],
                          "-i", stream_url, "-c", "copy", "-movflags", "+faststart", str(out)]

        proc = await asyncio.create_subprocess_exec(
            *ffmpeg_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        async def _pump_ffmpeg():
            assert proc.stdout
            async for raw in proc.stdout:
                line = raw.decode("utf-8", "ignore")
                m_t = re.search(r"time=(\d+:\d+:\d+)", line)
                if m_t:
                    _prog_s(req.job_id, {"status": "downloading", "progress": 50,
                                          "info": f"ffmpeg {m_t.group(1)}"})
        try:
            await asyncio.wait_for(_pump_ffmpeg(), timeout=7200)
            await asyncio.wait_for(proc.wait(), timeout=60)
        except asyncio.TimeoutError:
            try: proc.kill()
            except Exception: pass
            raise HTTPException(504, "pat.com HLS download timed out")

        if proc.returncode != 0 or not out.exists() or out.stat().st_size < 1024:
            if out.exists(): out.unlink()
            raise HTTPException(500, "ffmpeg failed to download pat.com HLS stream")
    else:
        # Direct MP4 download
        headers = {
            "User-Agent": _ua(),
            "Referer": req.url,
            "Origin": "https://pat.com",
            "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        ok = await _aria2_dl(stream_url, out, req.job_id, req.url, req.proxy)
        if not ok:
            part = job_dir / (out.name + ".part")
            async with httpx.AsyncClient(
                follow_redirects=True, http2=True, verify=VERIFY_SSL,
                timeout=httpx.Timeout(None, connect=20),
                proxy=req.proxy or None, headers=headers,
            ) as c:
                async with c.stream("GET", stream_url) as r:
                    if r.status_code == 403:
                        raise HTTPException(401, "pat.com CDN returned 403 — token may have expired")
                    r.raise_for_status()
                    total_b = int(r.headers.get("content-length", 0)) or 0
                    done = 0
                    async with aiofiles.open(part, "wb") as f:
                        async for chunk in r.aiter_bytes(1 << 20):
                            await f.write(chunk)
                            done += len(chunk)
                            if total_b:
                                _prog_s(req.job_id, {
                                    "status": "downloading",
                                    "progress": min(95, int(done / total_b * 95)),
                                    "downloaded": done, "total": total_b,
                                })
            if not part.exists() or part.stat().st_size < 1024:
                if part.exists(): part.unlink()
                raise HTTPException(500, "pat.com download produced an empty file")
            part.rename(out)

    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    await _prog(req.job_id, {"status": "completed", "progress": 100, "files": files})


async def _do_analyze(url: str) -> dict:
    # 0a. Custom site extractors (no yt-dlp support)
    if _PAT_COM_RE.match(url):       return await _analyze_pat_com(url)
    if _PIXELDRAIN_RE.match(url):    return await _analyze_pixeldrain(url)
    if _STREAMTAPE_RE.match(url):    return await _analyze_streamtape(url)
    if _BUNKR_RE.match(url):         return await _analyze_bunkr(url)
    if _EROME_RE.match(url):         return await _analyze_erome(url)
    if _DOODSTREAM_RE.match(url):    return await _analyze_doodstream(url)
    if _CYBERDROP_RE.match(url):     return await _analyze_cyberdrop(url)
    if _MIXDROP_RE.match(url):       return await _analyze_mixdrop(url)
    # 0. Torrent / magnet
    if url.startswith("magnet:") or url.split("?")[0].lower().endswith(".torrent"):
        name = "torrent"
        if url.startswith("magnet:"):
            m = re.search(r"dn=([^&]+)", url)
            if m:
                from urllib.parse import unquote
                name = unquote(m.group(1))
        else:
            name = url.split("/")[-1].split("?")[0]
        return {"type":"torrent","url":url,"title":_safe(name),"extractor":"aria2"}
    # 1. Direct stream detection (m3u8 / mpd / ts)
    s = _detect_stream(url)
    if s: return s
    # 1b. Known non-media file extension (pdf, zip, apk, docs, exe…) → universal file
    base = url.split("?")[0].lower()
    if base.endswith(_FILE_EXT):
        name = url.split("/")[-1].split("?")[0] or "download"
        size = None; ct = "application/octet-stream"
        try:
            async with _client() as c:
                hr = await c.head(url, timeout=10)
                size = int(hr.headers.get("content-length",0)) or None
                ct = (hr.headers.get("content-type","") or ct).split(";")[0].strip()
                name = _filename_from(url, hr.headers.get("content-disposition",""))
        except Exception: pass
        return {"type":"file","url":url,"filename":_safe(name),"content_type":ct,"size":size}
    # 2. yt-dlp extractor
    try:
        info = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(None, _ytdlp_info, url, False), 35)
        if info and (info.get("formats") or info.get("url")):
            heights = sorted({f.get("height") for f in (info.get("formats") or [])
                              if f.get("height") and f.get("vcodec","none") != "none"}, reverse=True)
            return {
                "type": "video",
                "title": info.get("title") or _url_title(url),
                "thumbnail": info.get("thumbnail"),
                "duration": info.get("duration"),
                "uploader": info.get("uploader",""),
                "extractor": info.get("extractor",""),
                "qualities": heights[:10],
                "video_formats": ["mp4","webm","mkv","avi","mov","mp3","m4a","opus"],
                "is_live": bool(info.get("is_live")),
                "is_playlist": bool(info.get("_type") in ("playlist","multi_video")),
                "playlist_count": info.get("playlist_count"),
            }
    except Exception: pass
    # 3. HEAD probe
    try:
        async with _client() as c:
            r = await c.head(url, timeout=12)
            ct = (r.headers.get("content-type","") or "").split(";")[0].strip().lower()
            if "image/" in ct:
                return {"type":"image","url":url,"content_type":ct,
                        "size": int(r.headers.get("content-length",0)) or None,
                        "image_formats":["original","jpg","png","webp","avif","bmp"]}
            if any(s in ct for s in ("video/","audio/","application/x-mpegurl",
                                      "application/vnd.apple.mpegurl","application/dash+xml")):
                return {"type":"video","title":_url_title(url),"thumbnail":None,
                        "duration":None,"uploader":"","extractor":"direct",
                        "qualities":[],"video_formats":["mp4","mkv","ts"],"is_stream":True}
            # Any other direct file (pdf, zip, apk, docs, exe, csv, …) → universal file download
            cd = (r.headers.get("content-disposition","") or "").lower()
            looks_like_file = (
                ("attachment" in cd) or
                (ct and "text/html" not in ct and ct != "") or
                bool(re.search(r'\.[a-z0-9]{1,8}(\?|$)', url.split("/")[-1], re.I))
            )
            if looks_like_file and "text/html" not in ct:
                name = _filename_from(url, cd)
                return {"type":"file","url":url,"filename":name,"content_type":ct or "application/octet-stream",
                        "size": int(r.headers.get("content-length",0)) or None}
    except Exception: pass
    # 4. Headless-render probe — detect JS-loaded videos on arbitrary pages
    try:
        imgs, vids = await asyncio.wait_for(
            _render_media(url, scroll=False, timeout_ms=25000, want_video=True), timeout=45)
        if vids:
            return {"type":"video","title":_url_title(url),"thumbnail":(imgs[0] if imgs else None),
                    "duration":None,"uploader":"","extractor":"rendered",
                    "qualities":[],"video_formats":["mp4","mkv","ts","webm"],"is_stream":True,
                    "rendered_images": len(imgs)}
        # No video, but maybe images — fall through to page (preview will render fully)
    except Exception:
        pass
    # 5. HTML page fallback (image scraping; preview-page renders if needed)
    return {"type":"page","url":url,"image_formats":["original","jpg","png","webp","avif"]}


class SearchReq(BaseModel):
    query:    str
    kind:     Literal["web","file","image","video","torrent","news"] = "web"
    filetype: Optional[str] = None     # e.g. pdf, zip, mp3 (for kind=file)
    limit:    int = 30                 # results per page
    page:     int = 1                  # 1-based page index (for infinite pagination)


SEARCH_CACHE_TTL   = int(os.getenv("SEARCH_CACHE_TTL",    "1800"))  # 30 min
SEARCH_BATCH_SIZE  = int(os.getenv("SEARCH_BATCH_SIZE",   "200"))   # pre-fetch


# ── Torrent scraper: 1337x + Nyaa.si ─────────────────────────────────────────
async def _scrape_1337x(query: str, page: int) -> list[dict]:
    q = query.strip().replace(' ', '+')
    url = f"https://1337x.to/search/{q}/{page}/"
    try:
        async with httpx.AsyncClient(headers={"User-Agent": _ua(), **_BASE_HDR},
                                     timeout=18, follow_redirects=True) as c:
            r = await c.get(url)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, "html.parser")
        rows = soup.select("table.table-list tbody tr")
        out = []
        for row in rows:
            tds = row.find_all("td")
            if len(tds) < 5:
                continue
            links = tds[0].find_all("a")
            if not links:
                continue
            detail = links[-1]
            title = detail.get_text(strip=True)
            href  = detail.get("href", "")
            detail_url = f"https://1337x.to{href}" if href.startswith("/") else href
            seeds   = tds[1].get_text(strip=True)
            leeches = tds[2].get_text(strip=True)
            size    = tds[4].get_text(strip=True).split("\n")[0].strip()
            out.append({"title": title, "url": detail_url, "kind": "torrent",
                        "seeds": seeds, "leechers": leeches, "size": size, "source": "1337x"})
        return out
    except Exception:
        return []


async def _scrape_nyaa(query: str, page: int) -> list[dict]:
    q = query.strip().replace(' ', '+')
    url = f"https://nyaa.si/?f=0&c=0_0&q={q}&p={page}"
    try:
        async with httpx.AsyncClient(headers={"User-Agent": _ua(), **_BASE_HDR},
                                     timeout=18, follow_redirects=True) as c:
            r = await c.get(url)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, "html.parser")
        rows = soup.select("table.torrent-list tbody tr")
        out = []
        for row in rows:
            tds = row.find_all("td")
            if len(tds) < 7:
                continue
            a = tds[1].find("a", href=lambda h: h and "/view/" in h)
            if not a:
                continue
            title = a.get_text(strip=True)
            href  = a.get("href", "")
            detail_url = f"https://nyaa.si{href}" if href.startswith("/") else href
            magnet_a = tds[2].find("a", href=lambda h: h and h.startswith("magnet:"))
            magnet   = magnet_a.get("href", "") if magnet_a else ""
            size    = tds[3].get_text(strip=True)
            seeds   = tds[5].get_text(strip=True)
            leeches = tds[6].get_text(strip=True)
            out.append({"title": title, "url": detail_url, "kind": "torrent",
                        "magnet": magnet, "seeds": seeds, "leechers": leeches,
                        "size": size, "source": "nyaa"})
        return out
    except Exception:
        return []


async def _fetch_torrent_results(query: str, page: int) -> list[dict]:
    r1, r2 = await asyncio.gather(_scrape_1337x(query, page), _scrape_nyaa(query, page))
    combined = r1 + r2
    seen, deduped = set(), []
    for item in combined:
        u = item.get("url")
        if u and u not in seen:
            seen.add(u); deduped.append(item)
    return deduped


# ── Bing text fallback (used when DDG returns 0 results) ─────────────────────
async def _bing_fallback(query: str, kind: str, ft: str, limit: int) -> list[dict]:
    q = f"{query} filetype:{ft}" if kind == "file" and ft else query
    url = f"https://www.bing.com/search?q={q.replace(' ', '+')}&count={limit}"
    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": _ua(), "Accept-Language": "en-US,en;q=0.9"},
            timeout=18, follow_redirects=True
        ) as c:
            r = await c.get(url)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, "html.parser")
        out = []
        for li in soup.select("#b_results > li.b_algo"):
            a = li.find("a")
            if not a:
                continue
            href = a.get("href", "")
            title = a.get_text(strip=True)
            caption = li.select_one(".b_caption p") or li.find("p")
            snippet = caption.get_text(strip=True) if caption else ""
            if href and href.startswith("http"):
                out.append({"title": title, "url": href, "snippet": snippet, "kind": kind})
        return out
    except Exception:
        return []


@app.post("/search")
async def search(req: SearchReq):
    """Multi-engine search: DuckDuckGo (web/file/image/video/news), 1337x+Nyaa (torrent).
       Pre-fetches up to 200 results on first request, stores in Redis, serves pages from
       cache — giving true infinite pagination with no extra DDG calls per page."""
    q = req.query.strip()
    if not q:
        raise HTTPException(400, "Empty query")

    per_page = max(1, min(req.limit, 50))
    page     = max(1, req.page)
    ft       = (req.filetype or "").strip().lstrip(".")

    # ── Torrent: scrape per-page (results change; don't pre-batch) ────────────
    if req.kind == "torrent":
        ck = _cache_key("search", f"torrent|{page}|{q}")
        cached = await _cache_get(ck)
        if cached:
            cached["_cached"] = True
            return cached
        try:
            results = await asyncio.wait_for(_fetch_torrent_results(q, page), timeout=30)
        except asyncio.TimeoutError:
            raise HTTPException(504, "Torrent search timed out — try again")
        except Exception as e:
            raise HTTPException(502, f"Torrent search failed: {str(e)[:200]}")
        payload = {
            "query": q, "kind": "torrent", "page": page, "per_page": per_page,
            "count": len(results), "total": None, "has_more": len(results) >= 20,
            "results": results[:per_page],
        }
        if results:
            await _cache_set(ck, payload, ttl=SEARCH_CACHE_TTL)
        return payload

    # ── DDG kinds: pre-fetch 200 results once, cache, serve pages from cache ──
    all_ck = _cache_key("search_all", f"{req.kind}|{ft}|{q}")
    all_cached = await _cache_get(all_ck)

    if all_cached:
        all_results = all_cached["results"]
    else:
        def _run_ddg():
            from ddgs import DDGS
            results: list[dict] = []
            with DDGS() as ddgs:
                if req.kind == "image":
                    for r in ddgs.images(q, max_results=SEARCH_BATCH_SIZE):
                        url_v = r.get("image")
                        if url_v:
                            results.append({"title": r.get("title", ""), "url": url_v,
                                            "thumbnail": r.get("thumbnail"), "source": r.get("url"),
                                            "kind": "image"})
                elif req.kind == "video":
                    for r in ddgs.videos(q, max_results=SEARCH_BATCH_SIZE):
                        url_v = r.get("content") or r.get("url")
                        if url_v:
                            results.append({"title": r.get("title", ""), "url": url_v,
                                            "thumbnail": (r.get("images") or {}).get("medium"),
                                            "source": r.get("url"), "duration": r.get("duration"),
                                            "kind": "video"})
                elif req.kind == "news":
                    for r in ddgs.news(q, max_results=SEARCH_BATCH_SIZE):
                        url_v = r.get("url")
                        if url_v:
                            results.append({"title": r.get("title", ""), "url": url_v,
                                            "snippet": r.get("body", ""),
                                            "thumbnail": r.get("image"),
                                            "source": r.get("source", ""),
                                            "date": r.get("date", ""),
                                            "kind": "news"})
                else:
                    query_str = f"{q} filetype:{ft}" if req.kind == "file" and ft and "filetype:" not in q else q
                    for r in ddgs.text(query_str, max_results=SEARCH_BATCH_SIZE):
                        url_v = r.get("href")
                        if url_v:
                            results.append({"title": r.get("title", ""), "url": url_v,
                                            "snippet": r.get("body", ""), "kind": req.kind})
            seen, deduped = set(), []
            for r in results:
                u = r.get("url")
                if u and u not in seen:
                    seen.add(u); deduped.append(r)
            return deduped

        try:
            all_results = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, _run_ddg), timeout=45)
        except asyncio.TimeoutError:
            raise HTTPException(504, "Search timed out — try again")
        except Exception as e:
            raise HTTPException(502, f"Search failed: {str(e)[:200]}")

        # Bing fallback when DDG comes up empty for web/file searches
        if not all_results and req.kind in ("web", "file"):
            try:
                all_results = await asyncio.wait_for(
                    _bing_fallback(q, req.kind, ft, SEARCH_BATCH_SIZE), timeout=25)
            except Exception:
                pass

        if all_results:
            await _cache_set(all_ck, {"results": all_results}, ttl=SEARCH_CACHE_TTL)

    # Slice the requested page from the cached full set
    start         = (page - 1) * per_page
    end           = start + per_page
    page_results  = all_results[start:end]
    has_more      = end < len(all_results)

    payload = {
        "query": q, "kind": req.kind, "page": page, "per_page": per_page,
        "count": len(page_results), "total": len(all_results),
        "has_more": has_more,
        "results": page_results,
    }
    return payload


# ── Social people / profile discovery ─────────────────────────────────────────
# Platforms whose PUBLIC profiles can be enumerated by handle. Each entry:
#   url template, a profile-page kind (video|image|mixed), whether login is usually
#   required to actually DOWNLOAD media (we surface this honestly in the UI).
SOCIAL_PLATFORMS = [
    {"id":"instagram","name":"Instagram","url":"https://www.instagram.com/{u}/","kind":"image","login":True},
    {"id":"tiktok","name":"TikTok","url":"https://www.tiktok.com/@{u}","kind":"video","login":True},
    {"id":"x","name":"X / Twitter","url":"https://x.com/{u}","kind":"mixed","login":True},
    {"id":"youtube","name":"YouTube","url":"https://www.youtube.com/@{u}","kind":"video","login":False},
    {"id":"reddit","name":"Reddit","url":"https://www.reddit.com/user/{u}/","kind":"mixed","login":False},
    {"id":"pinterest","name":"Pinterest","url":"https://www.pinterest.com/{u}/","kind":"image","login":False},
    {"id":"tumblr","name":"Tumblr","url":"https://{u}.tumblr.com/","kind":"image","login":False},
    {"id":"twitch","name":"Twitch","url":"https://www.twitch.tv/{u}","kind":"video","login":False},
    {"id":"vimeo","name":"Vimeo","url":"https://vimeo.com/{u}","kind":"video","login":False},
    {"id":"deviantart","name":"DeviantArt","url":"https://www.deviantart.com/{u}","kind":"image","login":False},
    {"id":"pixiv","name":"Pixiv","url":"https://www.pixiv.net/en/users/{u}","kind":"image","login":True},
    {"id":"soundcloud","name":"SoundCloud","url":"https://soundcloud.com/{u}","kind":"video","login":False},
    {"id":"dailymotion","name":"Dailymotion","url":"https://www.dailymotion.com/{u}","kind":"video","login":False},
    {"id":"github","name":"GitHub","url":"https://github.com/{u}","kind":"image","login":False},
]
_HANDLE_RE = re.compile(r"^@?[A-Za-z0-9._-]{2,40}$")


class SocialSearchReq(BaseModel):
    query:     str
    platforms: Optional[list[str]] = None   # restrict to these platform ids


async def _probe_profile(c, plat: dict, handle: str) -> Optional[dict]:
    url = plat["url"].format(u=handle)
    item = {"platform": plat["id"], "platform_name": plat["name"], "username": handle,
            "url": url, "kind": plat["kind"], "login_required": plat["login"], "status": "candidate"}
    try:
        r = await c.get(url, timeout=10, follow_redirects=True)
        body = r.text[:6000].lower() if r.headers.get("content-type","").startswith("text") else ""
        missing = any(s in body for s in (
            "page not found","sorry, this page","user not found","doesn't exist",
            "couldn't find this account","page isn't available","404 not found"))
        if r.status_code == 200 and not missing:
            item["status"] = "verified"
            m = re.search(r'<meta property="og:image" content="([^"]+)"', r.text or "", re.I)
            if m: item["avatar"] = m.group(1)
            tm = re.search(r'<meta property="og:title" content="([^"]+)"', r.text or "", re.I)
            if tm: item["display_name"] = tm.group(1)[:120]
        elif r.status_code in (401, 403):
            item["status"] = "blocked"   # exists but bot-walled; still downloadable with cookies
        else:
            return None
    except Exception:
        return None
    return item


@app.post("/social/search")
async def social_search(req: SocialSearchReq):
    """Find a person's public profiles across social platforms.
       - A handle (e.g. 'nasa') → probes each platform's profile URL directly.
       - A full name (with spaces) → uses DuckDuckGo to surface matching profiles.
       Returns candidate profiles you can then preview & download (public media;
       members-only/private content needs your own session cookies)."""
    q = req.query.strip().lstrip("@")
    if not q:
        raise HTTPException(400, "Empty query")
    plats = [p for p in SOCIAL_PLATFORMS if not req.platforms or p["id"] in req.platforms]

    ck = _cache_key("social", f"{','.join(sorted(p['id'] for p in plats))}|{q.lower()}")
    cached = await _cache_get(ck)
    if cached:
        cached["_cached"] = True
        return cached

    profiles: list[dict] = []
    if _HANDLE_RE.match(q) and " " not in q:
        async with _client() as c:
            results = await asyncio.gather(*[_probe_profile(c, p, q) for p in plats])
        profiles = [r for r in results if r]
    else:
        # Full name → DuckDuckGo across the platform domains
        domains = {p["id"]: p["url"].split("/")[2].replace("www.","") for p in plats}
        def _run():
            from ddgs import DDGS
            out = []
            sites = " OR ".join(f"site:{d}" for d in domains.values())
            with DDGS() as ddgs:
                for r in ddgs.text(f'"{q}" ({sites})', max_results=40):
                    href = r.get("href","")
                    pid = next((p["id"] for p in plats if domains[p["id"]] in href), None)
                    if not pid: continue
                    out.append({"platform": pid,
                                "platform_name": next(p["name"] for p in plats if p["id"]==pid),
                                "url": href, "title": r.get("title",""),
                                "kind": next(p["kind"] for p in plats if p["id"]==pid),
                                "login_required": next(p["login"] for p in plats if p["id"]==pid),
                                "status": "candidate"})
            # de-dupe by url
            seen, dd = set(), []
            for o in out:
                if o["url"] not in seen: seen.add(o["url"]); dd.append(o)
            return dd
        try:
            profiles = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, _run), timeout=30)
        except Exception:
            profiles = []

    profiles.sort(key=lambda p: {"verified":0,"blocked":1,"candidate":2}.get(p.get("status"),3))
    payload = {"query": q, "count": len(profiles), "platforms_searched": len(plats),
               "profiles": profiles}
    if profiles:
        await _cache_set(ck, payload, ttl=900)
    return payload


@app.get("/social/platforms")
async def social_platforms():
    return {"platforms": [{"id":p["id"],"name":p["name"],"kind":p["kind"],
                           "login_required":p["login"]} for p in SOCIAL_PLATFORMS]}


@app.post("/analyze-playlist")
async def analyze_playlist(req: AnalyzeReq):
    """Analyse a playlist / channel / profile — returns item count without downloading."""
    ck = _cache_key("playlist", req.url)
    cached = await _cache_get(ck)
    if cached:
        cached["_cached"] = True
        return cached
    try:
        info = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(None, _ytdlp_info, req.url, True), 60)
        entries = list((info or {}).get("entries") or [])
        if info and entries:
            result = {
                "type": "playlist",
                "title": info.get("title") or info.get("webpage_url_basename","Playlist"),
                "uploader": info.get("uploader",""),
                "thumbnail": info.get("thumbnail"),
                "item_count": len(entries),
                "extractor": info.get("extractor",""),
                "is_channel": "channel" in (info.get("webpage_url","") or "").lower(),
            }
            await _cache_set(ck, result, ttl=1800)
            return result
    except Exception:
        pass
    # yt-dlp found no video entries — likely an image-based social profile.
    # Return a usable profile result so the user can still download via gallery-dl.
    result = {
        "type": "playlist",
        "title": _url_title(req.url),
        "uploader": "",
        "thumbnail": None,
        "item_count": 0,          # unknown ahead of time; gallery-dl streams as it goes
        "extractor": "gallery-dl",
        "is_channel": True,
        "note": "Image/media profile — will be fetched with the gallery engine.",
    }
    await _cache_set(ck, result, ttl=600)
    return result


@app.post("/preview-page")
async def preview_page(req: AnalyzeReq):
    """Scrape all image URLs from a page (no download) — for user preview before selecting."""
    try:
        async with _client() as c:
            r = await c.get(req.url, timeout=30)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "lxml")
        title = soup.title.string.strip() if soup.title else ""
        imgs  = _scrape_imgs(soup, req.url)

        # Follow pagination (up to 5 pages)
        seen_pages = {req.url}
        for pg in _next_pages(soup, req.url)[:5]:
            if pg in seen_pages: continue
            seen_pages.add(pg)
            try:
                async with _client() as c:
                    r2 = await c.get(pg, timeout=20)
                    soup2 = BeautifulSoup(r2.text, "lxml")
                imgs += _scrape_imgs(soup2, pg)
            except Exception:
                pass

        # If static scraping found few images, render with headless browser (JS sites)
        if len(set(imgs)) < 8:
            try:
                r_imgs, _ = await asyncio.wait_for(
                    _render_media(req.url, scroll=True, timeout_ms=45000), timeout=70)
                imgs += r_imgs
            except Exception:
                pass

        seen: set[str] = set(); uniq: list[str] = []
        for u in imgs:
            if u not in seen: seen.add(u); uniq.append(u)
        uniq = uniq[:3000]

        return {
            "page_title": title,
            "url": req.url,
            "total": len(uniq),
            "items": [{"url": u, "type": "image"} for u in uniq],
        }
    except HTTPException:
        raise
    except Exception as e:
        # Last resort: pure render
        try:
            r_imgs, _ = await asyncio.wait_for(_render_media(req.url, scroll=True), timeout=70)
            uniq = list(dict.fromkeys(r_imgs))[:3000]
            return {"page_title":"", "url":req.url, "total":len(uniq),
                    "items":[{"url":u,"type":"image"} for u in uniq]}
        except Exception:
            raise HTTPException(400, str(e)[:300])


@app.post("/list-playlist")
async def list_playlist_items(req: AnalyzeReq):
    """List playlist/profile items with thumbnails for user preview before selecting."""
    try:
        info = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(None, _ytdlp_info, req.url, True),
            timeout=90,
        )
        if not info:
            raise HTTPException(400, "Could not extract playlist info")

        entries = list(info.get("entries") or [])
        total   = len(entries)
        preview = entries[:500]  # Show up to 500 items in preview

        items = []
        for i, e in enumerate(preview):
            items.append({
                "index":     i + 1,
                "url":       e.get("url") or e.get("webpage_url") or "",
                "title":     e.get("title") or f"Item {i + 1}",
                "thumbnail": e.get("thumbnail"),
                "duration":  e.get("duration"),
                "uploader":  e.get("uploader"),
                "type":      "video",
            })

        return {
            "title":      info.get("title", "Playlist"),
            "uploader":   info.get("uploader", ""),
            "thumbnail":  info.get("thumbnail"),
            "total":      total,
            "previewing": len(items),
            "items":      items,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e)[:300])


@app.post("/download")
async def download(req: DownloadReq):
    job_dir = DOWNLOAD_DIR / req.job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    async with _sem:
        await _prog(req.job_id, {"status":"starting","progress":0})
        cookie_file: Optional[str] = None
        try:
            if req.cookies:
                cookie_file = _write_cookies(req.cookies)
            # Custom site extractors bypass normal yt-dlp dispatch
            if _PIXELDRAIN_RE.match(req.url):   await _dl_pixeldrain(req, job_dir)
            elif _BUNKR_RE.match(req.url):      await _dl_bunkr(req, job_dir)
            elif _EROME_RE.match(req.url):      await _dl_erome(req, job_dir)
            elif _CYBERDROP_RE.match(req.url):  await _dl_cyberdrop(req, job_dir)
            elif _STREAMTAPE_RE.match(req.url): await _dl_streamtape(req, job_dir)
            elif _DOODSTREAM_RE.match(req.url): await _dl_doodstream(req, job_dir)
            elif _MIXDROP_RE.match(req.url):    await _dl_mixdrop(req, job_dir)
            elif req.capture and req.media_type == "video":
                await _dl_capture(req, job_dir)
            elif req.media_type in ("playlist","profile"):
                await _dl_playlist(req, job_dir, cookie_file)
            elif req.media_type == "video":
                await _dl_video(req, job_dir, cookie_file)
            elif req.media_type == "image":
                await _dl_image(req, job_dir)
            elif req.media_type == "file":
                await _dl_file(req, job_dir)
            elif req.media_type == "torrent":
                await _dl_torrent(req, job_dir)
            else:
                await _dl_page(req, job_dir, cookie_file)

            # Guard: if nothing actually landed on disk, this is a failure, not a success
            saved = [f for f in job_dir.iterdir() if f.is_file()] if job_dir.exists() else []
            if not saved:
                await _prog(req.job_id, {"status":"failed","progress":0,
                    "error":"No file could be downloaded — the source may block direct "
                            "downloads, require login (add cookies), or be DRM-protected."})
                raise HTTPException(500, "No files downloaded")
            return {"success":True}
        except HTTPException:
            raise
        except Exception as e:
            msg = str(e)[:600]
            await _prog(req.job_id, {"status":"failed","progress":0,"error":msg})
            raise HTTPException(500, msg)
        finally:
            if cookie_file: _rm(cookie_file)


# ── Storage management ────────────────────────────────────────────────────────
@app.get("/storage")
async def list_storage():
    jobs = []
    if DOWNLOAD_DIR.exists():
        for job_dir in sorted(DOWNLOAD_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
            if not job_dir.is_dir(): continue
            files = [{"name":f.name,"size":f.stat().st_size}
                     for f in job_dir.iterdir() if f.is_file()]
            total = sum(f["size"] for f in files)
            jobs.append({"job_id":job_dir.name,"files":files,
                         "total_size":total,"file_count":len(files)})
    total_bytes = sum(j["total_size"] for j in jobs)
    return {"jobs":jobs,"total_jobs":len(jobs),"total_bytes":total_bytes}


@app.delete("/storage/{job_id}")
async def delete_storage(job_id: str):
    if not re.match(r'^[0-9a-f\-]{36}$', job_id):
        raise HTTPException(400,"Invalid job ID")
    job_dir = DOWNLOAD_DIR / job_id
    if job_dir.exists():
        shutil.rmtree(job_dir)
    return {"success":True}


# ─────────────────────────────────────────────────────────────────────────────
# DOWNLOAD IMPLEMENTATIONS
# ─────────────────────────────────────────────────────────────────────────────

_DIRECT_EXT = (".mp4",".webm",".mkv",".mov",".m4v",".avi",".flv",".ts",
               ".mp3",".m4a",".ogg",".opus",".flac",".wav",".aac")

# Non-media file types → universal file download (documents, archives, apps, data, etc.)
_FILE_EXT = (
    ".pdf",".epub",".mobi",".azw3",".djvu",
    ".zip",".rar",".7z",".tar",".gz",".bz2",".xz",".tgz",
    ".apk",".exe",".msi",".dmg",".deb",".rpm",".appimage",".iso",".bin",
    ".doc",".docx",".xls",".xlsx",".ppt",".pptx",".odt",".ods",".odp",".rtf",
    ".csv",".tsv",".json",".xml",".yaml",".yml",".sql",".txt",".md",".log",
    ".psd",".ai",".eps",".sketch",".fig",".xd",".indd",
    ".ttf",".otf",".woff",".woff2",
    ".stl",".obj",".fbx",".blend",".3ds",".dwg",".dxf",
    ".heic",".raw",".cr2",".nef",".dng",".arw",".tiff",".ico",
    ".wmv",".wma",".m4b",".aiff",".mid",".midi",".ogv",".m2ts",
)

async def _aria2_dl(url: str, out: Path, jid: str,
                    referer: Optional[str] = None, proxy: Optional[str] = None,
                    timeout: int = 3600) -> bool:
    """Fast multi-connection download via aria2c (16 parallel streams + resume).
       Returns True on success. Used as the fast path for direct media/file URLs."""
    cmd = [
        "aria2c", "-x16", "-s16", "-k1M", "--max-tries=10", "--retry-wait=3",
        "--file-allocation=none", "--auto-file-renaming=false", "--continue=true",
        "--summary-interval=1", "--console-log-level=warn", "--allow-overwrite=true",
        "--check-certificate=false", "--max-connection-per-server=16",
        "-d", str(out.parent), "-o", out.name,
        "--user-agent", _ua(), "--header", "Accept: */*",
    ]
    if referer:
        cmd += ["--referer", referer, "--header", f"Origin: {_origin(referer)}"]
    if proxy:
        cmd += ["--all-proxy", proxy]
    cmd.append(url)
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)

        async def _pump():
            assert proc.stdout
            async for raw in proc.stdout:
                line = raw.decode("utf-8", "ignore")
                m = re.search(r"\((\d+)%\)", line)
                if m:
                    _prog_s(jid, {"status":"downloading","progress":min(95,int(m.group(1)) * 95 // 100)})
        try:
            await asyncio.wait_for(_pump(), timeout=timeout)
            await asyncio.wait_for(proc.wait(), timeout=30)
        except asyncio.TimeoutError:
            try: proc.kill()
            except Exception: pass
            return False
        return proc.returncode == 0 and out.exists() and out.stat().st_size >= 1024
    except FileNotFoundError:
        return False  # aria2c not installed → caller falls back to httpx
    except Exception:
        return False


async def _dl_direct(url: str, jid: str, job_dir: Path, fmt: str,
                     referer: Optional[str] = None, proxy: Optional[str] = None) -> bool:
    """Download a direct media/file URL (handles URLs pulled straight from the
       network tab). Tries aria2c (fast, multi-connection, resumable) first, then
       falls back to a resilient httpx stream. Returns True on success."""
    raw = url.split("/")[-1].split("?")[0] or "video"
    if "." not in raw:
        raw = f"video.{fmt if fmt in ('mp4','webm','mkv') else 'mp4'}"
    out = _uniq(job_dir, _safe(raw))

    headers = {**_BASE_HDR, "User-Agent": _ua(), "Accept": "*/*"}
    if referer:
        headers["Referer"] = referer
        headers["Origin"] = _origin(referer)

    await _prog(jid, {"status":"downloading","progress":1})

    # Fast path: aria2c (16 connections + resume). Skip for HLS/DASH manifests.
    if not url.split("?")[0].lower().endswith((".m3u8", ".mpd")):
        if await _aria2_dl(url, out, jid, referer, proxy):
            files = [f.name for f in job_dir.iterdir() if f.is_file()]
            await _prog(jid, {"status":"completed","progress":100,"files":files})
            return True
        # aria2 may leave a partial/control file — clean up before httpx retry
        try:
            if out.exists() and out.stat().st_size < 1024: out.unlink()
            ctrl = out.with_suffix(out.suffix + ".aria2")
            if ctrl.exists(): ctrl.unlink()
        except Exception: pass

    try:
        async with httpx.AsyncClient(follow_redirects=True, http2=True, verify=VERIFY_SSL,
                                     timeout=httpx.Timeout(None, connect=20),
                                     proxy=proxy or None, headers=headers) as c:
            async with c.stream("GET", url) as r:
                if r.status_code not in (200, 206):
                    return False
                if "text/html" in (r.headers.get("content-type","") or "").lower():
                    return False  # error/landing page, not media
                total = int(r.headers.get("content-length", 0)) or 0
                done = 0
                async with aiofiles.open(out, "wb") as f:
                    async for chunk in r.aiter_bytes(1048576):   # 1 MB chunks
                        await f.write(chunk)
                        done += len(chunk)
                        if total:
                            _prog_s(jid, {"status":"downloading","progress":min(95,int(done/total*95)),
                                          "downloaded":done,"total":total})
        if not out.exists() or out.stat().st_size < 1024:
            if out.exists(): out.unlink()
            return False
        files = [f.name for f in job_dir.iterdir() if f.is_file()]
        await _prog(jid, {"status":"completed","progress":100,"files":files})
        return True
    except Exception:
        try:
            if out.exists() and out.stat().st_size < 1024: out.unlink()
        except Exception: pass
        return False


def _filename_from(url: str, content_disposition: str = "") -> str:
    """Best-effort filename from Content-Disposition or the URL path."""
    m = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", content_disposition or "", re.I)
    if m:
        try:
            from urllib.parse import unquote
            return _safe(unquote(m.group(1)))
        except Exception:
            return _safe(m.group(1))
    raw = url.split("/")[-1].split("?")[0] or "download"
    return _safe(raw) if raw else "download"


async def _dl_file(req: DownloadReq, job_dir: Path):
    """Universal file downloader — streams ANY file type to disk (pdf, zip, apk, docs,
       exe, csv, epub, anything). Browser-style headers, follows redirects, no media
       guard. RESUMABLE: writes to <name>.part and uses HTTP Range to continue an
       interrupted download instead of restarting."""
    await _prog(req.job_id, {"status":"downloading","progress":1})
    headers = {**_BASE_HDR, "User-Agent": _ua(), "Accept": "*/*"}

    # Resolve a stable filename first (HEAD), so a retry resumes the same .part file
    name = _filename_from(req.url, "")
    try:
        async with _client(req.proxy) as hc:
            hr = await hc.head(req.url, timeout=15)
            cd = hr.headers.get("content-disposition", "")
            if cd: name = _filename_from(req.url, cd)
            if "." not in name:
                ext = (hr.headers.get("content-type","").split(";")[0].split("/")[-1].strip() or "bin")
                name = f"{name}.{ext[:8]}"
    except Exception:
        pass

    final = job_dir / _safe(name)
    part  = job_dir / (_safe(name) + ".part")
    resume_from = part.stat().st_size if part.exists() else 0

    h = dict(headers)
    if resume_from > 0:
        h["Range"] = f"bytes={resume_from}-"

    async with httpx.AsyncClient(follow_redirects=True, http2=True, verify=VERIFY_SSL,
                                 timeout=httpx.Timeout(None, connect=20),
                                 proxy=req.proxy or None, headers=h) as c:
        async with c.stream("GET", req.url) as r:
            # If server ignored Range (200 not 206), start fresh
            if resume_from > 0 and r.status_code == 200:
                resume_from = 0
                try: part.unlink()
                except Exception: pass
            r.raise_for_status()
            clen = int(r.headers.get("content-length", 0)) or 0
            total = (resume_from + clen) if clen else 0
            done = resume_from
            mode = "ab" if resume_from > 0 else "wb"
            async with aiofiles.open(part, mode) as f:
                async for chunk in r.aiter_bytes(65536):
                    await f.write(chunk)
                    done += len(chunk)
                    if total:
                        _prog_s(req.job_id, {"status":"downloading","progress":min(95,int(done/total*95)),
                                              "downloaded":done,"total":total})

    # Finalize: rename .part → unique final name
    target = _uniq(job_dir, _safe(name))
    part.rename(target)
    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    await _prog(req.job_id, {"status":"completed","progress":100,"files":files})


async def _dl_torrent(req: DownloadReq, job_dir: Path):
    """Download a torrent or magnet link via aria2c (BitTorrent + DHT). Downloads the
       torrent's files into job_dir; does not seed (seed-time=0)."""
    await _prog(req.job_id, {"status":"downloading","progress":2})
    cmd = [
        "aria2c", req.url,
        "--dir", str(job_dir),
        "--seed-time=0",                 # don't seed after completing
        "--bt-stop-timeout=120",         # give up if no peers for 2 min
        "--summary-interval=2",
        "--console-log-level=warn",
        "--bt-max-peers=80",
        "--max-connection-per-server=8",
        "--follow-torrent=mem",
        "--bt-tracker=udp://tracker.opentrackr.org:1337/announce,udp://open.tracker.cl:1337/announce,udp://tracker.openbittorrent.com:6969/announce",
    ]
    if req.proxy:
        cmd += ["--all-proxy", req.proxy]

    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)

    pct_re = re.compile(r"\((\d{1,3})%\)")
    async def _pump():
        assert proc.stdout
        async for raw in proc.stdout:
            line = raw.decode("utf-8","ignore")
            m = pct_re.search(line)
            if m:
                _prog_s(req.job_id, {"status":"downloading","progress":min(95,int(m.group(1)))})
    try:
        await asyncio.wait_for(_pump(), timeout=7200)
        await asyncio.wait_for(proc.wait(), timeout=60)
    except asyncio.TimeoutError:
        try: proc.kill()
        except Exception: pass

    # aria2 leaves .aria2 control files — remove them
    for ctrl in job_dir.rglob("*.aria2"):
        try: ctrl.unlink()
        except Exception: pass
    # Flatten nested torrent folders so the (flat) file server can serve every file
    for f in list(job_dir.rglob("*")):
        if f.is_file() and f.parent != job_dir:
            dest = _uniq(job_dir, _safe(f.name))
            try: f.rename(dest)
            except Exception: pass
    for d in sorted([p for p in job_dir.rglob("*") if p.is_dir()], reverse=True):
        try: d.rmdir()
        except Exception: pass
    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    if not files:
        raise Exception("Torrent download failed — no peers/seeders or invalid magnet.")
    await _prog(req.job_id, {"status":"completed","progress":100,"files":files})


async def _dl_gallery_dl(url: str, jid: str, job_dir: Path,
                         cookie_file: Optional[str] = None, proxy: Optional[str] = None,
                         max_items: Optional[int] = None, timeout: int = 1800) -> int:
    """Run gallery-dl — a mature extractor covering 300+ gallery / social / image-board
       / adult-image sites (Pixiv, DeviantArt, ArtStation, Twitter media, Instagram,
       Reddit, Tumblr, booru boards, many adult galleries). Downloads flat into job_dir.
       Returns the number of files downloaded."""
    before = {f.name for f in job_dir.iterdir() if f.is_file()} if job_dir.exists() else set()
    rng = f"1-{max_items}" if max_items else "1-2000"
    cmd = [
        "gallery-dl", "-D", str(job_dir), "--no-mtime", "--no-colors",
        "--range", rng,
        "-o", f"extractor.user-agent={_ua()}",
        "-o", "extractor.retries=4",
        "-o", "extractor.timeout=30",
    ]
    if cookie_file: cmd += ["--cookies", cookie_file]
    if proxy:       cmd += ["--proxy", proxy]
    cmd.append(url)

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)

        async def _pump():
            assert proc.stdout
            n = 0
            async for raw in proc.stdout:
                line = raw.decode("utf-8", "ignore").strip()
                # gallery-dl prints the path of each downloaded file (not bracketed logs)
                if line and not line.startswith(("[", "#")):
                    n += 1
                    _prog_s(jid, {"status":"downloading","progress":min(92, 8 + n),
                                  "completed_files": n})
        try:
            await asyncio.wait_for(_pump(), timeout=timeout)
            await asyncio.wait_for(proc.wait(), timeout=30)
        except asyncio.TimeoutError:
            try: proc.kill()
            except Exception: pass
    except FileNotFoundError:
        return 0   # gallery-dl not installed
    except Exception:
        pass

    after = [f for f in job_dir.iterdir() if f.is_file()] if job_dir.exists() else []
    new = [f for f in after if f.name not in before]
    return len(new)


async def _subprocess_dl(cmd: list, jid: str, job_dir: Path, timeout: int = 1200) -> int:
    """Generic subprocess downloader — runs cmd, then counts new files in job_dir."""
    before = {f.name for f in job_dir.iterdir() if f.is_file()} if job_dir.exists() else set()
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
        try:
            await asyncio.wait_for(proc.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            try: proc.kill()
            except Exception: pass
    except FileNotFoundError:
        return 0
    except Exception:
        pass
    after = [f for f in job_dir.iterdir() if f.is_file()] if job_dir.exists() else []
    return len([f for f in after if f.name not in before])


async def _dl_youget(url: str, jid: str, job_dir: Path, proxy: Optional[str] = None) -> int:
    """you-get — strong coverage of Asian sites (Bilibili, Youku, iQiyi, AcFun, Weibo,
       Tudou, Miaopai…) and many others yt-dlp can miss."""
    await _prog(jid, {"status":"downloading","progress":12})
    cmd = ["you-get", "--output-dir", str(job_dir), "--no-caption"]
    if proxy: cmd += ["--http-proxy", proxy]
    cmd.append(url)
    return await _subprocess_dl(cmd, jid, job_dir)


async def _dl_streamlink(url: str, jid: str, job_dir: Path, quality: str = "best") -> int:
    """streamlink — live streams, VODs, sports, Twitch, Picarto, many live-TV plugins."""
    await _prog(jid, {"status":"downloading","progress":12})
    out = _uniq(job_dir, f"{_safe(_url_title(url)) or 'stream'}.ts")
    q = "best" if quality in ("best", "0", "") else f"{quality.replace('p','')}p,best"
    cmd = ["streamlink", "--force", "--hls-live-restart", "-o", str(out), url, q]
    return await _subprocess_dl(cmd, jid, job_dir)


async def _dl_capture(req: DownloadReq, job_dir: Path):
    """Record what plays in the headless browser (legal screen-capture for blob:/MSE
       streams with no downloadable URL). Captures the rendered output, not the
       encrypted source — so it does NOT circumvent DRM (and headless Chromium has no
       Widevine CDM, so true Widevine streams will not play here)."""
    from playwright.async_api import async_playwright
    import tempfile as _tf

    cap_dir = Path(_tf.mkdtemp(prefix="cap_"))
    await _prog(req.job_id, {"status":"starting","progress":2})

    width, height = 1280, 720
    recorded_webm: Optional[Path] = None

    # Hard ceiling so a stalled browser can never hang the worker forever
    budget = (req.capture_seconds or 120) + 90

    async def _run():
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True,
                args=["--no-sandbox","--disable-dev-shm-usage","--autoplay-policy=no-user-gesture-required"],
                proxy={"server": req.proxy} if req.proxy else None)
            ctx = await browser.new_context(
                user_agent=_ua(), viewport={"width":width,"height":height},
                ignore_https_errors=True,
                record_video_dir=str(cap_dir),
                record_video_size={"width":width,"height":height},
            )
            page = await ctx.new_page()
            try:
                await page.goto(req.url, wait_until="domcontentloaded", timeout=30000)
            except Exception: pass
            try: await page.wait_for_load_state("load", timeout=8000)
            except Exception: pass

            # Find a <video>, make it fill the viewport, unmute and play
            try:
                dur = await page.evaluate("""async () => {
                  const v = document.querySelector('video');
                  if (!v) return 0;
                  try { v.muted = false; } catch(e){}
                  v.style.position='fixed'; v.style.left=0; v.style.top=0;
                  v.style.width='100vw'; v.style.height='100vh'; v.style.zIndex=999999;
                  v.style.background='black'; v.style.objectFit='contain';
                  try { await v.play(); } catch(e){}
                  return v.duration && isFinite(v.duration) ? v.duration : 0;
                }""")
            except Exception:
                dur = 0

            cap = req.capture_seconds or (int(dur) + 3 if dur else 60)
            cap = max(5, min(cap, 1800))
            await _prog(req.job_id, {"status":"downloading","progress":10})

            step = max(1, cap // 18)
            elapsed = 0
            while elapsed < cap:
                await page.wait_for_timeout(step * 1000)
                elapsed += step
                try:
                    ended = await page.evaluate("() => { const v=document.querySelector('video'); return v ? v.ended : true }")
                except Exception:
                    ended = False
                _prog_s(req.job_id, {"status":"downloading","progress":min(92, 10 + int(elapsed/cap*82))})
                if ended: break

            await ctx.close()   # finalizes the video file
            await browser.close()

    async with _render_sem:
        try:
            await asyncio.wait_for(_run(), timeout=budget)
            webms = list(cap_dir.glob("*.webm"))
            recorded_webm = webms[0] if webms else None
        except asyncio.TimeoutError:
            webms = list(cap_dir.glob("*.webm"))
            recorded_webm = webms[0] if webms else None  # may have partial recording
        except Exception as e:
            raise Exception(f"Screen capture failed: {str(e)[:200]}")

    if not recorded_webm or not recorded_webm.exists() or recorded_webm.stat().st_size < 2048:
        raise Exception("Nothing was captured — the page may have no playable <video> "
                        "(DRM streams will not play in this browser, so cannot be captured).")

    await _prog(req.job_id, {"status":"processing","progress":95})
    # Remux/transcode to the requested format
    fmt = req.format if req.format in ("mp4","webm","mkv") else "mp4"
    title = _safe(_url_title(req.url)) or "capture"
    out = _uniq(job_dir, f"{title}_capture.{fmt}")
    if fmt == "webm":
        shutil.move(str(recorded_webm), str(out))
    else:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg","-y","-i",str(recorded_webm),"-c:v","libx264","-preset","veryfast",
            "-crf","23","-c:a","aac","-movflags","+faststart", str(out),
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
        await proc.wait()
        if proc.returncode != 0 or not out.exists():
            # fall back to keeping the raw webm
            out = _uniq(job_dir, f"{title}_capture.webm")
            shutil.move(str(recorded_webm), str(out))

    try: shutil.rmtree(cap_dir)
    except Exception: pass

    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    await _prog(req.job_id, {"status":"completed","progress":100,"files":files})


async def _dl_video(req: DownloadReq, job_dir: Path, cookie_file: Optional[str]):
    # 0. pat.com — requires custom JWT auth flow
    if _PAT_COM_RE.match(req.url):
        await _dl_pat_com(req, job_dir)
        return
    # 0. Fast path: a directly-pasted media file URL (e.g. from the network tab)
    base = req.url.split("?")[0].lower()
    if base.endswith(_DIRECT_EXT):
        if await _dl_direct(req.url, req.job_id, job_dir, req.format, proxy=req.proxy):
            return
    try:
        await asyncio.get_event_loop().run_in_executor(
            None, _ytdlp_dl, req.url, req.job_id, job_dir,
            req.format, req.quality, cookie_file, req.proxy,
            req.subtitles, req.embed_thumbnail, req.embed_metadata,
            False, None, 1,
            req.start_time, req.end_time, req.subtitle_langs,
            req.sponsor_block, req.split_chapters, req.normalize_audio,
            req.write_thumbnail, req.output_template,
            req.speed_limit, req.concurrent_fragments,
        )
        return
    except Exception: pass
    # ffmpeg fallback for raw HLS/DASH/direct stream URLs
    lower = req.url.lower()
    if any(k in lower for k in (".m3u8",".mpd",".ts",".mp4",".webm","hls","dash","stream","/live","manifest")):
        try:
            await _ffmpeg_stream(req.url, req.job_id, job_dir, req.format)
            return
        except Exception: pass
    # Final fallback: render page in headless browser and grab the (often hidden) media stream
    await _prog(req.job_id, {"status":"scraping","progress":3})
    try:
        _imgs, vids = await asyncio.wait_for(
            _render_media(req.url, proxy=req.proxy, scroll=True, timeout_ms=45000, want_video=True), timeout=90)
    except Exception:
        vids = []
    for media_url in _rank_video(vids):
        hdrs = _LAST_MEDIA_HEADERS.get(media_url) or {}
        ref = hdrs.get("referer") or req.url
        mbase = media_url.split("?")[0].lower()
        # Direct file → reliable httpx stream with page referer; manifests → ffmpeg
        if mbase.endswith(_DIRECT_EXT) and not mbase.endswith((".m3u8",".mpd")):
            if await _dl_direct(media_url, req.job_id, job_dir, req.format, referer=ref, proxy=req.proxy):
                return
        try:
            await _ffmpeg_stream(media_url, req.job_id, job_dir, req.format, referer=ref)
            return
        except Exception:
            continue

    # Extra engine tiers — each covers sites the others miss
    for engine in (
        lambda: _dl_gallery_dl(req.url, req.job_id, job_dir, cookie_file, req.proxy, max_items=req.max_items),
        lambda: _dl_youget(req.url, req.job_id, job_dir, req.proxy),
        lambda: _dl_streamlink(req.url, req.job_id, job_dir, req.quality or "best"),
    ):
        try:
            if await engine() > 0:
                files = [f.name for f in job_dir.iterdir() if f.is_file()]
                await _prog(req.job_id, {"status":"completed","progress":100,"files":files})
                return
        except Exception:
            continue

    raise Exception("Could not find a downloadable video on this page (it may be DRM-protected).")


async def _dl_playlist(req: DownloadReq, job_dir: Path, cookie_file: Optional[str]):
    """Download a playlist / channel / social profile.

    yt-dlp handles video channels/playlists. But image-based social profiles
    (Instagram, Twitter/X media, Pixiv, Reddit, Tumblr, TikTok photo posts…) are
    NOT video playlists — yt-dlp returns 0 files there. So we try yt-dlp first and,
    if nothing lands on disk, fall back to gallery-dl, which is purpose-built for
    profile/gallery scraping. This is the fix for 'profile downloader not working'."""
    before = {f.name for f in job_dir.iterdir() if f.is_file()} if job_dir.exists() else set()

    # Tier 1 — yt-dlp (videos / channels / playlists)
    try:
        await asyncio.get_event_loop().run_in_executor(
            None, _ytdlp_dl, req.url, req.job_id, job_dir,
            req.format, req.quality, cookie_file, req.proxy,
            req.subtitles, req.embed_thumbnail, req.embed_metadata,
            True, req.max_items, req.start_index,
            None, None, req.subtitle_langs,
            req.sponsor_block, req.split_chapters, req.normalize_audio,
            req.write_thumbnail, req.output_template,
            req.speed_limit, req.concurrent_fragments,
        )
    except Exception:
        pass  # fall through to gallery-dl

    landed = [f for f in job_dir.iterdir() if f.is_file() and f.name not in before] if job_dir.exists() else []
    if landed:
        return

    # Tier 2 — gallery-dl (image/media profiles & galleries)
    await _prog(req.job_id, {"status":"scraping","progress":6,
                             "filename":"Switching to gallery engine for this profile…"})
    n = await _dl_gallery_dl(req.url, req.job_id, job_dir, cookie_file, req.proxy,
                             max_items=req.max_items)
    if n == 0:
        # Tier 3 — headless render to harvest media from a JS-driven profile page
        try:
            imgs, vids = await asyncio.wait_for(
                _render_media(req.url, scroll=True, timeout_ms=45000, want_video=True), timeout=75)
            urls = list(dict.fromkeys((vids or []) + (imgs or [])))
            if req.max_items: urls = urls[:req.max_items]
            for u in urls:
                try:
                    await _dl_direct(u, req.job_id, job_dir, "original", req.url, req.proxy)
                except Exception:
                    continue
        except Exception:
            pass


def _ytdlp_info(url: str, flat: bool) -> dict:
    opts = {"quiet":True,"no_warnings":True,"skip_download":True,
            "socket_timeout":30,"extract_flat":flat,
            "geo_bypass":True,"nocheckcertificate":True,"age_limit":99,
            "http_headers":{"User-Agent":_ua()}}
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False)


def _ytdlp_dl(
    url: str, job_id: str, job_dir: Path,
    fmt: str, quality: str,
    cookie_file: Optional[str], proxy: Optional[str],
    subtitles: bool, embed_thumb: bool, embed_meta: bool,
    is_playlist: bool, max_items: Optional[int], start_idx: int,
    start_time: Optional[str] = None, end_time: Optional[str] = None,
    subtitle_langs: Optional[list] = None,
    sponsor_block: bool = False,
    split_chapters: bool = False,
    normalize_audio: bool = False,
    write_thumbnail: bool = False,
    output_template: Optional[str] = None,
    speed_limit: Optional[str] = None,
    concurrent_fragments: int = 16,
):
    fmt = (fmt or "mp4").lower()
    cap = None if quality in ("best","0","") else quality.replace("p","").strip()

    # Build format string
    if fmt in ("mp3","m4a","opus","ogg","flac","wav","aac","vorbis"):
        fstr = "bestaudio/best"
    elif cap:
        fstr = (f"bestvideo[height<={cap}][ext=mp4]+bestaudio[ext=m4a]"
                f"/bestvideo[height<={cap}]+bestaudio/best[height<={cap}]")
    elif fmt == "mp4":
        fstr = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best"
    else:
        fstr = "bestvideo+bestaudio/best"

    # Playlist-aware progress tracking
    downloaded = [0]
    total_items = [0]

    def hook(d: dict):
        if d["status"] == "downloading":
            tb = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            db = d.get("downloaded_bytes",0)
            pct = int(db/tb*95) if tb else 0
            if is_playlist and total_items[0] > 0:
                # Playlist: blend item count + byte progress
                item_pct  = int(downloaded[0]/total_items[0]*100)
                pct = max(pct, item_pct)
            _prog_s(job_id, {
                "status":"downloading","progress":pct,
                "speed":d.get("speed"),"eta":d.get("eta"),
                "downloaded":db,"total":tb,
                "completed_files":downloaded[0],
                "total_files":total_items[0] or None,
                "filename": Path(d.get("filename","")).name,
            })
        elif d["status"] == "finished":
            downloaded[0] += 1
            pct = int(downloaded[0]/max(total_items[0],1)*95) if is_playlist else 95
            _prog_s(job_id,{"status":"processing","progress":pct,
                            "completed_files":downloaded[0],"total_files":total_items[0] or None})

    # Build postprocessors
    pps: list = []
    if fmt in ("mp3","m4a","opus","ogg","flac","wav","aac","vorbis"):
        pps.append({"key":"FFmpegExtractAudio","preferredcodec":fmt,
                    "preferredquality":"320" if fmt=="mp3" else "0"})
    elif fmt not in ("mp4","webm","mkv","ts","avi","mov","flv","3gp","original"):
        pps.append({"key":"FFmpegVideoConvertor","preferedformat":fmt})
    if subtitles:
        pps.append({"key":"FFmpegEmbedSubtitle","already_have_subtitle":False})
    if embed_thumb:
        pps.append({"key":"EmbedThumbnail","already_have_thumbnail":False})
    if embed_meta:
        pps.append({"key":"FFmpegMetadata","add_metadata":True,"add_chapters":True})
    if normalize_audio:
        pps.append({"key":"FFmpegPostProcessor",
                    "preferedformat": fmt if fmt in ("mp3","m4a","opus","flac","wav","aac","ogg") else "mp4",
                    "preferredcodec": None,
                    "postprocessor_args": ["-filter:a", "loudnorm=I=-16:TP=-1.5:LRA=11"]})
    if split_chapters:
        pps.append({"key":"FFmpegSplitChapters","force_keyframes":True})

    if output_template:
        tpl = output_template
    elif is_playlist:
        tpl = "%(playlist_index)03d - %(title)s.%(ext)s"
    else:
        tpl = "%(title)s.%(ext)s"

    opts: dict = {
        # Core
        "format": fstr,
        "outtmpl": str(job_dir / tpl),
        "progress_hooks": [hook],
        "quiet": True,
        "no_warnings": True,
        "merge_output_format": fmt if fmt in ("mp4","webm","mkv") else "mp4",

        # Retries & reliability
        "retries": 15,
        "fragment_retries": 30,
        "extractor_retries": 10,
        "file_access_retries": 10,
        "socket_timeout": 120,
        "concurrent_fragment_downloads": max(1, min(16, concurrent_fragments)),
        "continuedl": True,             # resume interrupted downloads
        "http_chunk_size": 10485760,    # 10 MB chunks — beats per-request throttling

        # Speed: aria2c multi-connection for plain HTTP(S) (YouTube progressive,
        # direct files); keep yt-dlp's native concurrent fragments for HLS/DASH.
        "external_downloader": {"http": "aria2c", "https": "aria2c", "ftp": "aria2c"},

        # Access: bypass geo-blocks, SSL issues, and age gates (adult/social sites)
        "geo_bypass": True,
        "nocheckcertificate": True,
        "age_limit": 99,           # confirm-age so adult sites serve content
        "noplaylist": False,
        "hls_prefer_native": False,  # use ffmpeg for HLS (more robust)

        # Anti-blocking: randomised delays
        "sleep_interval": 1,
        "max_sleep_interval": 5,
        "sleep_interval_requests": 0.5,

        # Headers (rotate UA each run)
        "http_headers": {
            "User-Agent": _ua(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
        },

        # aria2c: 16 parallel connections per file + resume + retries.
        # ffmpeg: allow all protocols for HLS/DASH muxing.
        "external_downloader_args": {
            "aria2c": ["-x16","-s16","-k1M","--max-tries=10","--retry-wait=3",
                       "--file-allocation=none","--auto-file-renaming=false",
                       "--continue=true","--summary-interval=0"],
            "ffmpeg_i": ["-protocol_whitelist","all"],
        },

        # Metadata
        "addmetadata": embed_meta,
        "writethumbnail": embed_thumb or write_thumbnail,
        "writesubtitles": subtitles,
        "writeautomaticsub": subtitles,
        "subtitleslangs": (subtitle_langs or ["en","en-US","en-GB"]) if subtitles else [],
        # SponsorBlock
        **({"sponsorblock_remove": ["sponsor","intro","outro","selfpromo","preview","filler","music_offtopic"]}
           if sponsor_block else {}),
        # Speed throttle
        **({"ratelimit": speed_limit} if speed_limit else {}),

        # Playlist
        "ignoreerrors": True,   # skip unavailable items and continue
        "playliststart": start_idx,
        **({"playlistend": start_idx + max_items - 1} if max_items else {}),

        # Post processors
        "postprocessors": pps,
    }

    if cookie_file:
        opts["cookiefile"] = cookie_file
    if proxy:
        opts["proxy"] = proxy

    # Clip extraction — download only a time range
    if start_time or end_time:
        def _t2s(t: str) -> float:
            parts = t.strip().split(":")
            try:
                if len(parts) == 3:
                    return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
                if len(parts) == 2:
                    return int(parts[0]) * 60 + float(parts[1])
                return float(parts[0])
            except (ValueError, IndexError):
                return 0.0
        s = _t2s(start_time) if start_time else 0.0
        e = _t2s(end_time)   if end_time   else float("inf")
        try:
            from yt_dlp.utils import download_range_func
            opts["download_ranges"]       = download_range_func(None, [(s, e)])
            opts["force_keyframes_at_cuts"] = True
        except Exception:
            pass

    with yt_dlp.YoutubeDL(opts) as ydl:
        # Pre-count playlist
        if is_playlist:
            try:
                info = ydl.extract_info(url, download=False)
                entries = list(info.get("entries") or [])
                if max_items:
                    entries = entries[:max_items]
                total_items[0] = len(entries)
                _prog_s(job_id,{"status":"downloading","progress":1,
                                "total_files":total_items[0],"completed_files":0})
            except Exception: pass
        ydl.download([url])

    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    _prog_s(job_id,{"status":"completed","progress":100,"files":files,
                    "completed_files":downloaded[0],"total_files":total_items[0] or len(files)})


async def _ffmpeg_stream(url: str, jid: str, job_dir: Path, fmt: str, referer: Optional[str] = None):
    ext = fmt if fmt in ("mp4","mkv","ts","webm") else "mp4"
    out = job_dir / f"stream.{ext}"
    await _prog(jid, {"status":"downloading","progress":2})

    # Use the page as Referer/Origin when known (CDNs often require it for hidden URLs)
    ref = referer or url
    origin = _origin(ref)
    cmd = [
        "ffmpeg","-y",
        "-user_agent", _ua(),
        "-headers", f"Accept: */*\r\nOrigin: {origin}\r\nReferer: {ref}\r\n",
        "-protocol_whitelist","file,crypto,data,http,https,tcp,tls,hls,dash",
        "-allowed_extensions","ALL",
        "-i", url,
        "-c","copy","-movflags","+faststart",
        str(out),
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)

    dur_re  = re.compile(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)")
    time_re = re.compile(r"time=(\d+):(\d+):(\d+\.?\d*)")
    total_s: Optional[float] = None

    async for raw in proc.stderr:   # type: ignore
        line = raw.decode("utf-8","ignore")
        if total_s is None:
            m = dur_re.search(line)
            if m: total_s = _hms(*m.groups())
        m = time_re.search(line)
        if m and total_s:
            _prog_s(jid,{"status":"downloading","progress":min(94,int(_hms(*m.groups())/total_s*94))})

    await proc.wait()
    if proc.returncode != 0:
        raise Exception("FFmpeg stream download failed — may be DRM-protected or geo-blocked.")
    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    await _prog(jid,{"status":"completed","progress":100,"files":files})


async def _dl_image(req: DownloadReq, job_dir: Path):
    await _prog(req.job_id,{"status":"downloading","progress":15})
    async with _client(req.proxy) as c:
        r = await c.get(req.url, timeout=60)
        r.raise_for_status()
    await _prog(req.job_id,{"status":"converting","progress":60})
    data = r.content
    ct   = (r.headers.get("content-type","image/jpeg") or "").split(";")[0].strip().lower()
    orig_ext = _ct_ext(ct)
    raw_name = req.url.split("/")[-1].split("?")[0] or "image"
    if "." not in raw_name: raw_name = f"image.{orig_ext}"
    name = _safe(raw_name); target = req.format.lower()
    if target in ("original", orig_ext, ""):
        path = _uniq(job_dir, name)
        async with aiofiles.open(path,"wb") as f: await f.write(data)
        files = [path.name]
    else:
        out = await asyncio.get_event_loop().run_in_executor(
            None, _pil_convert, data, job_dir, Path(name).stem, target)
        files = [out]
    await _prog(req.job_id,{"status":"completed","progress":100,"files":files})


async def _dl_page(req: DownloadReq, job_dir: Path, cookie_file: Optional[str] = None):
    await _prog(req.job_id,{"status":"scraping","progress":3})

    # Tier 1: gallery-dl — native support for galleries/social/image-boards/adult sites.
    try:
        n = await _dl_gallery_dl(req.url, req.job_id, job_dir, cookie_file, req.proxy,
                                 max_items=req.max_items or MAX_PAGE_IMAGES)
        if n > 0:
            files = [f.name for f in job_dir.iterdir() if f.is_file()]
            await _prog(req.job_id, {"status":"completed","progress":100,
                                      "files":files, "total_files":len(files)})
            return
    except Exception:
        pass

    # Tier 2: HTML scrape (+ render fallback below)
    async with _client(req.proxy) as c:
        r = await c.get(req.url, timeout=30); r.raise_for_status()
        soup = BeautifulSoup(r.text,"lxml")
    img_urls = _scrape_imgs(soup, req.url)

    # Follow next-page links (up to 10 pages)
    visited = {req.url}
    next_urls = _next_pages(soup, req.url)
    for nx in next_urls[:10]:
        if nx in visited: continue
        visited.add(nx)
        try:
            async with _client(req.proxy) as c:
                r2 = await c.get(nx, timeout=20)
                extra = BeautifulSoup(r2.text,"lxml")
            img_urls += _scrape_imgs(extra, nx)
        except Exception: pass

    # If static scraping found few, render with headless browser (JS sites)
    if len(set(img_urls)) < 8:
        try:
            r_imgs, _ = await asyncio.wait_for(
                _render_media(req.url, proxy=req.proxy, scroll=True, timeout_ms=45000), timeout=80)
            img_urls += r_imgs
        except Exception: pass

    # Deduplicate, cap
    seen: set[str] = set(); uniq: list[str] = []
    for u in img_urls:
        if u not in seen: seen.add(u); uniq.append(u)
    uniq = uniq[:MAX_PAGE_IMAGES]

    if not uniq:
        await _prog(req.job_id,{"status":"failed","progress":0,"error":"No images found on page"})
        return

    total = len(uniq)
    await _prog(req.job_id,{"status":"downloading","progress":8,"total_files":total,"completed_files":0})

    img_sem = asyncio.Semaphore(15)
    downloaded: list[str] = []; lock = asyncio.Lock()

    async def _one(i: int, iurl: str):
        async with img_sem:
            try:
                async with _client(req.proxy) as c:
                    r = await c.get(iurl, timeout=20)
                if r.status_code==200 and "image/" in (r.headers.get("content-type","") or ""):
                    raw = iurl.split("/")[-1].split("?")[0] or f"img_{i}"
                    if "." not in raw: raw = f"img_{i}.jpg"
                    name = _safe(raw); target = req.format.lower()
                    if target=="original":
                        path = _uniq(job_dir,name)
                        async with aiofiles.open(path,"wb") as f: await f.write(r.content)
                        async with lock: downloaded.append(path.name)
                    else:
                        out = await asyncio.get_event_loop().run_in_executor(
                            None, _pil_convert, r.content, job_dir, f"{Path(name).stem}_{i}", target)
                        async with lock: downloaded.append(out)
            except Exception: pass
        pct = 8+int((i+1)/total*87)
        async with lock: done = len(downloaded)
        _prog_s(req.job_id,{"status":"downloading","progress":pct,
                             "total_files":total,"completed_files":done})

    await asyncio.gather(*(_one(i,u) for i,u in enumerate(uniq)))
    await _prog(req.job_id,{"status":"completed","progress":100,
                            "files":downloaded,"total_files":len(downloaded)})


# ─────────────────────────────────────────────────────────────────────────────
# NEW ENDPOINTS  v4.0
# ─────────────────────────────────────────────────────────────────────────────

# ── /rss — parse RSS / Atom / M3U / M3U8 playlist feeds ──────────────────────
class RssReq(BaseModel):
    url: str
    @field_validator("url")
    @classmethod
    def _http(cls, v):
        v = v.strip()
        if not v.startswith(("http://","https://")):
            raise ValueError("URL must start with http:// or https://")
        return v

@app.post("/rss")
async def parse_feed(req: RssReq):
    """Parse an RSS/Atom feed or M3U/M3U8 IPTV playlist.
    Returns a list of items with title, url, thumbnail, duration, pub_date."""
    ck = _cache_key("rss", req.url)
    cached = await _cache_get(ck)
    if cached:
        cached["_cached"] = True
        return cached

    url_lower = req.url.lower().split("?")[0]

    # ── M3U / IPTV ────────────────────────────────────────────────────────────
    if url_lower.endswith(".m3u") or url_lower.endswith(".m3u8") or "iptv" in req.url.lower():
        async with _client() as c:
            r = await c.get(req.url, timeout=30)
            r.raise_for_status()
        text = r.text
        items = []
        lines = text.splitlines()
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if line.startswith("#EXTINF"):
                # Parse #EXTINF:-1 tvg-id="..." tvg-logo="..." group-title="..." ,Title
                meta = {}
                m = re.search(r'tvg-logo="([^"]+)"', line)
                if m: meta["thumbnail"] = m.group(1)
                m = re.search(r'group-title="([^"]+)"', line)
                if m: meta["group"] = m.group(1)
                m = re.search(r',(.+)$', line)
                title = m.group(1).strip() if m else "Unknown"
                m = re.search(r'#EXTINF:(-?\d+(?:\.\d+)?)', line)
                dur = float(m.group(1)) if m and m.group(1) != "-1" else None
                # Next non-empty line is the URL
                j = i + 1
                while j < len(lines) and not lines[j].strip():
                    j += 1
                if j < len(lines) and lines[j].strip().startswith("http"):
                    items.append({"title": title, "url": lines[j].strip(),
                                  "duration": dur, **meta})
                    i = j + 1
                    continue
            i += 1
        result = {"type": "m3u", "title": req.url.split("/")[-1].split("?")[0],
                  "count": len(items), "items": items[:2000]}
        if items:
            await _cache_set(ck, result, ttl=900)
        return result

    # ── RSS / Atom ─────────────────────────────────────────────────────────────
    async with _client() as c:
        r = await c.get(req.url, timeout=30)
        r.raise_for_status()

    import xml.etree.ElementTree as ET
    try:
        root = ET.fromstring(r.content)
    except ET.ParseError as e:
        raise HTTPException(400, f"Invalid XML/RSS feed: {str(e)[:200]}")

    NS = {"atom": "http://www.w3.org/2005/Atom",
          "media": "http://search.yahoo.com/mrss/",
          "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
          "content": "http://purl.org/rss/1.0/modules/content/"}

    def _txt(el, *tags):
        for t in tags:
            sub = el.find(t)
            if sub is not None and sub.text: return sub.text.strip()
        return ""

    def _attr(el, tag, attr):
        sub = el.find(tag)
        return sub.get(attr, "") if sub is not None else ""

    items = []
    feed_title = ""
    is_atom = root.tag.endswith("}feed") or root.tag == "feed"

    if is_atom:
        feed_title = _txt(root, "title", "{http://www.w3.org/2005/Atom}title")
        for entry in root.findall(".//{http://www.w3.org/2005/Atom}entry") or root.findall(".//entry"):
            title = _txt(entry, "{http://www.w3.org/2005/Atom}title", "title")
            # Find media URL: link[rel=enclosure] or media:content
            media_url = ""
            for link in entry.findall("{http://www.w3.org/2005/Atom}link") + entry.findall("link"):
                rel = link.get("rel","")
                if rel in ("enclosure","alternate") or link.get("type","").startswith(("audio/","video/")):
                    media_url = link.get("href") or link.get("url") or ""
                    if media_url: break
            if not media_url:
                media_url = _attr(entry, "link", "href") or _txt(entry, "{http://www.w3.org/2005/Atom}id","id")
            thumb = ""
            mc = entry.find("{http://search.yahoo.com/mrss/}content")
            if mc is not None: thumb = mc.get("url","")
            if not thumb:
                mt = entry.find("{http://search.yahoo.com/mrss/}thumbnail")
                if mt is not None: thumb = mt.get("url","")
            pub = _txt(entry, "{http://www.w3.org/2005/Atom}updated",
                       "{http://www.w3.org/2005/Atom}published", "updated", "published")
            desc = _txt(entry, "{http://www.w3.org/2005/Atom}summary", "summary",
                        "{http://www.w3.org/2005/Atom}content")
            dur_s = _txt(entry, "{http://www.itunes.com/dtds/podcast-1.0.dtd}duration")
            if title or media_url:
                items.append({"title": title, "url": media_url, "thumbnail": thumb or None,
                              "description": desc[:300] if desc else None,
                              "pub_date": pub or None, "duration_str": dur_s or None})
    else:
        # RSS 2.0
        channel = root.find("channel") or root
        feed_title = _txt(channel, "title")
        for item in root.findall(".//item"):
            title = _txt(item, "title")
            # Prefer <enclosure> for media
            enc = item.find("enclosure")
            media_url = (enc.get("url","") if enc is not None else "") or _txt(item, "link")
            thumb = ""
            mc = item.find("{http://search.yahoo.com/mrss/}content")
            if mc is not None: thumb = mc.get("url","")
            if not thumb:
                mt = item.find("{http://search.yahoo.com/mrss/}thumbnail")
                if mt is not None: thumb = mt.get("url","")
            if not thumb:
                # Extract first image from description
                desc_html = _txt(item, "description", "{http://purl.org/rss/1.0/modules/content/}encoded")
                im = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', desc_html or "", re.I)
                if im: thumb = im.group(1)
            pub = _txt(item, "pubDate", "dc:date")
            desc = _txt(item, "description")
            dur_s = _txt(item, "{http://www.itunes.com/dtds/podcast-1.0.dtd}duration")
            enc_type = enc.get("type","") if enc is not None else ""
            if title or media_url:
                items.append({"title": title, "url": media_url, "thumbnail": thumb or None,
                              "description": re.sub(r'<[^>]+>', '', desc)[:300] if desc else None,
                              "pub_date": pub or None, "duration_str": dur_s or None,
                              "enclosure_type": enc_type or None})

    result = {"type": "rss" if not is_atom else "atom",
              "feed_title": feed_title, "feed_url": req.url,
              "count": len(items), "items": items[:500]}
    if items:
        await _cache_set(ck, result, ttl=900)
    return result


# ── /batch — start multiple downloads concurrently ────────────────────────────
class BatchItem(BaseModel):
    url:             str
    job_id:          str
    media_type:      Literal["video","image","page","playlist","profile","file","torrent"] = "video"
    format:          str           = "mp4"
    quality:         Optional[str] = "best"
    max_items:       Optional[int] = None
    start_index:     int           = 1
    subtitles:       bool          = False
    embed_thumbnail: bool          = False
    embed_metadata:  bool          = True
    cookies:         Optional[str] = None
    proxy:           Optional[str] = None
    start_time:      Optional[str] = None
    end_time:        Optional[str] = None
    sponsor_block:   bool          = False
    normalize_audio: bool          = False
    speed_limit:     Optional[str] = None
    concurrent_fragments: int      = 16

class BatchReq(BaseModel):
    items: list[BatchItem]

@app.post("/batch")
async def batch_download(req: BatchReq):
    """Start up to MAX_CONCURRENT downloads in parallel. Returns per-item status immediately
    after each item finishes (not streaming — waits for all). For fire-and-forget batch
    jobs, callers should poll progress by job_id as usual."""
    if not req.items:
        raise HTTPException(400, "No items provided")
    if len(req.items) > 50:
        raise HTTPException(400, "Maximum 50 items per batch request")

    async def _run_one(item: BatchItem) -> dict:
        dr = DownloadReq(
            url=item.url, job_id=item.job_id, media_type=item.media_type,
            format=item.format, quality=item.quality, max_items=item.max_items,
            start_index=item.start_index, subtitles=item.subtitles,
            embed_thumbnail=item.embed_thumbnail, embed_metadata=item.embed_metadata,
            cookies=item.cookies, proxy=item.proxy,
            start_time=item.start_time, end_time=item.end_time,
            sponsor_block=item.sponsor_block, normalize_audio=item.normalize_audio,
            speed_limit=item.speed_limit, concurrent_fragments=item.concurrent_fragments,
        )
        job_dir = DOWNLOAD_DIR / item.job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        try:
            async with _sem:
                cookie_file = None
                try:
                    if item.cookies:
                        cookie_file = _write_cookies(item.cookies)
                    if item.media_type in ("playlist","profile"):
                        await _dl_playlist(dr, job_dir, cookie_file)
                    elif item.media_type == "video":
                        await _dl_video(dr, job_dir, cookie_file)
                    elif item.media_type == "image":
                        await _dl_image(dr, job_dir)
                    elif item.media_type == "file":
                        await _dl_file(dr, job_dir)
                    else:
                        await _dl_page(dr, job_dir, cookie_file)
                    files = [f.name for f in job_dir.iterdir() if f.is_file()] if job_dir.exists() else []
                    return {"job_id": item.job_id, "url": item.url, "success": True, "files": files}
                except Exception as e:
                    msg = str(e)[:300]
                    await _prog(item.job_id, {"status": "failed", "progress": 0, "error": msg})
                    return {"job_id": item.job_id, "url": item.url, "success": False, "error": msg}
                finally:
                    if cookie_file: _rm(cookie_file)
        except Exception as e:
            return {"job_id": item.job_id, "url": item.url, "success": False, "error": str(e)[:300]}

    results = await asyncio.gather(*(_run_one(item) for item in req.items))
    ok = sum(1 for r in results if r.get("success"))
    return {"total": len(results), "succeeded": ok, "failed": len(results) - ok, "results": list(results)}


# ── /convert — FFmpeg re-encode / format conversion of a downloaded file ──────
class ConvertReq(BaseModel):
    job_id:           str
    filename:         str
    output_format:    str                      # e.g. "mp4", "mp3", "webm", "gif"
    new_job_id:       Optional[str]  = None    # write output here (defaults to job_id)
    # Video options
    video_codec:      Optional[str]  = None    # "libx264","libx265","libvpx-vp9","copy"
    resolution:       Optional[str]  = None    # "1280x720","1920x1080","640x360"
    crf:              Optional[int]  = None    # 18-28; lower=better quality
    fps:              Optional[int]  = None    # output frame rate
    # Audio options
    audio_codec:      Optional[str]  = None    # "aac","libmp3lame","libopus","copy"
    audio_bitrate:    Optional[str]  = None    # "128k","192k","320k"
    extract_audio:    bool           = False   # discard video track
    # GIF options
    gif_fps:          int            = 10
    gif_scale:        int            = 480
    # Clip
    start_time:       Optional[str]  = None
    end_time:         Optional[str]  = None

@app.post("/convert")
async def convert_file(req: ConvertReq):
    """Re-encode / convert a file that already lives in DOWNLOAD_DIR.
    Supports video ↔ video, video → audio, video → GIF, audio → audio."""
    # Validate path stays inside DOWNLOAD_DIR
    if not re.match(r'^[0-9a-f\-]{36}$', req.job_id):
        raise HTTPException(400, "Invalid job_id")
    safe_name = Path(req.filename).name
    src = DOWNLOAD_DIR / req.job_id / safe_name
    if not src.exists():
        raise HTTPException(404, f"File not found: {req.filename}")

    out_job_id = req.new_job_id or req.job_id
    if req.new_job_id:
        if not re.match(r'^[0-9a-f\-]{36}$', req.new_job_id):
            raise HTTPException(400, "Invalid new_job_id")
        out_dir = DOWNLOAD_DIR / req.new_job_id
        out_dir.mkdir(parents=True, exist_ok=True)
    else:
        out_dir = DOWNLOAD_DIR / req.job_id

    fmt = req.output_format.lower().lstrip(".")
    stem = Path(safe_name).stem
    out = _uniq(out_dir, f"{stem}_converted.{fmt}")

    await _prog(out_job_id, {"status": "converting", "progress": 5,
                              "filename": f"Converting {safe_name} → {fmt}…"})

    # Build FFmpeg command
    cmd = ["ffmpeg", "-y", "-i", str(src)]

    if req.start_time:
        cmd += ["-ss", req.start_time]
    if req.end_time:
        cmd += ["-to", req.end_time]

    if fmt == "gif":
        # Two-pass GIF with palette for quality
        scale = req.gif_scale or 480
        fps   = req.gif_fps or 10
        palette = out_dir / f"{stem}_palette.png"
        p1 = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", str(src),
            "-vf", f"fps={fps},scale={scale}:-1:flags=lanczos,palettegen",
            str(palette), stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
        await p1.wait()
        cmd += ["-i", str(palette), "-lavfi",
                f"fps={fps},scale={scale}:-1:flags=lanczos[x];[x][1:v]paletteuse",
                "-loop", "0"]
    elif req.extract_audio:
        vcodec = "none"
        acodec = req.audio_codec or ("libmp3lame" if fmt == "mp3" else "aac")
        cmd += ["-vn", "-acodec", acodec]
        if req.audio_bitrate:
            cmd += ["-b:a", req.audio_bitrate]
    else:
        if req.video_codec:
            cmd += ["-c:v", req.video_codec]
        elif fmt in ("mp4", "mov"):
            cmd += ["-c:v", "libx264", "-preset", "veryfast"]
        elif fmt == "webm":
            cmd += ["-c:v", "libvpx-vp9", "-crf", str(req.crf or 33), "-b:v", "0"]
        elif fmt == "mkv":
            cmd += ["-c:v", "copy"]

        if req.crf and fmt != "webm":
            cmd += ["-crf", str(req.crf)]
        if req.resolution:
            w, h = req.resolution.replace("x", ":").split(":")
            cmd += ["-vf", f"scale={w}:{h}"]
        if req.fps:
            cmd += ["-r", str(req.fps)]
        if req.audio_codec:
            cmd += ["-c:a", req.audio_codec]
        elif fmt in ("mp4", "mov"):
            cmd += ["-c:a", "aac"]
        if req.audio_bitrate:
            cmd += ["-b:a", req.audio_bitrate]
        if fmt in ("mp4", "mov"):
            cmd += ["-movflags", "+faststart"]

    cmd.append(str(out))

    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)

    dur_re  = re.compile(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)")
    time_re = re.compile(r"time=(\d+):(\d+):(\d+\.?\d*)")
    total_s: Optional[float] = None

    async for raw in proc.stderr:  # type: ignore
        line = raw.decode("utf-8", "ignore")
        if total_s is None:
            m = dur_re.search(line)
            if m: total_s = _hms(*m.groups())
        m = time_re.search(line)
        if m and total_s and total_s > 0:
            pct = min(94, int(_hms(*m.groups()) / total_s * 90))
            await _prog(out_job_id, {"status": "converting", "progress": 5 + pct,
                                      "filename": f"Converting → {fmt}…"})

    await proc.wait()

    # Cleanup palette if GIF
    if fmt == "gif":
        palette = out_dir / f"{stem}_palette.png"
        try: palette.unlink()
        except Exception: pass

    if proc.returncode != 0 or not out.exists() or out.stat().st_size < 512:
        raise HTTPException(500, f"FFmpeg conversion failed (exit {proc.returncode})")

    files = [f.name for f in out_dir.iterdir() if f.is_file()]
    await _prog(out_job_id, {"status": "completed", "progress": 100, "files": files})
    return {"success": True, "output_file": out.name, "output_job_id": out_job_id,
            "size": out.stat().st_size}


# ── /merge — merge separate audio + video files (or concatenate) ─────────────
class MergeReq(BaseModel):
    job_id:          str
    video_file:      str
    audio_file:      str
    output_filename: Optional[str] = None
    output_format:   str           = "mp4"

@app.post("/merge")
async def merge_files(req: MergeReq):
    """Merge a separate video file and audio file into one container."""
    if not re.match(r'^[0-9a-f\-]{36}$', req.job_id):
        raise HTTPException(400, "Invalid job_id")
    job_dir = DOWNLOAD_DIR / req.job_id
    v_src = job_dir / Path(req.video_file).name
    a_src = job_dir / Path(req.audio_file).name
    if not v_src.exists(): raise HTTPException(404, f"Video file not found: {req.video_file}")
    if not a_src.exists(): raise HTTPException(404, f"Audio file not found: {req.audio_file}")

    fmt = req.output_format.lower().lstrip(".")
    out_name = req.output_filename or f"{v_src.stem}_merged.{fmt}"
    out = _uniq(job_dir, _safe(out_name))

    await _prog(req.job_id, {"status": "processing", "progress": 10, "filename": "Merging streams…"})

    cmd = ["ffmpeg", "-y", "-i", str(v_src), "-i", str(a_src),
           "-c:v", "copy", "-c:a", "aac",
           "-map", "0:v:0", "-map", "1:a:0",
           "-movflags", "+faststart", str(out)]

    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
    await proc.wait()

    if proc.returncode != 0 or not out.exists():
        raise HTTPException(500, "FFmpeg merge failed")

    files = [f.name for f in job_dir.iterdir() if f.is_file()]
    await _prog(req.job_id, {"status": "completed", "progress": 100, "files": files})
    return {"success": True, "output_file": out.name, "size": out.stat().st_size}


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _client(proxy: Optional[str] = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        follow_redirects=True, http2=True, verify=VERIFY_SSL,
        headers={**_BASE_HDR,"User-Agent":_ua()},
        timeout=httpx.Timeout(90, connect=20),
        limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
        proxy=proxy or None,
    )

def _write_cookies(cookies_text: str) -> str:
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
    # If not Netscape format, auto-convert header cookie string
    if not cookies_text.strip().startswith("#"):
        f.write("# Netscape HTTP Cookie File\n")
        for part in cookies_text.split(";"):
            kv = part.strip()
            if "=" in kv:
                k,v = kv.split("=",1)
                f.write(f".generic.domain\tTRUE\t/\tFALSE\t0\t{k.strip()}\t{v.strip()}\n")
    else:
        f.write(cookies_text)
    f.close()
    return f.name

def _rm(p: str):
    try: os.unlink(p)
    except Exception: pass

def _detect_stream(url: str) -> Optional[dict]:
    lo = url.lower().split("?")[0]
    is_hls  = lo.endswith(".m3u8") or "/hls/" in lo or "playlist.m3u8" in lo
    is_dash = lo.endswith(".mpd")  or "/dash/" in lo
    is_ts   = lo.endswith(".ts")
    if is_hls or is_dash or is_ts:
        return {"type":"video","title":_url_title(url),"thumbnail":None,"duration":None,
                "uploader":"","extractor":"hls" if is_hls else "dash" if is_dash else "direct",
                "qualities":[],"video_formats":["mp4","mkv","ts"],"is_stream":True}
    return None

def _scrape_imgs(soup: BeautifulSoup, base: str) -> list[str]:
    found: list[str] = []
    for tag in soup.find_all("img"):
        for attr in ("src","data-src","data-original","data-lazy-src","data-srcset","data-lazy","data-hi-res","data-full-url"):
            v = tag.get(attr,"")
            for u in _split_srcset(v): found.append(_abs(u,base))
    for tag in soup.find_all("source"):
        for u in _split_srcset(tag.get("srcset","") or tag.get("data-srcset","")): found.append(_abs(u,base))
    style_re = re.compile(r'url\(\s*["\']?(https?://[^"\')\s]{4,})["\']?\s*\)')
    for tag in soup.find_all(True):
        for u in style_re.findall(tag.get("style","")): found.append(u)
    for tag in soup.find_all("meta", attrs={"property":re.compile(r"og:image|twitter:image")}):
        v = tag.get("content","")
        if v.startswith("http"): found.append(v)
    for tag in soup.find_all("a", href=True):
        href = tag["href"]
        if re.search(r'\.(jpe?g|png|gif|webp|svg|bmp|tiff?)(\?|$)',href,re.I): found.append(_abs(href,base))
    return [u for u in found if u.startswith("http")]

def _next_pages(soup: BeautifulSoup, base: str) -> list[str]:
    pages=[]
    for tag in soup.find_all("a",href=True):
        text=(tag.get_text() or "").strip().lower(); rel=str(tag.get("rel",""))
        if "next" in text or "next" in rel or "›" in text or "»" in text or "load more" in text:
            u=_abs(tag["href"],base)
            if u.startswith("http") and u!=base: pages.append(u)
    return pages

def _split_srcset(s: str) -> list[str]:
    if not s: return []
    parts=[]
    for chunk in s.split(","):
        url=chunk.strip().split()[0]
        if url and (url.startswith("http") or url.startswith("/")): parts.append(url)
    return parts

def _pil_convert(data:bytes, out_dir:Path, stem:str, target:str)->str:
    pil_map={"jpg":"JPEG","jpeg":"JPEG","png":"PNG","webp":"WEBP","avif":"AVIF","bmp":"BMP","tiff":"TIFF"}
    pil_fmt=pil_map.get(target,"JPEG")
    img=Image.open(io.BytesIO(data))
    if pil_fmt in ("JPEG","BMP") and img.mode in ("RGBA","LA","P"):
        bg=Image.new("RGB",img.size,(255,255,255))
        if img.mode=="P": img=img.convert("RGBA")
        mask=img.split()[-1] if img.mode in ("RGBA","LA") else None
        bg.paste(img,mask=mask); img=bg
    elif img.mode=="P" and pil_fmt=="PNG": img=img.convert("RGBA")
    elif img.mode not in ("RGB","RGBA","L","LA") and pil_fmt!="PNG": img=img.convert("RGB")
    ext="jpg" if target=="jpeg" else target
    path=_uniq(out_dir,f"{stem}.{ext}")
    kw={}
    if pil_fmt=="JPEG": kw={"quality":93,"optimize":True,"progressive":True}
    elif pil_fmt=="WEBP": kw={"quality":90,"method":6}
    elif pil_fmt=="PNG": kw={"optimize":True}
    img.save(str(path),format=pil_fmt,**kw)
    return path.name

def _ct_ext(ct:str)->str:
    return {"image/jpeg":"jpg","image/jpg":"jpg","image/png":"png","image/gif":"gif",
            "image/webp":"webp","image/bmp":"bmp","image/tiff":"tiff",
            "image/svg+xml":"svg","image/avif":"avif"}.get(ct,"jpg")

def _safe(n:str)->str: return re.sub(r'[\\/:*?"<>|]',"_",n)[:200]
def _uniq(d:Path,n:str)->Path:
    p=d/n; stem,suf=Path(n).stem,Path(n).suffix; i=1
    while p.exists(): p=d/f"{stem}_{i}{suf}"; i+=1
    return p
def _abs(url:str,base:str)->str:
    if url.startswith("http"): return url
    if url.startswith("//"): return "https:"+url
    return urljoin(base,url)
def _origin(url:str)->str:
    p=urlparse(url); return f"{p.scheme}://{p.netloc}"
def _url_title(url:str)->str: return urlparse(url).path.split("/")[-1].split("?")[0] or "stream"
def _hms(h,m,s)->float: return float(h)*3600+float(m)*60+float(s)
