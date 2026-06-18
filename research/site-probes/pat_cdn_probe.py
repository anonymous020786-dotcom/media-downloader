"""Probe the actual pat.com CDN URL structure to find the m3u8 manifest."""
import httpx, asyncio, re

# Example CDN URL shape (signed token scrubbed — paste a fresh one to re-run):
SAMPLE = "https://video.pat.com/key=REDACTED_SIGNED_TOKEN,end=0000000000,limit=3/data=REDACTED_DATA/media=hls4A/av1_360p/431704237039969.mp4/init-v1-a1.mp4"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36"
HDR = {"User-Agent": UA, "Referer": "https://pat.com/", "Origin": "https://pat.com"}

# Parse the URL structure
# https://video.pat.com/{auth}/data={data}/media={media}/{quality}/{file_id}.mp4/{segment}
import urllib.parse as up

parsed = up.urlparse(SAMPLE)
parts = parsed.path.strip("/").split("/")
print("URL path parts:")
for i, p in enumerate(parts):
    print(f"  [{i}] {p}")

# Reconstruct the base path (everything up to quality/file_id)
# Base = key=...,end=...,limit=... / data=... / media=...
# Under that: {quality}/{file_id}.mp4/{segment}
auth_part  = parts[0]   # key=...,end=...,limit=...
data_part  = parts[1]   # data=...
media_part = parts[2]   # media=hls4A
quality    = parts[3]   # av1_360p
file_mp4   = parts[4]   # 431704237039969.mp4
segment    = parts[5]   # init-v1-a1.mp4

base_cdn = f"https://video.pat.com/{auth_part}/{data_part}/{media_part}"
file_base = f"{base_cdn}/{quality}/{file_mp4}"

print(f"\nauth_part : {auth_part}")
print(f"data_part : {data_part}")
print(f"media_part: {media_part}")
print(f"quality   : {quality}")
print(f"file_id   : {file_mp4}")
print(f"segment   : {segment}")
print(f"\nbase_cdn  : {base_cdn}")
print(f"file_base : {file_base}")

async def probe():
    async with httpx.AsyncClient(follow_redirects=True, timeout=15, verify=False) as c:
        # Try various m3u8 locations
        candidates = [
            f"{file_base}/index.m3u8",
            f"{file_base}/playlist.m3u8",
            f"{file_base}/master.m3u8",
            f"{base_cdn}/{file_mp4}/index.m3u8",
            f"{base_cdn}/master.m3u8",
            f"{base_cdn}/index.m3u8",
            # Without quality subfolder
            f"https://video.pat.com/{auth_part}/{data_part}/media=hls4A/{file_mp4}/index.m3u8",
        ]
        print("\n=== m3u8 candidates ===")
        for url in candidates:
            try:
                r = await c.head(url, headers=HDR, timeout=8)
                ct = r.headers.get("content-type", "")
                cl = r.headers.get("content-length", "?")
                loc = r.headers.get("location", "")
                print(f"  [{r.status_code}] {ct[:40]} {cl}B  {url.replace(auth_part, '<auth>')}")
                if loc: print(f"  -> {loc[:150]}")
            except Exception as e:
                print(f"  [ERR] {e}  {url.replace(auth_part, '<auth>')}")

        # Also probe the direct init segment itself
        print("\n=== init segment probe ===")
        r = await c.get(SAMPLE, headers=HDR, timeout=10)
        print(f"  [{r.status_code}] ct={r.headers.get('content-type','')} size={len(r.content)} bytes")
        if r.status_code == 200 and r.content:
            print(f"  First 8 bytes hex: {r.content[:8].hex()} (ftyp box if mp4)")

asyncio.run(probe())
