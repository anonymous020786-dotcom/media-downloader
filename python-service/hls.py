"""Tell a live HLS playlist from a finished (VOD) one.

A pasted raw .m3u8 used to come back as a plain stream, so a live one was
neither offered "Record N min" nor time-capped. A media playlist is live when
it has segments but no #EXT-X-ENDLIST and isn't declared PLAYLIST-TYPE:VOD.
"""
from __future__ import annotations

from typing import Optional
from urllib.parse import urljoin


def first_variant(master_text: str, base_url: str) -> Optional[str]:
    """URI of the first variant stream in a master playlist, or None."""
    lines = [l.strip() for l in master_text.splitlines()]
    for i, line in enumerate(lines):
        if line.startswith("#EXT-X-STREAM-INF"):
            for nxt in lines[i + 1:]:
                if nxt and not nxt.startswith("#"):
                    return urljoin(base_url, nxt)
    return None


def is_master(text: str) -> bool:
    return "#EXT-X-STREAM-INF" in text


def media_playlist_is_live(text: str) -> bool:
    if "#EXTM3U" not in text or "#EXTINF" not in text:
        return False
    if "#EXT-X-ENDLIST" in text:
        return False
    if "#EXT-X-PLAYLIST-TYPE:VOD" in text.replace(" ", "").upper():
        return False
    return True


async def is_live(url: str, client) -> bool:
    """Fetch the playlist (and its first variant if it's a master) and decide.
    Any network or parse failure → False (treated as a normal stream)."""
    try:
        r = await client.get(url, timeout=10)
        text = r.text
        if is_master(text):
            v = first_variant(text, str(r.url))
            if not v:
                return False
            text = (await client.get(v, timeout=10)).text
        return media_playlist_is_live(text)
    except Exception:
        return False
