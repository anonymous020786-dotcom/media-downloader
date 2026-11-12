"""Classify extractor failures into a reason + a user-facing hint.

/analyze used to swallow the yt-dlp exception, so every failure came back as an
empty "page" result, and a transient network error on a Shorts / reel URL was
reported as "login required" (and cached). This module turns the raw error text
into something the UI and the bot can act on.
"""
from __future__ import annotations

import re
from typing import Optional, TypedDict

REASONS = (
    "network", "blocked", "login", "geo", "drm", "removed",
    "extractor_broken", "unsupported", "piracy", "unknown",
)


class ErrorInfo(TypedDict):
    reason: str
    hint: str
    detail: str


# Order matters: the first matching rule wins.
_RULES: list[tuple[str, re.Pattern]] = [
    ("piracy", re.compile(r"\[piracy\]|piracy", re.I)),
    ("drm", re.compile(r"\bDRM\b|widevine|playready|fairplay|this video is drm protected", re.I)),
    ("login", re.compile(
        r"login required|log ?in to|sign in to confirm|account authentication is required"
        r"|use --cookies|--cookies-from-browser|requires? (?:a )?(?:login|authentication|subscription)"
        r"|private video|members[- ]only|age[- ]restricted|confirm your age|this content isn't available to everyone",
        re.I)),
    ("geo", re.compile(r"not available in your (?:country|region)|geo.?restrict|geo.?block|"
                       r"blocked it in your country|available only in", re.I)),
    ("removed", re.compile(r"video (?:has been|was) (?:removed|deleted)|video unavailable|"
                           r"HTTP Error 404|404: Not Found|no longer available|has been terminated|"
                           r"does not exist|page not found", re.I)),
    # Network-class: DNS failures, connect timeouts, resets, TLS cut-offs. A block
    # by an ISP shows up as one of these, so it is reported as "network".
    ("network", re.compile(
        r"getaddrinfo failed|Could not resolve host|Failed to resolve|Name or service not known"
        r"|Temporary failure in name resolution|timed out|Connection timed out|Failed to connect"
        r"|Could not connect to server|Connection refused|Connection reset|RemoteDisconnected"
        r"|UNEXPECTED_EOF_WHILE_READING|SSL: |curl: \((?:6|7|28|35|52|56)\)|Network is unreachable"
        r"|TransportError", re.I)),
    # Anti-bot / IP reputation blocks (data-centre IP, Cloudflare challenge).
    ("blocked", re.compile(r"HTTP Error 403|403: Forbidden|your IP may be blocked|"
                           r"HTTP Error 429|Too Many Requests|captcha|cloudflare", re.I)),
    ("extractor_broken", re.compile(
        r"please report this issue|Unable to extract|Cannot parse data|Failed to parse JSON"
        r"|cannot access local variable|KeyError|TypeError|AttributeError|Requested format is not available",
        re.I)),
    ("unsupported", re.compile(r"Unsupported URL|no suitable extractor|is not a valid URL", re.I)),
]

_HINTS = {
    "network": "Couldn't reach the site (DNS failure or connection timeout). Your network may be blocking it; try again, or set a proxy in /proxy.",
    "blocked": "The site refused the request (anti-bot / IP block). Retry later, add the site's cookies, or use a proxy.",
    "login": "This needs a logged-in account. Save the site's cookies with /cookies, then retry.",
    "geo": "This isn't available in the server's country. A proxy in another region may work.",
    "drm": "This is DRM-protected and can't be downloaded.",
    "removed": "This looks deleted, private or not found.",
    "extractor_broken": "The site changed and its extractor is broken. It usually gets fixed in the next engine update (/engines).",
    "unsupported": "No extractor recognises this link, and no media was found on the page.",
    "piracy": "This site is on the engine's piracy blocklist and isn't supported.",
    "unknown": "Couldn't find downloadable media on this page.",
}


def classify(err: Optional[str]) -> str:
    """Return one of REASONS for a raw error string (None → 'unknown')."""
    if not err:
        return "unknown"
    for reason, pat in _RULES:
        if pat.search(err):
            return reason
    return "unknown"


def error_info(err: Optional[str]) -> ErrorInfo:
    reason = classify(err)
    detail = re.sub(r"\s+", " ", (err or "")).strip()
    # Drop the yt-dlp boilerplate tail, which tells the user nothing.
    detail = re.split(r";? ?please report this issue|\. See https?://", detail)[0][:300]
    return {"reason": reason, "hint": _HINTS[reason], "detail": detail}


def should_cache(result: dict) -> bool:
    """Only cache real answers. Never cache a degraded result: one carrying an
    error, a 'login-required' guess, or a bare 'page' fallback with no images.
    A transient network blip must not poison the cache for an hour."""
    if not isinstance(result, dict) or result.get("error"):
        return False
    if result.get("extractor") == "login-required":
        return False
    if result.get("type") == "page":
        return False  # unchanged rule: page scrapes are cheap and should stay fresh
    return True
