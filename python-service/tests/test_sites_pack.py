import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "python-service"))
import sites_pack  # noqa: E402


def test_shared_list_matches_registry():
    shared = json.loads((ROOT / "shared" / "adult-domains.json").read_text(encoding="utf-8"))
    assert shared["domains"] == list(sites_pack.ADULT_DOMAINS)


def test_registry_has_all_82_ranks():
    assert [r for r, *_ in sites_pack.SITES] == list(range(1, 83))


def test_lookup_matches_subdomains():
    assert sites_pack.lookup("https://de.xhamster.com/videos/x-1")["group"] == "native"
    assert sites_pack.is_adult("https://www.pornhat.com/video/abc/")
    assert not sites_pack.is_adult("https://www.youtube.com/watch?v=x")
    assert not sites_pack.is_adult("https://notpornhub.com.evil.example/")


def test_proxy_only_for_pack_domains(monkeypatch):
    monkeypatch.setenv("SITEPACK_PROXY", "socks5://10.0.0.5:1080")
    assert sites_pack.proxy_for("https://zbporn.com/v/1") == "socks5://10.0.0.5:1080"
    assert sites_pack.proxy_for("https://www.sonyliv.com/x") is None
    assert sites_pack.proxy_for("https://zbporn.com/v/1", "http://mine:8080") == "http://mine:8080"
    monkeypatch.delenv("SITEPACK_PROXY")
    assert sites_pack.proxy_for("https://zbporn.com/v/1") is None
