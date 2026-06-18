import httpx, asyncio, re, json

VIDEO_ID = "0252924980226239"
BASE = "https://pat.com"

async def fetch():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
        "Referer": f"{BASE}/-{VIDEO_ID}",
        "Origin": BASE,
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=30) as c:

        # Get JS and look for video URL construction
        r = await c.get(f"{BASE}/dist/main.c50008cf.js")
        js = r.text

        # Find how video.pat.com URLs are constructed
        print("=== video.pat.com usage ===")
        for m in re.finditer(r'.{0,100}video\.pat\.com.{0,100}', js, re.I):
            print(" ", m.group()[:250])
            print()

        # Find store endpoint config
        print("=== store.externulls.com usage ===")
        for m in re.finditer(r'.{0,60}store\.externulls\.com.{0,60}', js, re.I):
            print(" ", m.group()[:200])

        # Find the videos endpoint path specifically
        print("\n=== videos endpoint path ===")
        for m in re.finditer(r'endpoints\.videos.{0,80}', js, re.I):
            print(" ", m.group()[:180])

        # Find video resolution/quality paths
        print("\n=== resolution/quality patterns ===")
        for m in re.finditer(r'(?:720|1080|480|360|hd|sd|quality|resolution).{0,60}(?:mp4|m3u8|video)', js, re.I):
            print(" ", m.group()[:150])

        # Check vp-handler more carefully
        print("\n=== VPHandler usage ===")
        for m in re.finditer(r'.{0,80}VPHandler.{0,80}', js, re.I):
            print(" ", m.group()[:250])

        # Find how video src is set
        print("\n=== video src assignment ===")
        for m in re.finditer(r'(?:src|source)["\s:]+.{0,20}(?:video|mp4|m3u8|stream).{0,60}', js, re.I):
            print(" ", m.group()[:150])

asyncio.run(fetch())
