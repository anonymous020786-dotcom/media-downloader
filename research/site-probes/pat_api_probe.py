"""
Find the API endpoint that returns the signed CDN URL for a pat.com video.
Key: the CDN file_id (431704237039969) differs from the URL slug (0252924980226239).
The API must map slug → CDN URL.
"""
import httpx, asyncio, re

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36"

# A captured signed-CDN token went here during probing (now scrubbed — these
# tokens are short-lived/expired). Paste a fresh one from the network tab to re-run.
KEY_TOKEN = "REDACTED_SIGNED_TOKEN,end=0000000000,limit=3"
DATA = "REDACTED_DATA"
CDN_FILE_ID = "431704237039969"  # from the URL
PAT_SLUG = "0252924980226239"    # from the original pat.com URL
FILE_ID = "252924980226239"      # slug without leading type digit

async def probe():
    headers = {
        "User-Agent": UA,
        "Origin": "https://pat.com",
        "Referer": f"https://pat.com/-{PAT_SLUG}",
        "Accept": "application/json, */*",
    }
    async with httpx.AsyncClient(follow_redirects=False, timeout=15, verify=False) as c:

        # 1. What does video.pat.com/{slug_id} return? (auth required but check response type)
        print("=== video.pat.com direct access ===")
        for fid in [FILE_ID, PAT_SLUG, CDN_FILE_ID]:
            r = await c.get(f"https://video.pat.com/{fid}", headers=headers)
            print(f"  [{r.status_code}] {r.headers.get('content-type','')} {r.headers.get('content-length','?')}B  -> /{fid}")
            if r.status_code in (301, 302, 307, 308):
                print(f"  Location: {r.headers.get('location','')[:200]}")
            if r.status_code == 200:
                print(f"  Body: {r.text[:200]}")

        # 2. Try the HLS manifest paths with the signed token
        # The m3u8 is probably at the media=hls4A level
        print("\n=== HLS manifest paths (with real token) ===")
        cdn_base = f"https://video.pat.com/key={KEY_TOKEN}/data={DATA}/media=hls4A"
        # Try known HLS manifest names
        for path in [
            "index.m3u8", "master.m3u8", "playlist.m3u8", "prog_index.m3u8",
            f"{CDN_FILE_ID}.mp4/index.m3u8",
            f"{CDN_FILE_ID}.mp4/master.m3u8",
            f"{CDN_FILE_ID}.mp4/prog_index.m3u8",
            # Try without quality subfolder
            f"av1_360p/{CDN_FILE_ID}.mp4/index.m3u8",
            f"av1_360p/{CDN_FILE_ID}.mp4/prog_index.m3u8",
            # Maybe it's at a top level
            f"av1_360p/index.m3u8",
        ]:
            url = f"{cdn_base}/{path}"
            r = await c.get(url, headers={**headers, "Accept": "*/*"}, timeout=8)
            ct = r.headers.get("content-type","")
            cl = r.headers.get("content-length","?")
            short_url = url.replace(f"key={KEY_TOKEN}/data={DATA}", "<auth>")
            print(f"  [{r.status_code}] {ct[:40]} {cl}B  {short_url}")
            if r.status_code == 200 and "m3u8" in (ct + url):
                print(f"  Content: {r.text[:500]}")

        # 3. Try the store API with the CDN file ID
        print("\n=== store.externulls.com with CDN file ID ===")
        for path in [
            f"/videos/{CDN_FILE_ID}",
            f"/v1/videos/{CDN_FILE_ID}",
            f"/v1/files/{CDN_FILE_ID}",
            f"/files/{CDN_FILE_ID}",
            f"/v1/content/{CDN_FILE_ID}",
            f"/v1/media/{CDN_FILE_ID}",
        ]:
            r = await c.get(f"https://store.externulls.com{path}", headers=headers)
            ct = r.headers.get("content-type","")
            print(f"  [{r.status_code}] {ct[:40]}  {path}")
            if r.status_code == 200 and "json" in ct:
                print(f"  Body: {r.text[:400]}")

        # 4. Look at the JS bundle for how video src is built
        print("\n=== JS bundle: video URL construction ===")
        r = await c.get("https://pat.com/dist/main.c50008cf.js",
            headers={"User-Agent": UA}, follow_redirects=True)
        js = r.text
        # Find patterns around 'hls', 'key=', 'data=', 'media='
        print("-- hls patterns --")
        for m in re.finditer(r'.{0,80}(?:hls4|media=|key=|data=|limit=).{0,80}', js, re.I):
            s = m.group().strip()
            if len(s) > 20:
                print(f"  {s[:200]}")

        print("\n-- video stream endpoint construction --")
        for m in re.finditer(r'.{0,60}(?:videoSrc|inlineVideoSrc|stream_url|streamUrl|cdn_url|cdnUrl|hlsUrl|hls_url|\.src\s*[=+]).{0,100}', js, re.I):
            print(f"  {m.group()[:250]}")

asyncio.run(probe())
