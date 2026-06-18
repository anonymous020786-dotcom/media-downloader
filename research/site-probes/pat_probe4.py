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

        # Check what the 500 errors say
        print("=== 500 error bodies ===")
        for url in [
            "https://store.externulls.com/videos/0252924980226239",
            "https://vp-handler.externulls.com/v1/preview/0252924980226239",
        ]:
            r = await c.get(url, timeout=10)
            print(f"{url}")
            print(f"  {r.status_code}: {r.text[:400]}")
            print(f"  Headers: {dict(r.headers)}")
            print()

        # Check the JS for how the token/auth is passed
        r2 = await c.get(f"{BASE}/dist/main.c50008cf.js")
        js = r2.text

        print("=== auth/token patterns ===")
        for m in re.finditer(r'(?:Authorization|Bearer|token|auth|session|cookie)[^;`"\n]{0,80}', js, re.I):
            s = m.group()
            if len(s) > 15 and any(k in s.lower() for k in ['auth','bearer','token','header']):
                print(" ", s[:150])

        print("\n=== withCredentials / cookies ===")
        for m in re.finditer(r'withCredentials|credentials["\s:]+["\`]include', js, re.I):
            print(" ", js[max(0,m.start()-60):m.end()+60])

        # Try with a session cookie — first get session from pat.com
        print("\n=== Getting pat.com cookies ===")
        r3 = await c.get(f"{BASE}/-{VIDEO_ID}")
        print("Cookies:", dict(c.cookies))

        # Now try the API with cookies
        print("\n=== API with cookies ===")
        for url in [
            f"https://store.externulls.com/videos/{VIDEO_ID}",
            f"https://vp-handler.externulls.com/v1/preview/{VIDEO_ID}?start=0&end=10",
        ]:
            r = await c.get(url, timeout=10)
            print(f"  {r.status_code}: {r.text[:400]}")

asyncio.run(fetch())
