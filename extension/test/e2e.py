"""End-to-end test of the built Chromium extension against a running MediaDL.

    python extension/test/e2e.py <unpacked-extension-dir> <site-base-url> [screenshot-dir]

Needs: MediaDL API on http://localhost:4000 (+ python service), the fixture site
from fixtures.py served at <site-base-url>, and `playwright install chromium`.
Uses only local fixtures — no internet needed.
"""
import json
import sys
import tempfile
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
EXT = Path(sys.argv[1]).resolve()
SITE = sys.argv[2].rstrip("/")
SHOTS = Path(sys.argv[3]).resolve() if len(sys.argv) > 3 else None
VIDEO, VIDEO2 = f"{SITE}/video.mp4", f"{SITE}/video2.mp4"
results = []
page_errors = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {str(detail)[:400]}" if detail else ""), flush=True)


def shot(page, name):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)


def until(fn, timeout=60, every=0.5):
    end = time.time() + timeout
    last = None
    while time.time() < end:
        last = fn()
        if last:
            return last
        time.sleep(every)
    return last


def local_jobs(pg):
    return pg.evaluate("async () => (await chrome.storage.local.get('jobs')).jobs || []")


def wait_jobs(pg, job_ids, timeout=150):
    def done():
        js = {j["jobId"]: j for j in local_jobs(pg)}
        return all(js.get(i, {}).get("status") in ("completed", "failed", "cancelled") for i in job_ids) and js
    js = until(done, timeout, 2) or {j["jobId"]: j for j in local_jobs(pg)}
    return [js.get(i, {}) for i in job_ids]


def downloads(pg):
    return pg.evaluate("async () => (await chrome.downloads.search({})).map(d => ({u: d.url, s: d.state}))")


