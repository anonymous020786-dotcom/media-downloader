"""Fix yt-dlp's generic KVS (Kernel Video Sharing) extractor for current KVS builds.

KVS powers dozens of tube sites (pornhat, porn300, zbporn, xgroovy, 3movs, xcafe,
theyarehuge, hqporn, shameless, …). yt-dlp detects the player but then looks for
`var flashvars = {...}`. Current KVS builds give that object a random name
(`var t0f510b81fd = {...}`) and pass it as the 5th argument of `kt_player(...)`,
so every modern KVS site fails with "Unable to extract flashvars".

`apply()` replaces GenericIE._extract_kvs with a version that finds the config
object via the kt_player(...) call (falling back to the legacy name), and
tolerates a missing preview_url. URL de-obfuscation (function/0/ + license_code)
is still yt-dlp's own `_kvs_get_real_url`.
"""
from __future__ import annotations

import re
from typing import Optional

_KT_CALL_RE = re.compile(
    r"kt_player\s*\(\s*(['\"])[^'\"]*\1\s*,\s*(['\"])[^'\"]*\2\s*,\s*(['\"])[^'\"]*\3\s*,"
    r"\s*(['\"])[^'\"]*\4\s*,\s*(?P<var>[A-Za-z_$][\w$]*)\s*\)")


def find_flashvars_name(webpage: str) -> Optional[str]:
    """Name of the JS variable holding the KVS player config, or None."""
    if re.search(r"var\s+flashvars\s*=\s*\{", webpage):
        return "flashvars"
    m = _KT_CALL_RE.search(webpage)
    if m and re.search(rf"var\s+{re.escape(m.group('var'))}\s*=\s*\{{", webpage):
        return m.group("var")
    return None


def apply() -> bool:
    try:
        import urllib.parse
        from yt_dlp.extractor.generic import GenericIE
        from yt_dlp.utils import js_to_json, parse_resolution, urljoin
    except Exception as e:  # pragma: no cover - yt-dlp layout changed
        print(f"[startup] KVS patch skipped: {e}")
        return False
    if getattr(GenericIE, "_mediadl_kvs_patched", False):
        return True

    def _extract_kvs(self, url, webpage, video_id):
        name = find_flashvars_name(webpage) or "flashvars"
        flashvars = self._search_json(
            rf"(?s:<script\b[^>]*>.*?var\s+{re.escape(name)}\s*=)",
            webpage, "flashvars", video_id, transform_source=js_to_json)

        display_id = self._search_regex(
            r'(?:<link href="https?://[^"]+/(.+?)/?" rel="canonical"\s*/?>'
            r'|<link rel="canonical" href="https?://[^"]+/(.+?)/?"\s*/?>)',
            webpage, "display_id", fatal=False)
        title = (flashvars.get("video_title")
                 or self._html_search_regex(r"<(?:h1|title)[^>]*>(?:Video: )?(.+?)</(?:h1|title)>",
                                            webpage, "title", fatal=False)
                 or video_id)

        thumbnail = flashvars.get("preview_url") or None
        if thumbnail and thumbnail.startswith("//"):
            thumbnail = urllib.parse.urlparse(url).scheme + ":" + thumbnail

        license_code = flashvars.get("license_code") or ""
        url_keys = [k for k in flashvars if re.match(r"^video_(?:url|alt_url\d*)$", k)]
        formats = []
        for key in url_keys:
            raw = flashvars[key]
            if not isinstance(raw, str) or "/get_file/" not in raw:
                continue
            fmt_label = flashvars.get(f"{key}_text") or key
            formats.append({
                "url": urljoin(url, self._kvs_get_real_url(raw, license_code)),
                "format_id": fmt_label,
                "ext": "mp4",
                **(parse_resolution(fmt_label) or parse_resolution(raw)),
                "http_headers": {"Referer": url},
            })
            if not formats[-1].get("height"):
                formats[-1]["quality"] = 1

        return {
            "id": str(flashvars.get("video_id") or video_id),
            "display_id": display_id,
            "title": title,
            "thumbnail": urljoin(url, thumbnail) if thumbnail else None,
            "duration": None,
            "formats": formats,
        }

    GenericIE._extract_kvs = _extract_kvs
    GenericIE._mediadl_kvs_patched = True
    print("[startup] KVS player patch enabled (randomised flashvars names)")
    return True
