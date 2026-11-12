"""Adult site pack — toppornsites.com ranking #1–82 (captured 2026-11-12).

Each site is tagged with how MediaDL handles it:

  native      yt-dlp has a dedicated extractor
  tube        no dedicated extractor; handled by yt-dlp's generic extractor
              (KVS player via kvs_patch, HTML5 <video>, JSON-LD VideoObject)
              and, failing that, the headless-render capture fallback
  aggregator  hosts nothing itself; links out to other tubes (resolved by
              aggregator.py to the source video)
  cam         live cams; free public shows are recorded as live HLS with a
              time cap (DownloadReq.record_seconds)
  excluded    on yt-dlp's piracy blocklist; deliberately not supported

`SITEPACK_PROXY` (optional, e.g. socks5://host:1080) routes these domains
through that proxy when the request has no explicit proxy of its own.
"""
from __future__ import annotations

import os
from typing import Optional
from urllib.parse import urlparse

# rank, name, domain, group
SITES: list[tuple[int, str, str, str]] = [
    (1, "xVideos", "xvideos.com", "native"), (2, "PornHub", "pornhub.com", "native"),
    (3, "xHamster", "xhamster.com", "native"), (4, "XNXX", "xnxx.com", "native"),
    (5, "YouPorn", "youporn.com", "native"), (6, "EPorner", "eporner.com", "native"),
    (7, "RedTube", "redtube.com", "native"), (8, "Porn", "porn.com", "tube"),
    (9, "JustPorn", "justporn.com", "tube"), (10, "IXXX", "ixxx.com", "aggregator"),
    (11, "PornHat", "pornhat.com", "tube"), (12, "Porn300", "porn300.com", "tube"),
    (13, "PornOne", "pornone.com", "tube"), (14, "SpankBang", "spankbang.com", "native"),
    (15, "SexVid", "sexvid.xxx", "tube"), (16, "TnaFlix", "tnaflix.com", "native"),
    (17, "Fuq", "fuq.com", "aggregator"), (18, "Ok", "ok.xxx", "tube"),
    (19, "Beeg", "beeg.com", "native"), (20, "TubeGalore", "tubegalore.com", "aggregator"),
    (21, "XGroovy", "xgroovy.com", "tube"), (22, "SuperPorn", "superporn.com", "tube"),
    (23, "Sxyprn", "sxyprn.com", "excluded"), (24, "Tube8", "tube8.com", "native"),
    (25, "LetsPorn", "letsporn.com", "tube"), (26, "ZbPorn", "zbporn.com", "tube"),
    (27, "TheyAreHuge", "theyarehuge.com", "tube"), (28, "PerfectGirls", "perfectgirls.xxx", "tube"),
    (29, "PussySpace", "pussyspace.com", "tube"), (30, "Rat.xxx", "rat.xxx", "tube"),
    (31, "Tiava", "tiava.com", "aggregator"), (32, "3Movs", "3movs.com", "tube"),
    (33, "CumLouder", "cumlouder.com", "tube"), (34, "PornDoe", "porndoe.com", "tube"),
    (35, "Xbabe", "xbabe.com", "tube"), (36, "AlohaTube", "alohatube.com", "aggregator"),
    (37, "MatureTube", "maturetube.com", "tube"), (38, "TubeV", "tubev.sex", "tube"),
    (39, "VipWank", "vipwank.com", "tube"), (40, "Qorno", "qorno.com", "tube"),
    (41, "4Tube", "4tube.com", "native"), (42, "MelonsTube", "melonstube.com", "tube"),
    (43, "MegaTube", "megatube.xxx", "tube"), (44, "BigPorn", "bigporn.com", "tube"),
    (45, "JennyMovies", "jennymovies.com", "tube"), (46, "ColliderPorn", "colliderporn.com", "tube"),
    (47, "DinoTube", "dinotube.com", "aggregator"), (48, "HQPorn", "hqporn.xxx", "tube"),
    (49, "BustyBus", "bustybus.com", "tube"), (50, "LobsterTube", "lobstertube.com", "aggregator"),
    (51, "PornID", "pornid.xxx", "tube"), (52, "GrannyTube", "grannytube.net", "tube"),
    (53, "Shameless", "shameless.com", "tube"), (54, "HotPornTubes", "hotporntubes.com", "tube"),
    (55, "ZZZTube", "zzztube.com", "tube"), (56, "HandjobHub", "handjobhub.com", "tube"),
    (57, "XCafe", "xcafe.com", "tube"), (58, "XXXBunker", "xxxbunker.com", "tube"),
    (59, "YouJizz", "youjizz.com", "native"), (60, "IPornTV", "iporntv.net", "aggregator"),
    (61, "Mopoga", "mopoga.com", "aggregator"), (62, "PornPlanner", "pornplanner.com", "aggregator"),
    (63, "MyPornBible", "mypornbible.com", "aggregator"), (64, "Badjojo", "badjojo.com", "aggregator"),
    (65, "PornMD", "pornmd.com", "aggregator"), (66, "Jasmin", "awejmp.com", "cam"),
    (67, "StripChat", "stripchat.com", "native"), (68, "ImLive", "imlive.com", "cam"),
    (69, "JerkRoulette", "jerkroulette.com", "cam"), (70, "Chaturbate", "chaturbate.lat", "cam"),
    (71, "CamSoda", "camsoda.com", "native"), (72, "Flirt4Free", "flirt4free.com", "cam"),
    (73, "CamHours", "camhours.com", "cam"), (74, "RabbitsCams", "rabbitscams.sex", "cam"),
    (75, "Amateur.tv", "amateur.tv", "cam"), (76, "JerkMate", "jerkmate.com", "cam"),
    (77, "IChatOnline", "ichatonline.com", "cam"), (78, "CamsFinder", "camsfinder.com", "cam"),
    (79, "XTease", "xtease.com", "cam"), (80, "RoyalCamsLive", "royalcamslive.com", "cam"),
    (81, "SweepSex", "sweepsex.com", "cam"), (82, "DirtyRoulette", "dirtyroulette.com", "cam"),
]

