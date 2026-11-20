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


def test_pl18_sites_are_looked_up_and_adult():
    e = sites_pack.lookup("https://www.upornia.com/videos/123/x/")
    assert e == {"rank": None, "name": "Upornia", "domain": "upornia.com", "group": "native"}
    assert sites_pack.is_adult("https://homemoviestube.com/videos/1/x.html")
    assert sites_pack.lookup("https://myfreecams.com/#x")["group"] == "cam"
    assert sites_pack.lookup("https://www.porntube.com/videos/x_1")["group"] == "native"
    domains = [d for _, d, _ in sites_pack.PL18_SITES + sites_pack.PL18_UNPROBED]
    assert len(domains) == len(set(domains))
    assert not set(domains) & {d for _, _, d, _ in sites_pack.SITES}
    assert not set(domains) & set(sites_pack.EXCLUDED)
    assert {g for *_, g in sites_pack.PL18_UNPROBED} <= {"native", "tube", "aggregator", "cam"}


def test_excluded_sites_are_refused():
    assert sites_pack.excluded_reason("https://xmaal.in/double-dhamaka/") == "piracy"
    assert sites_pack.excluded_reason("https://cdn.boldmaal.com/videos/x.mp4") == "piracy"
    assert sites_pack.excluded_reason("https://www.desihub.sh/v/1") == "ncii"
    assert sites_pack.excluded_reason("https://sxyprn.com/post/1") == "piracy"
    assert sites_pack.excluded_reason("https://upornia.com/videos/1/") is None
    assert sites_pack.is_adult("https://xmaal.in/double-dhamaka/")
    # an excluded site is never also listed as supported
    assert not set(sites_pack.EXCLUDED) & {d for _, d, _ in sites_pack.PL18_SITES}


def test_proxy_only_for_pack_domains(monkeypatch):
    monkeypatch.setenv("SITEPACK_PROXY", "socks5://10.0.0.5:1080")
    assert sites_pack.proxy_for("https://zbporn.com/v/1") == "socks5://10.0.0.5:1080"
    assert sites_pack.proxy_for("https://www.sonyliv.com/x") is None
    assert sites_pack.proxy_for("https://zbporn.com/v/1", "http://mine:8080") == "http://mine:8080"
    monkeypatch.delenv("SITEPACK_PROXY")
    assert sites_pack.proxy_for("https://zbporn.com/v/1") is None
