import httpx, asyncio, re

VIDEO_ID = "0252924980226239"
FILE_ID = "252924980226239"
BASE = "https://pat.com"

async def fetch():
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36"
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as c:

        # Try embed URLs
        print("=== embed paths ===")
        for url in [
            f"https://pat.com/embed/0/{FILE_ID}",
            f"https://pat.com/embed/0/-{VIDEO_ID}",
            f"https://pat.com/embed/0/{VIDEO_ID}",
            f"https://pat.com/embed/{FILE_ID}",
        ]:
            r = await c.get(url, headers={"User-Agent": ua})
            ct = r.headers.get("content-type","")
            print(f"  {r.status_code} [{ct[:50]}]  {url}")
            if r.status_code == 200 and "html" in ct:
                # Look for video URLs in embed page
                vids = re.findall(r'https?://[^\s"\'<>]{5,120}(?:mp4|m3u8|video)[^\s"\'<>]{0,60}', r.text, re.I)
                if vids:
                    print("   VIDEO URLs:", vids[:5])

        # Check if auth uses httpOnly cookie (try /api/auth/session or similar)
        print("\n=== auth endpoint probe ===")
        for url in [
            "https://auth.externulls.com/login/",
            "https://auth.externulls.com/",
            "https://auth.externulls.com/v1/",
            "https://store.externulls.com/",
        ]:
            r = await c.get(url, headers={"User-Agent": ua, "Accept": "application/json"}, timeout=8)
            ct = r.headers.get("content-type","")
            print(f"  {r.status_code} [{ct[:50]}]  {url}")
            if r.status_code < 500:
                print("   Body:", r.text[:300])

        # Find where the token is stored in JS
        r2 = await c.get(f"{BASE}/dist/main.c50008cf.js", headers={"User-Agent": ua})
        js = r2.text
        print("\n=== token storage mechanism ===")
        idx = js.find("M8)(")
        if idx >= 0:
            print("Token setter context:", js[max(0,idx-200):idx+200])

        print("\n=== where token is read (hP function) ===")
        idx2 = js.find(",hP:")
        if idx2 < 0:
            idx2 = js.find(" hP=")
        if idx2 < 0:
            # search for Bearer usage context
            idx2 = js.find("Bearer ${")
        if idx2 >= 0:
            print(js[max(0,idx2-300):idx2+300])

asyncio.run(fetch())
