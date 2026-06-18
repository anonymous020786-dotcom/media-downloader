import httpx, asyncio, re, json

VIDEO_ID = "0252924980226239"
BASE = "https://pat.com"

async def fetch():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": f"{BASE}/-{VIDEO_ID}",
        "Origin": BASE,
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=30) as c:

        # 1. Get main JS bundle name
        r = await c.get(f"{BASE}/-{VIDEO_ID}")
        js_files = re.findall(r'/dist/main\.[a-f0-9]+\.js', r.text)
        print("JS bundles found:", js_files)

        if js_files:
            r2 = await c.get(f"{BASE}{js_files[0]}")
            js = r2.text
            print(f"JS bundle size: {len(js)} chars")

            # Find API endpoints
            api_routes = list(dict.fromkeys(re.findall(r'["`]/api/[^"`\s\)]{1,100}', js)))[:20]
            print("\n=== API routes ===")
            for x in api_routes: print(" ", x)

            # Find graphql
            gql = list(dict.fromkeys(re.findall(r'["`]graphql[^"`\s\)]{0,60}', js)))[:10]
            print("\n=== GraphQL ===")
            for x in gql: print(" ", x)

            # Find HLS/stream patterns
            stream = list(dict.fromkeys(re.findall(r'["`][^"`\s]{0,40}(?:m3u8|hls|manifest|stream|playlist)[^"`\s]{0,40}["`]', js, re.I)))[:10]
            print("\n=== Stream/HLS ===")
            for x in stream: print(" ", x)

            # Find video URL keys
            vkeys = list(dict.fromkeys(re.findall(r'(?:videoUrl|video_url|sourceUrl|source_url|streamUrl|stream_url|hlsUrl|hls_url|playUrl|play_url)["\s:]+["`][^"`]{1,120}', js, re.I)))[:10]
            print("\n=== Video URL keys ===")
            for x in vkeys: print(" ", x)

            # Find pat.com specific paths
            paths = list(dict.fromkeys(re.findall(r'["`]/[a-z_\-]{2,30}/[^"`\s\)]{1,60}["`]', js)))[:30]
            print("\n=== URL paths ===")
            for x in paths: print(" ", x)

            # Try common API patterns
            print("\n=== Trying common API endpoints ===")
            for endpoint in [
                f"/api/v1/video/{VIDEO_ID}",
                f"/api/video/{VIDEO_ID}",
                f"/api/post/{VIDEO_ID}",
                f"/api/posts/{VIDEO_ID}",
                f"/api/v1/post/{VIDEO_ID}",
                f"/api/v2/video/{VIDEO_ID}",
                f"/graphql",
            ]:
                try:
                    resp = await c.get(f"{BASE}{endpoint}", timeout=8)
                    ct = resp.headers.get("content-type", "")
                    print(f"  {endpoint} -> {resp.status_code} {ct[:50]}")
                    if resp.status_code == 200 and "json" in ct:
                        print("   ", resp.text[:300])
                except Exception as e:
                    print(f"  {endpoint} -> ERROR: {e}")

asyncio.run(fetch())
