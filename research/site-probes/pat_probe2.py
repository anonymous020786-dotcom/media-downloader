import httpx, asyncio, re

VIDEO_ID = "0252924980226239"
BASE = "https://pat.com"

async def fetch():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
        "Referer": f"{BASE}/-{VIDEO_ID}",
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=30) as c:
        r = await c.get(f"{BASE}/dist/main.c50008cf.js")
        js = r.text

        # look for fetch( or axios( calls and surrounding context
        print("=== fetch/axios calls (context) ===")
        for m in re.finditer(r'(?:fetch|axios)\s*\(\s*[`"\'][^`"\']{5,120}[`"\']', js, re.I):
            print(" ", m.group()[:150])

        print("\n=== URL template literals with IDs ===")
        for m in re.finditer(r'`[^`]{0,40}\$\{[^}]{1,40}\}[^`]{0,60}`', js):
            s = m.group()
            if any(k in s.lower() for k in ['post','video','user','media','content','watch','play']):
                print(" ", s[:160])

        print("\n=== strings containing 'post' or 'video' (20 chars context) ===")
        seen = set()
        for m in re.finditer(r'["\`][^"\`\n]{0,20}(?:post|video|media|content)[^"\`\n]{0,40}["\`]', js, re.I):
            v = m.group()
            if v not in seen:
                seen.add(v)
                print(" ", v[:120])
            if len(seen) > 40:
                break

        print("\n=== Long strings (possible CDN/API base URLs) ===")
        seen2 = set()
        for m in re.finditer(r'["\`]https?://[^"\`\s]{10,100}["\`]', js):
            v = m.group()
            if v not in seen2:
                seen2.add(v)
                print(" ", v[:150])
            if len(seen2) > 30:
                break

asyncio.run(fetch())
