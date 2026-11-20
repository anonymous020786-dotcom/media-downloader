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

PL18_SITES adds pornlist18.com category lists (captured 2026-11-20): sites that
resolved a playable format in a live probe, or that yt-dlp has a dedicated
extractor for. PL18_UNPROBED holds the rest of the free sites from those lists,
not yet live-probed. EXCLUDED holds domains MediaDL refuses outright:
`piracy` (re-hosts paid / studio content) and `ncii` (built around leaked or
non-consensual intimate media). /analyze and /download reject them before any
extractor or the headless fallback runs.

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

# pornlist18.com category lists (tube, amateur, anal, black, mature, shemale, …),
# captured 2026-11-20. name, domain, group
PL18_SITES: list[tuple[str, str, str]] = [
    # live-probed 2026-11-20: a video page resolved to a playable format
    ("AmaPorn", "amaporn.com", "tube"), ("AmateurPorn", "amateurporn.me", "tube"),
    ("AnalVids", "analvids.com", "tube"), ("BeMyHole", "bemyhole.com", "tube"),
    ("GrannyMommy", "grannymommy.com", "tube"), ("HDPussy", "hdpussy.xxx", "tube"),
    ("HomeMoviesTube", "homemoviestube.com", "tube"),
    # yt-dlp TxxxIE (dedicated extractor)
    ("HClips", "hclips.com", "native"), ("HDZog", "hdzog.com", "native"),
    ("HotMovs", "hotmovs.com", "native"), ("InPorn", "inporn.com", "native"),
    ("TXXX", "txxx.com", "native"), ("Upornia", "upornia.com", "native"),
    ("VXXX", "vxxx.com", "native"),
    # live-probed 2026-11-20 round 2, after the kvs_patch concat-collapse fix
    # (generic KVS flashvars with `'literal' + jsVar` ad fields now parse)
    ("PornTop", "porntop.com", "native"),
    ("Babes34", "babes34.me", "tube"), ("PornHD.sex", "pornhd.sex", "tube"),
    ("PornoAfricain", "pornoafricain.com", "tube"), ("PornoAfricano", "pornoafricano.net", "tube"),
    ("PornWorld", "pornworld.com", "tube"), ("RelaxSex", "relax-sex.com", "tube"),
    ("SenePornoBabi", "senepornobabi.com", "tube"), ("SexVid.me", "sexvid.me", "tube"),
    ("WetMummy", "wetmummy.com", "tube"), ("Xnalgas", "xnalgas.com", "tube"),
    ("XPaja", "xpaja.net", "tube"), ("XXXFollow", "xxxfollow.com", "tube"),
    ("YourLesbians", "yourlesbians.com", "tube"), ("Pornozmo", "pornozmo.com", "tube"),
]

