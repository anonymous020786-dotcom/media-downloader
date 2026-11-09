"""Builds an offline test site for the extension e2e test.

    python extension/test/fixtures.py <out_dir> <base_url>

Creates: video.mp4 (3 s, with an AAC audio track), video2.mp4, tone.ogg,
img1-3.png, test.html (page with <video>/<audio>/links/magnet),
gallery.html (3 images), list.m3u (2 entries), feed.xml (RSS with enclosures).
Needs ffmpeg on PATH and Pillow.
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
base = sys.argv[2].rstrip("/")


def ff(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


for name, freq in (("video.mp4", 440), ("video2.mp4", 660)):
    ff("-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=3",
       "-f", "lavfi", "-i", f"sine=frequency={freq}:duration=3",
       "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(out / name))
ff("-f", "lavfi", "-i", "sine=frequency=330:duration=2", "-c:a", "libvorbis", str(out / "tone.ogg"))

for i, col in enumerate([(220, 60, 60), (60, 160, 90), (60, 90, 220)], 1):
    im = Image.new("RGB", (320, 200), col)
    ImageDraw.Draw(im).text((20, 20), f"test image {i}", fill="white")
    im.save(out / f"img{i}.png")

(out / "test.html").write_text(f"""<!doctype html><title>MediaDL test page</title>
<video controls title="Test clip" src="{base}/video.mp4"></video>
<audio controls><source src="{base}/tone.ogg"></audio>
<a href="{base}/report.pdf">Annual report</a>
<a href="magnet:?xt=urn:btih:0000000000000000000000000000000000000000&dn=test">Magnet</a>
""", encoding="utf-8")
(out / "report.pdf").write_bytes(b"%PDF-1.4\n%test\n")

(out / "gallery.html").write_text("<!doctype html><title>Gallery test</title>" + "".join(
    f'<img src="{base}/img{i}.png" width="320" height="200">' for i in (1, 2, 3)), encoding="utf-8")

(out / "list.m3u").write_text(f"#EXTM3U\n#EXTINF:3,Clip one\n{base}/video.mp4\n#EXTINF:3,Clip two\n{base}/video2.mp4\n", encoding="utf-8")

(out / "feed.xml").write_text(f"""<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test podcast</title><link>{base}/</link><description>t</description>
<item><title>Episode 1</title><enclosure url="{base}/video.mp4" type="video/mp4" length="1"/><guid>1</guid></item>
<item><title>Episode 2</title><enclosure url="{base}/video2.mp4" type="video/mp4" length="1"/><guid>2</guid></item>
</channel></rss>""", encoding="utf-8")
print(f"fixtures written to {out}")
