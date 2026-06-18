import httpx, asyncio, re, json

VIDEO_ID = "0252924980226239"
FILE_ID = "252924980226239"
BASE = "https://pat.com"

async def fetch():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
        "Referer": f"{BASE}/-{VIDEO_ID}",
        "Origin": BASE,
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=30) as c:

        # Check vp-handler preview response headers + binary content
        print("=== vp-handler /v1/preview detailed ===")
        url = f"https://vp-handler.externulls.com/v1/preview/{VIDEO_ID}?start=0&end=10"
        r = await c.get(url, timeout=15)
        print(f"Status: {r.status_code}")
        print("Response headers:")
        for k, v in r.headers.items():
            print(f"  {k}: {v}")
        print(f"Content length: {len(r.content)} bytes")
        if r.content:
            print(f"First 32 bytes hex: {r.content[:32].hex()}")

        # Also check what the JS says about the preview URL format
        r2 = await c.get(f"{BASE}/dist/main.c50008cf.js")
        js = r2.text

        # Find exact usage of VPHandler/preview
        print("\n=== VPHandler/preview exact context ===")
        idx = js.find("VPHandler}/v1/preview")
        if idx >= 0:
            print(js[max(0,idx-300):idx+300])

        # Find the videos endpoint usage with more context
        print("\n=== api.endpoints.videos context ===")
        idx2 = js.find("endpoints.videos}")
        if idx2 >= 0:
            print(js[max(0,idx2-200):idx2+200])

        # Look for file metadata fetch - how does the player get video src?
        print("\n=== video source / player init ===")
        for m in re.finditer(r'.{0,100}(?:videoSrc|inlineVideoSrc|\.src\s*=|\.source\s*=).{0,100}', js, re.I):
            print(" ", m.group()[:250])
            print()

        # Look for how auth token is stored (localStorage key)
        print("=== localStorage token key ===")
        for m in re.finditer(r'localStorage\.(?:get|set)Item\(["\`][^"\`]{1,50}["\`]', js, re.I):
            print(" ", m.group())

asyncio.run(fetch())
