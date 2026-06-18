"""Probe the sites yt-dlp DOESN'T support."""
import httpx, asyncio, re

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36"
HDR = {"User-Agent": UA}

async def main():
    async with httpx.AsyncClient(follow_redirects=True, verify=False, timeout=15) as c:

        # ── PIXELDRAIN ────────────────────────────────────────────────────────
        print("=== PIXELDRAIN ===")
        try:
            # Known file: use a real pixeldrain link
            # Try info API
            r = await c.get("https://pixeldrain.com/api/file/abc123/info",
                headers={**HDR, "Accept": "application/json"})
            print(f"info API [{r.status_code}]: {r.text[:300]}")
            # direct download URL structure
            r2 = await c.head("https://pixeldrain.com/api/file/abc123?download",
                headers=HDR)
            print(f"download HEAD [{r2.status_code}]: {dict(r2.headers)}")
        except Exception as e: print(f"ERROR: {e}")

        # ── BUNKR ─────────────────────────────────────────────────────────────
        print("\n=== BUNKR ===")
        try:
            # Try a real bunkr album/video page structure
            r = await c.get("https://bunkr.sk/v/test-video",
                headers={**HDR, "Referer": "https://bunkr.sk/"})
            print(f"video page [{r.status_code}]")
            # Look for CDN URL patterns
            cdns = re.findall(r'https?://(?:cdn|i|media|files?)[^"\'<>\s]{0,80}(?:mp4|webm|m3u8)[^"\'<>\s]{0,30}', r.text, re.I)
            src_tags = re.findall(r'<source[^>]+src=["\']([^"\']+)["\']', r.text, re.I)
            meta_og = re.findall(r'og:(?:video|image)["\s]+content=["\']([^"\']+)["\']', r.text, re.I)
            dl_links = re.findall(r'href=["\']([^"\']{10,200}(?:download|cdn)[^"\']{0,80})["\']', r.text, re.I)
            print(f"  CDN URLs: {cdns[:5]}")
            print(f"  Source tags: {src_tags[:5]}")
            print(f"  OG meta: {meta_og[:5]}")
            print(f"  Download links: {dl_links[:5]}")
            # Try bunkr API
            r2 = await c.post("https://bunkr.sk/api/download",
                headers={**HDR, "Content-Type": "application/json", "Accept": "application/json"},
                json={"hash": "test"}, timeout=8)
            print(f"  API download [{r2.status_code}]: {r2.text[:200]}")
        except Exception as e: print(f"ERROR: {e}")

        # ── STREAMTAPE ────────────────────────────────────────────────────────
        print("\n=== STREAMTAPE ===")
        for domain in ["streamtape.com", "streamtape.cc", "streamtape.to", "streamta.pe"]:
            try:
                r = await c.get(f"https://{domain}/v/test123",
                    headers={**HDR, "Referer": f"https://{domain}/"}, timeout=8)
                print(f"  {domain} [{r.status_code}]")
                # Find the robotlink / get_video pattern
                robots = re.findall(r'(?:robotlink|get_video)[^"\'<>]{0,200}', r.text, re.I)
                print(f"  robotlink/get_video: {robots[:3]}")
                break
            except Exception as e:
                print(f"  {domain}: {e}")

        # ── DOODSTREAM ───────────────────────────────────────────────────────
        print("\n=== DOODSTREAM ===")
        for domain in ["dood.wf", "doodstream.com", "dood.cx", "dood.pm", "ds2play.com"]:
            try:
                r = await c.get(f"https://{domain}/d/test123",
                    headers={**HDR, "Referer": f"https://{domain}/"}, timeout=8)
                print(f"  {domain} [{r.status_code}]")
                if r.status_code == 200:
                    pass_md5 = re.findall(r'pass_md5[^"\'<>]{0,150}', r.text, re.I)
                    print(f"  pass_md5: {pass_md5[:3]}")
                    break
            except Exception as e:
                print(f"  {domain}: {e}")

        # ── EROME ─────────────────────────────────────────────────────────────
        print("\n=== EROME ===")
        for domain in ["www.erome.com", "erome.com"]:
            try:
                r = await c.get(f"https://{domain}/a/testalbum",
                    headers={**HDR, "Referer": f"https://{domain}/"}, timeout=8)
                print(f"  {domain} [{r.status_code}]")
                if r.status_code == 200:
                    media = re.findall(r'https://[^"\'<>\s]{5,120}(?:mp4|webm|jpg|jpeg|png)[^"\'<>\s]{0,40}', r.text, re.I)
                    print(f"  Media URLs: {media[:5]}")
                    break
            except Exception as e:
                print(f"  {domain}: {e}")

        # ── CYBERDROP ─────────────────────────────────────────────────────────
        print("\n=== CYBERDROP ===")
        for domain in ["cyberdrop.me", "cyberdrop.cc", "cyberdrop.to"]:
            try:
                r = await c.get(f"https://{domain}/a/testalbum",
                    headers={**HDR, "Referer": f"https://{domain}/"}, timeout=8)
                print(f"  {domain} [{r.status_code}]")
                if r.status_code == 200:
                    print(f"  Body snippet: {r.text[:200]}")
                    break
            except Exception as e:
                print(f"  {domain}: {type(e).__name__}: {e}")

        # ── KWIK ─────────────────────────────────────────────────────────────
        print("\n=== KWIK ===")
        try:
            r = await c.get("https://kwik.si/e/testid",
                headers={**HDR, "Referer": "https://animesuge.to/"}, timeout=8)
            print(f"  [{r.status_code}]")
            # Find m3u8 or mp4 sources
            sources = re.findall(r'source["\s]+(?:src)?["\s:=]+["\`]([^"\'`\s]{10,200})["\`]', r.text, re.I)
            token = re.findall(r'(?:token|_token)["\s:=]+["\`]([^"\'`\s]{10,80})["\`]', r.text, re.I)
            print(f"  Sources: {sources[:5]}")
            print(f"  Tokens: {token[:3]}")
        except Exception as e: print(f"ERROR: {e}")

        # ── MIXDROP ───────────────────────────────────────────────────────────
        print("\n=== MIXDROP (deep) ===")
        try:
            r = await c.get("https://mixdrop.sb/e/test123",
                headers={**HDR, "Referer": "https://mixdrop.sb/"})
            print(f"  [{r.status_code}] body len={len(r.text)}")
            # Find JS that contains video URL
            scripts = re.findall(r'<script[^>]*>([\s\S]{20,3000}?)</script>', r.text)
            for s in scripts:
                if any(k in s.lower() for k in ['mdcore', 'src', 'video', 'file', 'url']):
                    print(f"  Script({len(s)}c): {s[:400]}")
                    print()
        except Exception as e: print(f"ERROR: {e}")

asyncio.run(main())
