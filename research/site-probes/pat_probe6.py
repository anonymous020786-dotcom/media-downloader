import httpx, asyncio, re, json

VIDEO_ID = "0252924980226239"
FILE_ID = "252924980226239"  # strip the -0 prefix
BASE = "https://pat.com"

async def fetch():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
        "Referer": f"{BASE}/-{VIDEO_ID}",
        "Origin": BASE,
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=30) as c:

        # Try file ID variations on video.pat.com
        print("=== video.pat.com with stripped file ID ===")
        for url in [
            f"https://video.pat.com/{FILE_ID}",
            f"https://video.pat.com/{FILE_ID}.mp4",
            f"https://video.pat.com/{FILE_ID}/index.m3u8",
            f"https://video.pat.com/0/{FILE_ID}",
            f"https://video.pat.com/-0/{FILE_ID}",
        ]:
            r = await c.get(url, timeout=10)
            ct = r.headers.get("content-type","")
            cl = r.headers.get("content-length","?")
            print(f"  {r.status_code} [{ct[:50]}] {cl}B  {url}")
            if r.status_code == 200:
                print("   Body:", r.text[:300] if "text" in ct else f"<binary {len(r.content)} bytes>")

        # Try vp-handler properly
        print("\n=== vp-handler variants ===")
        for url in [
            f"https://vp-handler.externulls.com/v1/preview/{FILE_ID}?start=0&end=10",
            f"https://vp-handler.externulls.com/v1/preview/{VIDEO_ID}?start=0&end=10",
            f"https://vp-handler.externulls.com/v1/video/{FILE_ID}",
            f"https://vp-handler.externulls.com/v1/info/{FILE_ID}",
            f"https://vp-handler.externulls.com/v1/url/{FILE_ID}",
        ]:
            r = await c.get(url, timeout=10)
            ct = r.headers.get("content-type","")
            print(f"  {r.status_code} [{ct[:50]}]  {url}")
            if r.status_code < 400:
                print("   Body:", r.text[:500])

        # Try previews.externulls.com
        print("\n=== previews.externulls.com ===")
        for url in [
            f"https://previews.externulls.com/{FILE_ID}",
            f"https://previews.externulls.com/{VIDEO_ID}",
            f"https://previews.externulls.com/{FILE_ID}.mp4",
        ]:
            r = await c.get(url, timeout=10)
            ct = r.headers.get("content-type","")
            cl = r.headers.get("content-length","?")
            print(f"  {r.status_code} [{ct[:50]}] {cl}B  {url}")
            if r.status_code < 400 or r.status_code == 302:
                print("   Body:", r.text[:300])
                print("   Location:", r.headers.get("location",""))

        # Try store.externulls.com with different paths
        print("\n=== store.externulls.com paths ===")
        for url in [
            f"https://store.externulls.com/v1/videos/{FILE_ID}",
            f"https://store.externulls.com/v1/posts/{FILE_ID}",
            f"https://store.externulls.com/v2/videos/{FILE_ID}",
            f"https://store.externulls.com/content/{FILE_ID}",
            f"https://store.externulls.com/media/{FILE_ID}",
        ]:
            r = await c.get(url, timeout=10)
            ct = r.headers.get("content-type","")
            print(f"  {r.status_code} [{ct[:50]}]  {url}")
            if r.status_code < 500:
                print("   Body:", r.text[:300])

asyncio.run(fetch())
