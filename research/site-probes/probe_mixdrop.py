import httpx, asyncio, re

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36"

async def main():
    async with httpx.AsyncClient(follow_redirects=True, verify=False, timeout=15) as c:
        # Get the inc.js player file
        r = await c.get("https://mixdrop.sb/player/inc.js?v=2.0.2",
            headers={"User-Agent": UA, "Referer": "https://mixdrop.sb/"})
        print(f"inc.js [{r.status_code}] size={len(r.text)}")
        print(r.text[:3000])
        print("...")
        print(r.text[-1000:])

        print("\n\n=== Mixdrop API probe ===")
        for url in [
            "https://mixdrop.sb/api/player?v=test123",
            "https://mixdrop.sb/api/video?id=test123",
            "https://mixdrop.sb/api/source?id=test123",
            "https://mixdrop.sb/player?url=test123",
        ]:
            r2 = await c.get(url, headers={"User-Agent": UA, "Accept": "application/json",
                "Referer": "https://mixdrop.sb/"})
            print(f"  [{r2.status_code}] {r2.headers.get('content-type','')} {url}")
            if r2.status_code < 400:
                print(f"  {r2.text[:300]}")

asyncio.run(main())