# Free sites from the same lists that couldn't be live-probed yet (DNS-blocked
# on the dev network, or a JS-only homepage). Same groups and dispatch as above;
# promote an entry to PL18_SITES once scripts/site-probe.py passes it.
# (XTube/xtube.com dropped 2026-11-20: MindGeek dissolved it in 2021, confirmed
# still dead — not worth carrying as "unprobed".)
PL18_UNPROBED: list[tuple[str, str, str]] = [
    ("PornTube", "porntube.com", "native"),
    # tubes
    ("01Tube", "01tube.com", "tube"),
    ("ClicPorn", "clicporn.com", "tube"), ("ElMundoPorno", "elmundoporno.com", "tube"),
    ("Fliporno", "fliporno.net", "tube"), ("Fuqqt", "fuqqt.com", "tube"),
    ("GermanFuckTube", "germanfucktube.com", "tube"), ("GetTranny", "gettranny.com", "tube"),
    ("IGPorn", "igporn.com", "tube"), ("LechePussy", "lechepussy.com", "tube"),
    ("ManySex", "manysex.com", "tube"), ("MatureLarge", "maturelarge.com", "tube"),
    ("ModPorn", "modporn.com", "tube"), ("NurXXX", "nurxxx.com", "tube"),
    ("NurXXX Mobile", "nurxxx.mobi", "tube"), ("Petardas", "petardas.xxx", "tube"),
    ("PornAnn", "pornann.com", "tube"),
    ("TonicPorn", "porn2all.com", "tube"),
    ("RussianGranny", "russian-granny.com", "tube"),
    ("SheFlix", "sheflix.com", "tube"),
    ("ShemaleZ", "shemalez.com", "tube"), ("SpitzeTitten", "spitzetitten.com", "tube"),
    ("TeatroDelPorno", "teatrodelporno.com", "tube"), ("TeatroPorno", "teatroporno.com", "tube"),
    ("TeensBabes", "teensbabes.com", "tube"), ("VoilaPorno", "voilaporno.com", "tube"),
    ("VideoSexeGratuite", "videosexegratuite.com", "tube"),
    ("XZorra", "xzorra.net", "tube"),
    ("PornoAmica", "pornoamica.com", "tube"), ("PornoCategorie", "pornocategorie.com", "tube"),
    ("PornoCulazos", "pornoculazos.com", "tube"), ("PornoCuli", "pornoculi.com", "tube"),
    ("PornoEspaniol", "pornoespaniol.com", "tube"), ("PornoFakings", "pornofakings.com", "tube"),
    ("PornoJour", "pornojour.com", "tube"), ("PornoOrgasme", "pornoorgasme.com", "tube"),
    ("PornoSauna", "pornosauna.com", "tube"), ("PornoTreno", "pornotreno.com", "tube"),
    ("RueNu", "ruenu.com", "tube"), ("SessoRomantico", "sessoromantico.com", "tube"),
    ("SexoOral", "sexooral.org", "tube"),
    # aggregators (tag / out-link pages only; the source tube is what downloads)
    ("AmorePorno", "amoreporno.com", "aggregator"), ("CategoriePorno", "categorieporno.com", "aggregator"),
    ("CouplesNus", "couplesnus.com", "aggregator"), ("CulNue", "culnue.com", "aggregator"),
    ("CuloNudo", "culonudo.com", "aggregator"), ("FakingPorno", "fakingporno.com", "aggregator"),
    ("FilmXAdulte", "filmxadulte.com", "aggregator"), ("PasionChicas", "pasionchicas.com", "aggregator"),
    ("ArabXN", "arabxn.com", "aggregator"), ("NudeVista", "nudevista.com", "aggregator"),
    ("WankMap", "wankmap.com", "aggregator"),
    # live cams (free public shows)
    ("AsianCams", "asiancams.com", "cam"), ("EbonyCams", "ebonycams.com", "cam"),
    ("FruityCams", "fruitycams.com", "cam"), ("LatinaCams", "latinacams.com", "cam"),
    ("MatureCams", "maturecams.com", "cam"), ("MILF.com", "milf.com", "cam"),
    ("MistressLive", "mistresslive.cam", "cam"), ("MyFreeCams", "myfreecams.com", "cam"),
    ("PornLive", "pornlive.com", "cam"), ("PrivateHDCams", "privatehdcams.net", "cam"),
    ("StraponLive", "straponlive.cam", "cam"), ("UnCams", "uncams.com", "cam"),
    ("WebcamGirls", "webcamgirls.chat", "cam"), ("Gilfs.cam", "gilfs.cam", "cam"),
]

EXCLUDED: dict[str, str] = {
    "sxyprn.com": "piracy",
    # paid Indian OTT (Ullu etc.) re-hosted for free
    "xmaal.in": "piracy", "boldmaal.com": "piracy", "webxseries.hot": "piracy",
    "desivdo.club": "piracy",
    # JAV studio re-hosts, cam-show re-hosts, full-movie rips
    "javdino.com": "piracy", "javlust.net": "piracy", "sexjav.tv": "piracy",
    "18avx.com": "piracy", "ikisoda.com": "piracy", "zhornyhub.com": "piracy",
    "recordbate.com": "piracy", "beeg.porn": "piracy",
    # "leaked" / "scandal" / MMS / candid / OnlyFans-leak sites
    "desiporn.tube": "ncii", "desihub.sh": "ncii", "desijerk.com": "ncii",
    "desiporn.one": "ncii", "thegandubaba.com": "ncii", "mykamababa.com": "ncii",
    "nangiphotos.com": "ncii", "nangivideo.com": "ncii",
    "fuktxxx.com": "ncii", "ghanatok.com": "ncii", "mzansitok.com": "ncii",
    "leaktubenet.com": "ncii", "totoleak.com": "ncii", "xrares.com": "ncii",
    "sexycandidgirls.com": "ncii", "teenager365.com": "ncii", "teenager365.to": "ncii",
    "malayporner.com": "ncii",
}

_BY_DOMAIN = {d: (rank, name, group) for rank, name, d, group in SITES}
_BY_DOMAIN.update({d: (None, name, group) for name, d, group in PL18_SITES + PL18_UNPROBED})
ADULT_DOMAINS = tuple(sorted(
    {d for _, _, d, _ in SITES} | {d for _, d, _ in PL18_SITES + PL18_UNPROBED}
    | set(EXCLUDED) | set(EXTRA_ADULT)))


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


def excluded_reason(url: str) -> Optional[str]:
    """'piracy' / 'ncii' when MediaDL refuses this URL's site, else None."""
    d = _match(host_of(url), EXCLUDED)
    return EXCLUDED[d] if d else None


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
        "pl18": {"source": "pornlist18.com category lists, captured 2026-11-20",
                 "sites": [{"name": n, "domain": d, "group": g} for n, d, g in PL18_SITES],
                 "unprobed": [{"name": n, "domain": d, "group": g} for n, d, g in PL18_UNPROBED]},
        "excluded": dict(EXCLUDED),
        "adult_domains": list(ADULT_DOMAINS),
    }
