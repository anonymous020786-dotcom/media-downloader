"""Probe multiple sites to find their download mechanisms."""
import httpx, asyncio, re, json

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
HDR = {"User-Agent": UA, "Accept": "*/*"}

async def probe(label, reqs, c):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    for url, extra_headers, desc in reqs:
        try:
            h = {**HDR, **extra_headers}
            r = await c.get(url, headers=h, timeout=12)
            ct = r.headers.get("content-type","")
            cl = r.headers.get("content-length","?")
            loc = r.headers.get("location","")
            print(f"[{r.status_code}] {cl}B  {ct[:50]}")
            print(f"  -> {desc}")
            if loc: print(f"  Location: {loc[:150]}")
            if r.status_code == 200 and "json" in ct:
                print(f"  JSON: {r.text[:600]}")
            elif r.status_code == 200 and "html" in ct:
                # look for video/file links
                vids = re.findall(r'https?://[^\s"\'<>]{8,150}(?:\.mp4|\.m3u8|cdn|stream|media|download)[^\s"\'<>]{0,60}', r.text, re.I)
                hrefs = re.findall(r'href=["\']([^"\']{1,200}(?:download|file|video|mp4)[^"\']{0,100})["\']', r.text, re.I)
                if vids: print(f"  VIDEO URLs: {vids[:4]}")
                if hrefs: print(f"  HREFs: {hrefs[:4]}")
        except Exception as e:
            print(f"  ERROR: {e}")
        print()

async def main():
    async with httpx.AsyncClient(follow_redirects=True, verify=False, timeout=15) as c:

        # 1. GoFile.io
        await probe("GoFile.io", [
            ("https://api.gofile.io/accounts", {}, "guest account creation (GET)"),
            ("https://gofile.io/d/xyz123", {}, "sample album page"),
            ("https://api.gofile.io/contents/xyz123?wt=4fd6sg89d7s6&cache=true", {"Authorization": "Bearer null"}, "contents API"),
        ], c)

        # 2. Pixeldrain
        await probe("Pixeldrain", [
            ("https://pixeldrain.com/api/file/TESTID", {}, "direct API download"),
            ("https://pixeldrain.com/api/file/TESTID/info", {}, "file info API"),
            ("https://pixeldrain.com/u/TESTID", {}, "user page"),
        ], c)

        # 3. Bunkr.sk / bunkr.su
        await probe("Bunkr.sk", [
            ("https://bunkr.sk/v/test", {}, "video page"),
            ("https://bunkr.si/v/test", {}, "video page si"),
            ("https://cdn.bunkr.sk/test.mp4", {}, "CDN direct"),
            ("https://i-burger.bunkr.ru/test.mp4", {}, "CDN burger"),
        ], c)

        # 4. Streamtape
        await probe("Streamtape", [
            ("https://streamtape.com/v/testid/", {"Referer":"https://streamtape.com/"}, "video page"),
            ("https://streamtape.com/get_video?id=testid&expires=0&ip=x&token=x", {}, "get_video API"),
        ], c)

        # 5. Cyberdrop.me
        await probe("Cyberdrop.me", [
            ("https://cyberdrop.me/a/testid", {}, "album page"),
            ("https://cyberdrop.me/api/v1/file/testid", {}, "file API"),
        ], c)

        # 6. Erome.com
        await probe("Erome.com", [
            ("https://www.erome.com/a/testid", {}, "album page"),
            ("https://www.erome.com/api/v1/album/testid", {"Accept":"application/json"}, "album API"),
        ], c)

        # 7. beeg.com (same externulls.com platform as pat.com?)
        await probe("beeg.com", [
            ("https://beeg.com/1234567890123456", {}, "video page"),
            ("https://store.externulls.com/videos/1234567890123456", {"Origin":"https://beeg.com","Referer":"https://beeg.com/"}, "store API"),
        ], c)

        # 8. Mixdrop
        await probe("Mixdrop", [
            ("https://mixdrop.sb/e/testid", {}, "embed page"),
            ("https://mixdrop.sb/f/testid", {}, "file page"),
        ], c)

        # 9. Doodstream
        await probe("Doodstream", [
            ("https://dood.wf/e/testid", {}, "embed page"),
            ("https://dood.wf/d/testid", {}, "download page"),
        ], c)

        # 10. Kwik (anime streaming, used by 9anime etc)
        await probe("Kwik.si / streamlare", [
            ("https://kwik.si/e/testid", {}, "kwik embed"),
            ("https://streamlare.com/v/testid", {}, "streamlare"),
        ], c)

asyncio.run(main())