# Adult domains that aren't in the ranking but already have extractors in MediaDL /
# yt-dlp; listed so the bot's adult toggle covers them too.
EXTRA_ADULT = (
    "chaturbate.com", "livejasmin.com", "erome.com", "hqporner.com", "thothub.to",
    "coomer.su", "coomer.st", "simpcity.su", "fapello.com", "xhamster.desi", "xhamster2.com",
    "xhaccess.com", "pornhubpremium.com", "motherless.com", "onlyfans.com", "fansly.com",
)

_BY_DOMAIN = {d: (rank, name, group) for rank, name, d, group in SITES}
ADULT_DOMAINS = tuple(sorted({d for _, _, d, _ in SITES} | set(EXTRA_ADULT)))


def host_of(url: str) -> str:
    try:
        h = (urlparse(url if "://" in url else "https://" + url).hostname or "").lower()
    except ValueError:
        return ""
    return h[4:] if h.startswith("www.") else h


def _match(host: str, domains) -> Optional[str]:
    for d in domains:
        if host == d or host.endswith("." + d):
            return d
    return None


def lookup(url: str) -> Optional[dict]:
    """Pack entry for a URL (matches subdomains, e.g. de.xhamster.com)."""
    d = _match(host_of(url), _BY_DOMAIN)
    if not d:
        return None
    rank, name, group = _BY_DOMAIN[d]
    return {"rank": rank, "name": name, "domain": d, "group": group}


def is_adult(url: str) -> bool:
    return _match(host_of(url), ADULT_DOMAINS) is not None


def group_of(url: str) -> Optional[str]:
    e = lookup(url)
    return e["group"] if e else None


def proxy_for(url: str, explicit: Optional[str] = None) -> Optional[str]:
    """The proxy a request to `url` should use: the request's own proxy always
    wins; otherwise SITEPACK_PROXY for pack domains; otherwise direct."""
    if explicit:
        return explicit
    p = (os.getenv("SITEPACK_PROXY") or "").strip()
    return p if p and is_adult(url) else None


def httpx_mounts() -> dict:
    """httpx mount patterns routing every adult domain through SITEPACK_PROXY."""
    p = (os.getenv("SITEPACK_PROXY") or "").strip()
    if not p:
        return {}
    import httpx
    out = {}
    for d in ADULT_DOMAINS:
        t = httpx.AsyncHTTPTransport(proxy=p)
        out[f"all://{d}"] = t
        out[f"all://*.{d}"] = t
    return out


def summary() -> dict:
    groups: dict[str, int] = {}
    for _, _, _, g in SITES:
        groups[g] = groups.get(g, 0) + 1
    return {
        "source": "toppornsites.com ranking, captured 2026-11-12",
        "count": len(SITES),
        "groups": groups,
        "proxy_configured": bool((os.getenv("SITEPACK_PROXY") or "").strip()),
        "sites": [{"rank": r, "name": n, "domain": d, "group": g} for r, n, d, g in SITES],
        "adult_domains": list(ADULT_DOMAINS),
    }
