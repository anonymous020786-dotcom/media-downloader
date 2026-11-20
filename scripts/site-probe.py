"""Live-probe site-pack domains: homepage -> a video page -> yt-dlp (with kvs_patch).

Run on the server (dev networks DNS-block most of these):
    python scripts/site-probe.py                 # PL18_UNPROBED
    python scripts/site-probe.py --all           # PL18_SITES + PL18_UNPROBED
    python scripts/site-probe.py txxx.com ...    # specific pack domains
    python scripts/site-probe.py --json out.json --markdown summary.md

`pass` means a playable format URL resolved; move those entries to PL18_SITES.
Cams and aggregators are checked for reachability only: a cam streams from a
live room URL (not the homepage), and an aggregator's source tube is what downloads.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python-service"))
import kvs_patch  # noqa: E402
import sites_pack  # noqa: E402
import yt_dlp  # noqa: E402
from curl_cffi import requests as creq  # noqa: E402

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"
VIDEO_PATH = re.compile(r"/(videos?|v|watch|embed|movies?|porn-video|vid|clip)/[^\"'#?\s]+"
                        r"|/\d{4,}/[a-z0-9-]{6,}|/[a-z0-9-]{12,}-\d{3,}/?$", re.I)
SLUG_PATH = re.compile(r"^/[a-z0-9]+(?:-[a-z0-9]+){3,}/?$", re.I)
SKIP_PATH = re.compile(r"/(categor\w*|tags?|models?|pornstars?|channels?|search|login|signup|page|top|latest|new)\b", re.I)


def _extractor_samples() -> dict[str, str]:
    """A known video URL per domain from yt-dlp's own tests (for JS-only homepages)."""
    from yt_dlp.extractor.fourtube import PornTubeIE
    from yt_dlp.extractor.txxx import TxxxIE
    out: dict[str, str] = {}
    for ie in (TxxxIE, PornTubeIE):
        for t in getattr(ie, "_TESTS", []):
            out.setdefault((urlparse(t["url"]).hostname or "").removeprefix("www."), t["url"])
    return out


SAMPLES: dict[str, str] = {}


def video_links(home: str, html: str) -> list[str]:
    host = (urlparse(home).hostname or "").removeprefix("www.")
    out: list[str] = []
    for h in re.findall(r'href=["\']([^"\'#]+)["\']', html):
        u = urljoin(home, h)
        p = urlparse(u)
        if (p.hostname or "").removeprefix("www.") != host or u in out:
            continue
        if (VIDEO_PATH.search(p.path) or SLUG_PATH.search(p.path)) and not SKIP_PATH.search(p.path):
            out.append(u)
    return out


def ytdlp(url: str) -> dict:
    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "socket_timeout": 20,
            "http_headers": {"User-Agent": UA}, "noplaylist": True, "playlistend": 3}
    with yt_dlp.YoutubeDL(opts) as y:
        info = y.extract_info(url, download=False)
    if info.get("_type") == "playlist":
        ents = [e for e in (info.get("entries") or []) if e]
        info = ents[0] if ents else info
    fmts = [f for f in (info.get("formats") or []) if f.get("url")] or ([info] if info.get("url") else [])
    return {"extractor": info.get("extractor_key"), "formats": len(fmts),
            "best_h": max((f.get("height") or 0 for f in fmts), default=0),
            "is_live": bool(info.get("is_live"))}


def probe(entry: tuple[str, str, str]) -> dict:
    name, domain, group = entry
    r: dict = {"domain": domain, "name": name, "group": group}
    home = f"https://{domain}/"
    try:
        resp = creq.get(home, impersonate="chrome", timeout=25, allow_redirects=True)
    except Exception as e:
        return {**r, "status": "unreachable", "error": str(e)[:160]}
    if resp.status_code >= 400:
        return {**r, "status": "unreachable", "error": f"HTTP {resp.status_code}"}
    home = str(resp.url)
    if (urlparse(home).hostname or "").removeprefix("www.") != domain:
        r["redirected_to"] = home
    # Aggregators host nothing; cams only stream from a live room URL, never the
    # homepage. Both are checked for reachability only.
    if group in ("aggregator", "cam"):
        return {**r, "status": "reachable"}
    if domain in SAMPLES:
        cands = [SAMPLES[domain]]
    else:
        cands = video_links(home, resp.text)[:3]
        if not cands:
            return {**r, "status": "no_video_link"}
    err = ""
    for u in cands:
        try:
            res = ytdlp(u)
            if res["formats"]:
                return {**r, "status": "pass", "url": u, **res}
            err = f"{u}: no formats"
        except Exception as e:
            err = f"{u}: {str(e).splitlines()[0][:200]}"
    return {**r, "status": "fail", "tried": cands, "error": err}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("domains", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--json")
    ap.add_argument("--markdown", help="append a results table (e.g. $GITHUB_STEP_SUMMARY)")
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()

    kvs_patch.apply()
    SAMPLES.update(_extractor_samples())
    pool = sites_pack.PL18_SITES + sites_pack.PL18_UNPROBED
    if a.domains:
        entries = [e for e in pool if e[1] in a.domains]
    else:
        entries = pool if a.all else sites_pack.PL18_UNPROBED

    with cf.ThreadPoolExecutor(a.workers) as ex:
        res = list(ex.map(probe, entries))
    if a.json:
        Path(a.json).write_text(json.dumps(res, indent=1), encoding="utf-8")
    for x in sorted(res, key=lambda x: (x["status"], x["domain"])):
        extra = x.get("error") or x.get("redirected_to") or f"{x.get('extractor', '')} {x.get('best_h') or ''}"
        print(f"{x['status']:13} {x['group']:10} {x['domain']:24} {extra[:110]}")
    counts: dict[str, int] = {}
    for x in res:
        counts[x["status"]] = counts.get(x["status"], 0) + 1
    print(counts)
    if a.markdown:
        with open(a.markdown, "a", encoding="utf-8") as f:
            f.write(write_markdown(res, counts))
    return 0


def write_markdown(res: list[dict], counts: dict[str, int]) -> str:
    unprobed = {d for _, d, _ in sites_pack.PL18_UNPROBED}
    promote = sorted(x["domain"] for x in res if x["status"] == "pass" and x["domain"] in unprobed)
    out = ["## Site probe", "", " · ".join(f"**{k}** {v}" for k, v in sorted(counts.items())), ""]
    if promote:
        out += [f"**Ready to promote to `PL18_SITES` ({len(promote)}):** " + ", ".join(promote), ""]
    out += ["| status | group | domain | detail |", "|---|---|---|---|"]
    for x in sorted(res, key=lambda x: (x["status"], x["domain"])):
        detail = x.get("error") or x.get("redirected_to") or f"{x.get('extractor', '')} {x.get('best_h') or ''}"
        detail = detail.replace("|", "\\|")[:140]
        out.append(f"| {x['status']} | {x['group']} | {x['domain']} | {detail} |")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    sys.exit(main())
