"""KVS patch tests — fixture is trimmed from the real kvs-demo.com page (KVS player 1.0.10,
randomised flashvars name), captured 2026-11-12."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import kvs_patch  # noqa: E402

FIX = Path(__file__).parent / "fixtures" / "kvs_demo_v1.html"
URL = "https://www.kvs-demo.com/video/105/kelis-4th-of-july/"


def test_finds_randomised_name():
    assert kvs_patch.find_flashvars_name(FIX.read_text(encoding="utf-8")) == "t0f510b81fd"


def test_finds_legacy_name():
    html = "<script>var flashvars = {video_id: '1'}; kt_player('a','b','c','d', flashvars);</script>"
    assert kvs_patch.find_flashvars_name(html) == "flashvars"


def test_none_without_player():
    assert kvs_patch.find_flashvars_name("<html><video src='x.mp4'></video></html>") is None


def test_extract_formats_from_fixture():
    import yt_dlp
    from yt_dlp.extractor.generic import GenericIE

    assert kvs_patch.apply()
    ie = GenericIE(yt_dlp.YoutubeDL({"quiet": True}))
    info = ie._extract_kvs(URL, FIX.read_text(encoding="utf-8"), "105")
    assert info["id"] == "105"
    assert info["title"] == "Kelis - 4th Of July"
    heights = sorted(f["height"] for f in info["formats"])
    assert heights == [480, 720]
    for f in info["formats"]:
        assert "/get_file/" in f["url"] and f["http_headers"]["Referer"] == URL


def test_obfuscated_url_still_decoded():
    """function/0/ URLs go through yt-dlp's own license-code de-obfuscation."""
    from yt_dlp.extractor.generic import GenericIE

    kvs_patch.apply()
    raw = "function/0/https://x.com/get_file/1/0123456789abcdef0123456789abcdef/1000/1001/1001.mp4/"
    out = GenericIE._kvs_get_real_url(raw, "$123456789012345")
    assert out.startswith("https://x.com/get_file/1/") and not out.startswith("function/")
    assert sorted(out.split("/")[5]) == sorted("0123456789abcdef0123456789abcdef")