with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(prefix="mdl-e2e-"), channel="chromium", headless=True,
                                               args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"])
    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker", timeout=20000)
    ext_id = sw.url.split("/")[2]
    check("extension loads", ext_id)
    opened = until(lambda: any("options.html" in (u or "") for u in
                               [pg.url for pg in ctx.pages] + sw.evaluate("async () => (await chrome.tabs.query({})).map(t => t.url || t.pendingUrl)")), 10)
    check("settings page opens on install", opened)

    def ext_page(path):
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: page_errors.append(f"{path}: {e}"))
        pg.goto(f"chrome-extension://{ext_id}/{path}")
        return pg

    # ── popup ─────────────────────────────────────────────────────────────
    popup = ext_page("popup.html")
    ok = until(lambda: "ok" in (popup.get_attribute("#server", "class") or "") or "bad" in (popup.get_attribute("#server", "class") or ""), 15)
    check("popup reaches server", "ok" in (popup.get_attribute("#server", "class") or ""), popup.get_attribute("#server", "title"))

    popup.fill("#url", VIDEO)
    popup.click("#analyze")
    popup.wait_for_selector("#info:not([hidden])", timeout=60000)
    check("analyze a link", popup.text_content("#title"), popup.text_content("#sub"))
    check("advanced options render in popup (all 7 sections)", popup.locator("#adv fieldset").count() == 7)
    shot(popup, "popup-analyze")

    # remembered vs one-shot advanced options
    popup.click("#advBox summary")
    popup.check("[data-adv=normalizeAudio]")
    popup.fill("[data-adv=delayMinutes]", "30"); popup.dispatch_event("[data-adv=delayMinutes]", "change")
    popup.select_option("[data-adv=repeatEvery]", "daily")
    time.sleep(0.5)
    adv = popup.evaluate("async () => (await chrome.storage.sync.get('adv')).adv || {}")
    check("advanced choices remembered, but not delay/repeat", adv.get("normalizeAudio") is True and "delayMinutes" not in adv and "repeatEvery" not in adv, json.dumps(adv))
    popup.uncheck("[data-adv=normalizeAudio]")
    popup.fill("[data-adv=delayMinutes]", ""); popup.dispatch_event("[data-adv=delayMinutes]", "change")
    popup.select_option("[data-adv=repeatEvery]", "")

    popup.click("#download")
    popup.wait_for_selector("#tab-jobs:not([hidden])", timeout=15000)
    [j] = wait_jobs(popup, [local_jobs(popup)[0]["jobId"]])
    check("video download completes", j.get("status") == "completed", json.dumps(j))
    check("auto-saved via browser downloads", until(lambda: any("/api/files/" in d["u"] and d["s"] == "complete" for d in downloads(popup)), 20))

    sw.evaluate(f"() => queueWithDefaults({json.dumps(VIDEO2)}, {{ audio: true, title: 'audio test' }})")
    time.sleep(3)
    [j] = wait_jobs(popup, [local_jobs(popup)[0]["jobId"]])
    check("audio-only (mp3) via right-click path", j.get("status") == "completed" and j.get("kind") == "audio", json.dumps(j))
    check("mp3 saved", until(lambda: any(d["u"].lower().endswith(".mp3") and d["s"] == "complete" for d in downloads(popup)), 20))

    r = popup.evaluate(f"async () => {{ try {{ return await (await chrome.runtime.sendMessage({{type: 'stream', url: {json.dumps(VIDEO)}, opts: {{format: 'mp4'}}}})) }} catch (e) {{ return {{ok: false, error: e.message}} }} }}")
    check("stream link starts a direct download", r.get("ok"), json.dumps(r))
    check("stream download completes", until(lambda: any("/api/stream/" in d["u"] and d["s"] == "complete" for d in downloads(popup)), 40))

    # Found tab
    site = ctx.new_page(); site.goto(f"{SITE}/test.html")
    tab_id = popup.evaluate(f"async () => (await chrome.tabs.query({{url: '{SITE}/*'}}))[0].id")
    popup.evaluate(f"async () => {{ tab = await chrome.tabs.get({tab_id}); found = null; selectTab('found'); await renderFound() }}")
    names = popup.eval_on_selector_all("#foundList .name", "n => n.map(x => x.textContent)")
    check("Found tab: video, audio, file link, magnet", len(names) >= 4, " | ".join(names))

    # cookies → server
    r = popup.evaluate("""async () => {
        const text = toNetscapeCookies([{domain: '.e2e-test.invalid', path: '/', secure: true, expirationDate: 2000000000, name: 'sid', value: 'x'}])
        const saved = await api('/api/cookies', {method: 'POST', body: {domain: 'e2e-test.invalid', cookies: text, label: 'e2e'}})
        return saved }""")
    check("cookie sync to server", r.get("domain") == "e2e-test.invalid", json.dumps(r))

    # ── full app ──────────────────────────────────────────────────────────
    app = ext_page("app.html")
    views = app.eval_on_selector_all("#nav a[data-view]", "a => a.map(x => x.dataset.view)")
    for v in views:
        app.evaluate(f"() => show('{v}')"); time.sleep(0.6)
    check(f"app: all {len(views)} views open", len(views) >= 11, ", ".join(views))

    def app_toast():
        t = app.locator("#toast")
        return t.text_content() if t.is_visible() else ""

    # batch
    app.evaluate("() => show('batch')")
    app.fill("#bText", f"{VIDEO}\n{VIDEO2}\nnot a link\n{VIDEO}")
    app.dispatch_event("#bText", "input")
    check("batch counts valid unique links", "2 links" in app.text_content("#bCount"), app.text_content("#bCount"))
    before = {j["jobId"] for j in local_jobs(app)}
    app.click("#bBar button.primary")
    new = until(lambda: [j["jobId"] for j in local_jobs(app) if j["jobId"] not in before] if len(local_jobs(app)) >= len(before) + 2 else None, 20) or []
    js = wait_jobs(app, new)
    check("batch: 2 downloads complete", len(js) == 2 and all(j.get("status") == "completed" for j in js), json.dumps([j.get("status") for j in js]))

    # gallery
    app.evaluate(f"() => show('gallery', {{ url: '{SITE}/gallery.html' }})")
    n = until(lambda: app.locator("#gGrid label").count(), 60)
    check("gallery finds page images", n and n >= 3, n)
    shot(app, "app-gallery")
    before = {j["jobId"] for j in local_jobs(app)}
    app.click("#gGo")
    new = until(lambda: [j["jobId"] for j in local_jobs(app) if j["jobId"] not in before] or None, 20) or []
    js = wait_jobs(app, new)
    check("gallery: images downloaded", len(js) >= 3 and all(j.get("status") == "completed" for j in js), json.dumps([j.get("status") for j in js]))

    # feeds
    for feed, kind in (("list.m3u", "M3U"), ("feed.xml", "RSS")):
        app.evaluate("() => show('feed')")
        app.fill("#fUrl", f"{SITE}/{feed}"); app.click("#fLoad")
        until(lambda: kind in (app.text_content("#fHead") or ""), 40)
        n = app.locator("#fList li").count()
        check(f"feed loads ({feed})", n == 2, f"{n} items · {app.text_content('#fHead')}")

    # delayed + recurring
    app.evaluate(f"() => show('download', {{ url: '{VIDEO}' }})")
    until(lambda: app.locator("#dInfo").is_visible(), 60)
    app.fill("#dAdv [data-adv=delayMinutes]", "30")
    app.click("#dGo"); time.sleep(2)
    j = local_jobs(app)[0]
    check("start-later job is queued with a start time", j.get("startsAt") and j.get("status") == "queued", json.dumps(j))
    app.evaluate(f"async () => chrome.runtime.sendMessage({{type: 'cancel', jobId: '{j['jobId']}'}})")
    app.fill("#dAdv [data-adv=delayMinutes]", "")
    app.select_option("#dAdv [data-adv=repeatEvery]", "daily")
    app.click("#dGo")
    check("repeat creates a schedule", until(lambda: "Scheduled" in app_toast(), 15), app_toast())
    app.select_option("#dAdv [data-adv=repeatEvery]", "")
    app.evaluate("() => show('schedules')")
    n = until(lambda: app.locator("#schList li").count(), 15)
    check("schedule listed", n and n >= 1, n)
    app.on("dialog", lambda d: d.accept())
    for _ in range(n or 0):
        app.locator("#schList li button.danger").first.click(); time.sleep(1.5)
    check("schedule deleted", until(lambda: app.locator("#schList li").count() == 0, 15))

    # queue + files + player
    app.evaluate("() => show('queue')")
    n = until(lambda: app.locator("#qList li").count() >= 7 and app.locator("#qList li").count(), 15)
    check("server queue lists every finished job", n and n >= 7, n)
    app.locator("#qList li", has_text="video.mp4").first.locator("button", has_text="Files").click()
    check("queue: files of a finished job", until(lambda: app.locator("#qList .files .line").count(), 15))
    check("no stray 'null' text in the queue", "null" not in app.text_content("#qList"))
    shot(app, "app-queue")
    play = app.locator("#qList .files button", has_text="Play")
    if play.count():
        play.first.click()
        check("player loads the video", until(lambda: app.evaluate("() => $('plVideo').readyState >= 1"), 20))
    else:
        check("player loads the video", False, "no playable file listed")

    # proxies
    app.evaluate("() => show('proxies')")
    app.fill("#xLabel", "e2e dead proxy"); app.fill("#xUrl", "socks5://127.0.0.1:9")
    app.click("#xAdd")
    check("proxy saved", until(lambda: app.locator("#xSaved li", has_text="e2e dead proxy").count(), 15))
    app.locator("#xSaved li", has_text="e2e dead proxy").locator("button", has_text="Test").click()
    check("proxy test reports failure clearly", until(lambda: "❌" in app_toast(), 75), app_toast())
    app.locator("#xSaved li", has_text="e2e dead proxy").locator("button.danger").click()
    check("proxy deleted", until(lambda: app.locator("#xSaved li", has_text="e2e dead proxy").count() == 0, 15))

    # cookies manager
    app.evaluate("() => show('cookies')")
    row = app.locator("#cList li", has_text="e2e-test.invalid")
    check("cookies listed in app", until(lambda: row.count(), 15))
    row.locator("button.danger").click()
    check("cookies deleted", until(lambda: row.count() == 0, 15))

    # status
    app.evaluate("() => show('status')")
    check("status shows engines", until(lambda: "Download engines" in app.text_content("#stBox"), 20), app.text_content("#stBox")[:200])
    check("no stray 'null' text on status", "null" not in app.text_content("#stBox"), app.text_content("#stBox")[:120])
    shot(app, "app-status")

    # options page
    opt = ext_page("options.html")
    check("options: default advanced options, without per-download ones",
          until(lambda: opt.locator("#adv fieldset:not([hidden])").count() >= 5, 10) and opt.locator("[data-adv=repeatEvery]").is_hidden())
    shot(opt, "options")

    check("no script errors on any extension page", not page_errors, "; ".join(page_errors))
    ctx.close()

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
