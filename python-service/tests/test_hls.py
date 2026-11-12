import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import hls  # noqa: E402

LIVE = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:40\n#EXTINF:2.0,\nlive40.ts\n#EXTINF:2.0,\nlive41.ts\n"
VOD = LIVE + "#EXT-X-ENDLIST\n"
VOD_TYPED = "#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXTINF:2.0,\na.ts\n"
MASTER = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\nlow/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2000000\nhi/index.m3u8\n"


def test_live_vs_vod():
    assert hls.media_playlist_is_live(LIVE)
    assert not hls.media_playlist_is_live(VOD)
    assert not hls.media_playlist_is_live(VOD_TYPED)
    assert not hls.media_playlist_is_live("<html>not a playlist</html>")


def test_master_first_variant():
    assert hls.is_master(MASTER)
    assert hls.first_variant(MASTER, "https://cdn.example/x/master.m3u8") == "https://cdn.example/x/low/index.m3u8"
    assert hls.first_variant("#EXTM3U\n", "https://e/") is None
