# Site probes (research / scratch)

One-off reverse-engineering scripts used to work out how certain hosts serve
their media, so the findings could be implemented in the actual service.

**These are NOT part of the running app.** They are not imported or executed by
the project. The production support that resulted from this research lives in
[`python-service/main.py`](../../python-service/main.py):

- pat.com → `_analyze_pat_com`, `_pat_get_token`, `_PAT_CDN_RE`, `_PAT_COM_RE`
- mixdrop → `_resolve_mixdrop`, `_dl_mixdrop`
- gofile / generic embed hosts → the embed-host handlers

| Script | What it investigated |
|--------|----------------------|
| `pat_probe.py` … `pat_probe8.py` | Locating pat.com's JS bundle / hidden API across iterations |
| `pat_api_probe.py` | Finding the API that maps a pat.com slug → signed CDN URL |
| `pat_cdn_probe.py` | Decoding the pat.com CDN URL structure (key/data/media/quality/file_id) |
| `probe_mixdrop.py` | Reverse-engineering Mixdrop's player/API |
| `probe_sites.py` / `2` / `3` | Probing multiple hosts' download mechanisms |

Any captured signed-CDN tokens have been scrubbed to `REDACTED_*` placeholders —
those tokens are short-lived and expire. To re-run a probe, paste a fresh token
copied from the browser network tab.
