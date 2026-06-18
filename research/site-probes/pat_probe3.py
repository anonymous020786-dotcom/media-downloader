import httpx, asyncio, re, json

VIDEO_ID = "0252924980226239"
BASE = "https://pat.com"

async def fetch():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
        "Referer": f"{BASE}/-{VIDEO_ID}",
        "Origin": BASE,
        "Accept": "application/json, */*",
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=30) as c:

        # Extract exact endpoint config from JS
        r = await c.get(f"{BASE}/dist/main.c50008cf.js")
        js = r.text

        # Find the config object that sets api.endpoints.*
        print("=== api.endpoints config ===")
        for m in re.finditer(r'api_endpoint[_a-z]+["\s:,]+["\`][^"\`\s]{5,120}["\`]', js, re.I):
            print(" ", m.group()[:150])

        # Find where videos endpoint is set
        print("\n=== externulls.com paths ===")
        for m in re.finditer(r'externulls\.com[^"\s\`]{0,80}', js, re.I):
            print(" ", m.group()[:120])

        # Try the API endpoints
        print("\n=== API probe ===")
        api_headers = {**headers,
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        }
        for url in [
            f"https://store.externulls.com/videos/{VIDEO_ID}",
            f"https://store.externulls.com/posts/{VIDEO_ID}",
            f"https://store.externulls.com/v1/videos/{VIDEO_ID}",
            f"https://vp.externulls.com/{VIDEO_ID}",
            f"https://vp-handler.externulls.com/v1/video/{VIDEO_ID}",
            f"https://vp-handler.externulls.com/v1/preview/{VIDEO_ID}",
            f"https://video.pat.com/{VIDEO_ID}",
            f"https://video.pat.com/{VIDEO_ID}/index.m3u8",
            f"https://video.pat.com/{VIDEO_ID}.mp4",
        ]:
            try:
                resp = await c.get(url, headers=api_headers, timeout=10)
                ct = resp.headers.get("content-type","")
                cl = resp.headers.get("content-length","?")
                print(f"  {resp.status_code} [{ct[:40]}] {cl}B  {url}")
                if resp.status_code < 400 and "json" in ct:
                    try:
                        print("   JSON:", json.dumps(resp.json(), indent=2)[:500])
                    except:
                        print("   Body:", resp.text[:300])
                elif resp.status_code < 400 and ("m3u8" in ct or "m3u8" in url or len(resp.text) < 500):
                    print("   Body:", resp.text[:300])
            except Exception as e:
                print(f"  ERR  {url}  -> {e}")

asyncio.run(fetch())
