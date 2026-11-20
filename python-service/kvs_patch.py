"""Fix yt-dlp's generic KVS (Kernel Video Sharing) extractor for current KVS builds.

KVS powers dozens of tube sites (pornhat, porn300, zbporn, xgroovy, 3movs, xcafe,
theyarehuge, hqporn, shameless, …). yt-dlp detects the player but then looks for
`var flashvars = {...}`. Current KVS builds give that object a random name
(`var t0f510b81fd = {...}`) and pass it as the 5th argument of `kt_player(...)`,
so every modern KVS site fails with "Unable to extract flashvars".

`apply()` replaces GenericIE._extract_kvs with a version that finds the config
object via the kt_player(...) call (falling back to the legacy name), tolerates
a missing preview_url, and collapses JS `+` string concatenation before handing
the source to js_to_json. Some KVS builds compute a flashvars value (an ad/
tracking query string, not anything we read) by concatenating a literal with a
bare JS variable, e.g. `adv_pre_vast: '/frk/?r=1&keywords=' + current_keyword`.
js_to_json's JS->JSON token rewriter doesn't evaluate `+`, so that stray
operator breaks json.loads ("Unable to extract flashvars - Failed to parse
JSON ... Expecting ',' delimiter") even though the fields we actually need
(video_url etc.) are themselves plain literals elsewhere in the same object.
Since we never read these ad fields, an unresolvable `literal + identifier` is
collapsed to just the literal (the identifier is dropped, not evaluated);
`literal + literal` is concatenated for real. URL de-obfuscation
(function/0/ + license_code) is still yt-dlp's own `_kvs_get_real_url`.
"""
from __future__ import annotations

import re
from typing import Optional

_KT_CALL_RE = re.compile(
    r"kt_player\s*\(\s*(['\"])[^'\"]*\1\s*,\s*(['\"])[^'\"]*\2\s*,\s*(['\"])[^'\"]*\3\s*,"
    r"\s*(['\"])[^'\"]*\4\s*,\s*(?P<var>[A-Za-z_$][\w$]*)\s*\)")

# A "term" on either side of `+`: a quoted string literal (each quote style
# spelled out so no backreference is needed — one would renumber wrongly once
# duplicated into _CONCAT_RE below), or a bare JS identifier/number (anything
# else — calls, brackets — is left alone).
_STR_LIT = r'"(?:\\.|[^"\\])*"' + r"|'(?:\\.|[^'\\])*'"
_TERM = rf'(?:{_STR_LIT})|[A-Za-z_$][\w$]*'
_CONCAT_RE = re.compile(rf'({_TERM})\s*\+\s*({_TERM})')


def _collapse_str_concat(src: str) -> str:
    def repl(m: "re.Match") -> str:
        a, b = m.group(1), m.group(2)
        a_lit, b_lit = a[:1] in "\"'", b[:1] in "\"'"
        if a_lit and b_lit:
            return a[:1] + a[1:-1] + b[1:-1] + a[:1]   # "x" + "y" -> "xy"
        if a_lit:
            return a                                    # "x" + ident -> "x"
        if b_lit:
            return b                                    # ident + "x" -> "x"
        return m.group(0)                                # ident + ident -> leave

    prev = None
    while prev != src:
        prev = src
        src = _CONCAT_RE.sub(repl, src)
    return src


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
            webpage, "flashvars", video_id,
            transform_source=lambda s: js_to_json(_collapse_str_concat(s)))

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
