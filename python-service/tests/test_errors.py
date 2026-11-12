"""Classifier tests use real yt-dlp error strings captured by the 2026-11-12 site probe."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import errors  # noqa: E402

REAL = [
    ("[youtube] tPEE9ZwTmy0: Unable to download API page: HTTPSConnection(host='www.youtube.com', port=443): "
     "Failed to resolve 'www.youtube.com' ([Errno 11001] getaddrinfo failed)", "network"),
    ("[PornHub] 648719015: Unable to download webpage: Failed to perform, curl: (28) Failed to connect to "
     "www.pornhub.com:443 after 21134 ms: Could not connect to server.", "network"),
    ("[XVideos] ucuvbkfda4e: Unable to download webpage: (<HTTPConnection(host='xvideos.com', port=80)>, "
     "'Connection to xvideos.com timed out. (connect timeout=30.0)')", "network"),
    ("[SpankBang] 56b3d: Unable to download webpage: Failed to perform, curl: (6) Could not resolve host: spankbang.com", "network"),
    ("[download] Got error: [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1032)", "network"),
    ('[vimeo] 54469442: Got HTTP Error 403 when using impersonate target "chrome-152:windows-10". If you are using '
     "a data center IP or VPN/proxy, your IP may be blocked", "blocked"),
    ("[Rumble] vdmum1: Unable to download webpage: HTTP Error 403: Forbidden (caused by <HTTPError 403: Forbidden>)", "blocked"),
    ("[Reddit] 6rrwyj: Account authentication is required. Use --cookies-from-browser or --cookies for the authentication.", "login"),
    ("[facebook] 3676516585958356: Cannot parse data; please report this issue on https://github.com/yt-dlp/yt-dlp/issues", "extractor_broken"),
    ("[audiomack] roosh-williams/extraordinary: Failed to parse JSON (caused by JSONDecodeError(\"Expecting value\")); "
     "please report this issue", "extractor_broken"),
    ("cannot access local variable 'programme_id' where it is not associated with a value", "extractor_broken"),
    ("[NDTV] 468818: Unable to extract video filename; please report this issue", "extractor_broken"),
    ("[Imgur] 0bN4nGC: Unable to download JSON metadata: HTTP Error 404: Not Found", "removed"),
    ("[twitter:amplify] 93ad: Unable to download webpage: HTTP Error 500: Domain Not Found", "unknown"),
    ("[XHamster] 1509445: Requested format is not available. Use --list-formats", "extractor_broken"),
    ("[generic] Unsupported URL: https://example.com/x", "unsupported"),
    ("This video is DRM protected", "drm"),
    ("[Piracy] This website is no longer supported since it has been determined to be primarily used for piracy.", "piracy"),
    ("Video unavailable. This video is not available in your country", "geo"),
]


@pytest.mark.parametrize("text,reason", REAL)
def test_classify_real_errors(text, reason):
    assert errors.classify(text) == reason


def test_none_is_unknown():
    assert errors.classify(None) == "unknown"
    assert errors.error_info(None)["reason"] == "unknown"


def test_error_info_strips_boilerplate():
    info = errors.error_info("[NDTV] 468818: Unable to extract video filename; please report this issue on  https://x")
    assert info["detail"] == "[NDTV] 468818: Unable to extract video filename"
    assert info["hint"]


@pytest.mark.parametrize("result,expected", [
    ({"type": "video", "extractor": "youtube", "qualities": [1080]}, True),
    ({"type": "video", "extractor": "rendered", "qualities": [], "is_stream": True}, True),
    ({"type": "video", "extractor": "soundcloud", "audio_only": True, "audio_options": [{"abr": 128}]}, True),
    ({"type": "video", "extractor": "login-required", "qualities": []}, False),
    ({"type": "page", "url": "x", "image_formats": []}, False),
    ({"type": "page", "url": "x", "error": {"reason": "network"}}, False),
    ({"type": "file", "url": "x"}, True),
])
def test_should_cache(result, expected):
    assert errors.should_cache(result) is expected
