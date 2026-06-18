"""Check yt-dlp support + probe accessible sites more deeply."""
import httpx, asyncio, re, json, subprocess

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36"

# ── 1. Check which sites yt-dlp has extractors for ───────────────────────────
def ytdlp_extractors():
    r = subprocess.run(["yt-dlp", "--list-extractors"], capture_output=True, text=True)
    exts = r.stdout.lower()
    sites = ["pixeldrain","streamtape","doodstream","dood","erome","bunkr","cyberdrop",
             "mixdrop","gofile","kwik","streamlare","beeg","thisvid","spankbang",
             "xvideos","pornhub","xhamster","redgifs","imgur","rule34","gelbooru",
             "danbooru","e621","furaffinity"]
    for s in sites:
        found = s in exts
        print(f"  {'✓' if found else '✗'} {s}")

print("=== yt-dlp extractor coverage ===")
ytdlp_extractors()

async def main():
    async with httpx.AsyncClient(follow_redirects=True, verify=False, timeout=15) as c:

        # GoFile POST account creation
        print("\n=== GoFile.io guest account ===")
        try:
            r = await c.post("https://api.gofile.io/accounts",
                headers={"User-Agent": UA, "Accept": "application/json", "Content-Type": "application/json"},
                json={}, timeout=10)
            print(f"[{r.status_code}] {r.text[:500]}")
        except Exception as e:
            print(f"ERROR: {e}")

        # GoFile with real album
        print("\n=== GoFile album contents ===")
        try:
            # Get guest token first
            r = await c.post("https://api.gofile.io/accounts",
                headers={"User-Agent": UA}, json={})
            token = r.json().get("data",{}).get("token") if r.status_code==200 else None
            print(f"Token: {token}")
            if token:
                # wt (website token) for gofile - it's hardcoded in their JS
                r2 = await c.get("https://gofile.io/dist/js/alljs.js",
                    headers={"User-Agent": UA})
                wts = re.findall(r'websiteToken\s*[=:]\s*["\']([^"\']{5,40})["\']', r2.text, re.I)
                print(f"Website tokens found: {wts[:5]}")
        except Exception as e:
            print(f"ERROR: {e}")

        # beeg.com - check if same externulls platform
        print("\n=== beeg.com platform check ===")
        try:
            r = await c.get("https://beeg.com", headers={"User-Agent": UA})
            js_files = re.findall(r'/dist/[^"\'<>]+\.js', r.text)[:5]
            print(f"JS files: {js_files}")
            print(f"Externulls refs: {'externulls' in r.text}")
            # check a JS bundle
            if js_files:
                r2 = await c.get(f"https://beeg.com{js_files[0]}", headers={"User-Agent": UA})
                ext_refs = re.findall(r'externulls\.com[^"\'<>\s]{0,80}', r2.text)[:10]
                scope = re.findall(r'projectScope["\s:]+["\`]([^"\'`]{1,30})["\`]', r2.text)[:3]
                print(f"Externulls refs in JS: {ext_refs[:5]}")
                print(f"Project scope: {scope}")
                video_cdn = re.findall(r'https://video\.[^"\'<>\s]{3,50}', r2.text)[:5]
                print(f"Video CDN: {video_cdn}")
        except Exception as e:
            print(f"ERROR: {e}")

        # Mixdrop - find the actual video URL extraction
        print("\n=== Mixdrop embed JS extraction ===")
        try:
            r = await c.get("https://mixdrop.sb/e/abc123",
                headers={"User-Agent": UA, "Referer": "https://mixdrop.sb/"})
            print(f"[{r.status_code}]")
            # Look for video URL patterns
            ddp = re.findall(r'(?:MDCore\.|videoUrl|src)["\s:=]+["\`]([^"\'`\s]{10,200})["\`]', r.text, re.I)
            scripts = re.findall(r'<script[^>]*>(.*?)</script>', r.text, re.DOTALL)
            eval_blocks = [s for s in scripts if 'eval' in s.lower() or 'p,a,c,k,e' in s.lower()]
            print(f"Video URL hints: {ddp[:5]}")
            print(f"Eval/packed blocks: {len(eval_blocks)}")
            if eval_blocks:
                print(f"First eval block (100c): {eval_blocks[0][:100]}")
        except Exception as e:
            print(f"ERROR: {e}")

        # Bunkr - find working domains + CDN structure
        print("\n=== Bunkr domain probe ===")
        for domain in ["bunkr.sk", "bunkr.si", "bunkr.ph", "bunkr.black", "bunkr.cr", "bunkr.fi"]:
            try:
                r = await c.get(f"https://{domain}/", headers={"User-Agent": UA}, timeout=6)
                print(f"  {domain}: [{r.status_code}] {r.url}")
            except Exception as e:
                print(f"  {domain}: {e}")

asyncio.run(main())
