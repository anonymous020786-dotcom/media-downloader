#!/usr/bin/env node
// MediaDL smoke tests — hits key endpoints and reports pass/fail.
// Usage: node scripts/smoke-test.mjs   (services must be running)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const API   = process.env.API_URL  ?? 'http://localhost:4000'
const SITE  = process.env.SITE_URL ?? 'http://localhost:3000'
const PY    = process.env.PY_URL   ?? 'http://localhost:8000'

function envVal(key) {
  try {
    return (readFileSync(resolve(HERE, '../.env'), 'utf8').match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '').trim()
  } catch { return '' }
}
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || envVal('INTERNAL_API_KEY')

let pass = 0, fail = 0
const results = []

async function test(name, fn) {
  try {
    await fn()
    results.push(`  \x1b[32m✓\x1b[0m ${name}`); pass++
  } catch (e) {
    results.push(`  \x1b[31m✗\x1b[0m ${name} — ${e.message}`); fail++
  }
}

async function getJSON(url, init) {
  const r = await fetch(url, init)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed') }

async function run() {
  console.log('\nMediaDL smoke tests\n')

  await test('backend /health', async () => {
    const d = await getJSON(`${API}/health`); assert(d.status === 'ok')
  })
  await test('backend /health/deep (python service reachable)', async () => {
    const d = await getJSON(`${API}/health/deep`)
    // Local build: no redis / mysql. The only dependency is the python service.
    assert(d.checks.python === 'ok', `python ${d.checks.python}`)
  })
  await test('python /health/deep engines present', async () => {
    const d = await getJSON(`${PY}/health/deep`)
    assert(d.versions['yt-dlp'], 'yt-dlp missing')
    assert(d.versions['gallery-dl'], 'gallery-dl missing')
  })
  await test('analyze YouTube → video', async () => {
    const d = await getJSON(`${API}/api/analyze`, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }) })
    assert(d.type === 'video', `got ${d.type}`)
  })
  await test('analyze cache hit (2nd call is _cached)', async () => {
    const body = JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    await getJSON(`${API}/api/analyze`, { method:'POST', headers:{'Content-Type':'application/json'}, body })
    const d = await getJSON(`${API}/api/analyze`, { method:'POST', headers:{'Content-Type':'application/json'}, body })
    assert(d._cached === true, 'expected cached result')
  })
  await test('analyze PDF → file', async () => {
    const d = await getJSON(`${API}/api/analyze`, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' }) })
    assert(d.type === 'file', `got ${d.type}`)
  })
  await test('content/faq returns rows', async () => {
    const d = await getJSON(`${API}/api/content/faq`); assert(Array.isArray(d) && d.length > 0)
  })
  await test('jobs/stats responds', async () => {
    const d = await getJSON(`${API}/api/jobs/stats`); assert(typeof d.total === 'number')
  })
  await test('jobs/:id/state responds (bot progress poller)', async () => {
    const d = await getJSON(`${API}/api/jobs/00000000-0000-0000-0000-000000000000/state`)
    assert(typeof d.status === 'string', `got ${JSON.stringify(d)}`)
  })
  await test('stream: proxy a progressive video with NO staging dir', async () => {
    const hdr = { 'Content-Type': 'application/json', ...(INTERNAL_KEY ? { 'X-Internal-Key': INTERNAL_KEY } : {}) }
    const { url } = await getJSON(`${API}/api/stream`, { method: 'POST', headers: hdr,
      body: JSON.stringify({ url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4', format: 'mp4' }) })
    assert(/\/api\/stream\/[0-9a-f-]{36}$/.test(url), `bad link ${url}`)
    const r = await fetch(url, { headers: { Range: 'bytes=0-1048575' } })
    assert(r.ok, `stream GET → ${r.status}`)
    const buf = Buffer.from(await r.arrayBuffer())
    assert(buf.length > 100_000, `only got ${buf.length} bytes`)
    assert(buf.subarray(4, 8).toString() === 'ftyp', 'not an MP4')
  })
  await test('stream: YouTube DASH quality rejects at POST (routed to queue)', async () => {
    const hdr = { 'Content-Type': 'application/json', ...(INTERNAL_KEY ? { 'X-Internal-Key': INTERNAL_KEY } : {}) }
    const r = await fetch(`${API}/api/stream`, { method: 'POST', headers: hdr,
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', quality: '1080', format: 'mp4' }) })
    assert(r.status === 422, `expected 422, got ${r.status}`)
  })
  await test('stream: playlist link rejects at POST (422 → caller falls back to queue)', async () => {
    const hdr = { 'Content-Type': 'application/json', ...(INTERNAL_KEY ? { 'X-Internal-Key': INTERNAL_KEY } : {}) }
    const r = await fetch(`${API}/api/stream`, { method: 'POST', headers: hdr,
      body: JSON.stringify({ url: 'https://www.youtube.com/playlist?list=PLBCF2DAC6FFB574DE' }) })
    assert(r.status === 422, `expected 422, got ${r.status}`)
  })
  await test('storage endpoints removed (404)', async () => {
    for (const u of [`${API}/api/storage`, `${API}/api/storage/disk`, `${PY}/storage`, `${PY}/storage/disk`]) {
      const r = await fetch(u); assert(r.status === 404, `${u} → ${r.status}`)
    }
  })
  await test('format-converter removed (404)', async () => {
    const page = await fetch(`${SITE}/tools/convert`)
    assert(page.status === 404, `web page → ${page.status}`)
    for (const u of [`${API}/api/download/convert`, `${PY}/convert`]) {
      const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      assert(r.status === 404, `${u} → ${r.status}`)
    }
  })
  await test('turnstile guards downloads / internal key bypasses', async () => {
    const body = JSON.stringify({ url: 'https://example.com', mediaType: 'video' })
    const blocked = await fetch(`${API}/api/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    if (blocked.status === 200) return // turnstile not configured — nothing to check
    assert(blocked.status === 403, `expected 403 without token, got ${blocked.status}`)
    assert(INTERNAL_KEY, 'INTERNAL_API_KEY not found — cannot verify bypass')
    const ok = await fetch(`${API}/api/download`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-Key': INTERNAL_KEY }, body,
    })
    assert(ok.status === 200, `internal key did not bypass turnstile (${ok.status})`)
    const { jobId } = await ok.json()
    if (jobId) await fetch(`${API}/api/jobs/${jobId}`, { method: 'DELETE' }).catch(() => {})
  })
  await test('analyze Instagram photo → page, reel → video', async () => {
    const hdr = { 'Content-Type': 'application/json', ...(INTERNAL_KEY ? { 'X-Internal-Key': INTERNAL_KEY } : {}) }
    const photo = await getJSON(`${API}/api/analyze`, { method: 'POST', headers: hdr,
      body: JSON.stringify({ url: 'https://www.instagram.com/p/Cq6cM7-Loce/' }) })
    assert(photo.type === 'page', `photo post got ${photo.type}, expected page`)
    const reel = await getJSON(`${API}/api/analyze`, { method: 'POST', headers: hdr,
      body: JSON.stringify({ url: 'https://www.instagram.com/reel/Csmoke00test/' }) })
    assert(reel.type === 'video', `reel got ${reel.type}, expected video`)
  })
  await test('frontend landing 200', async () => {
    const r = await fetch(`${SITE}/`); assert(r.ok, `HTTP ${r.status}`)
  })

  const botToken = process.env.TELEGRAM_BOT_TOKEN || envVal('TELEGRAM_BOT_TOKEN')
  if (botToken) {
    await test('telegram bot token valid + update source clear', async () => {
      const me = await getJSON(`https://api.telegram.org/bot${botToken}/getMe`)
      assert(me.ok && me.result?.is_bot, 'getMe failed')
      const wh = await getJSON(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
      // Local build polls — a webhook URL here would mean updates go elsewhere.
      assert(!wh.result?.url, `unexpected webhook: ${wh.result?.url}`)
    })
  }
  await test('frontend renders not-found for unknown route', async () => {
    const r = await fetch(`${SITE}/__definitely_missing__`)
    const body = await r.text()
    // `next dev --turbopack` streams the shell with 200 even for notFound(); a
    // production build returns a real 404. Accept either, but the not-found UI
    // must actually render.
    assert(r.status === 404 || /not found|404|page could/i.test(body), `HTTP ${r.status}, no not-found UI`)
  })

  console.log(results.join('\n'))
  console.log(`\n${pass} passed, ${fail} failed\n`)
  process.exit(fail ? 1 : 0)
}

run().catch((e) => { console.error(e); process.exit(1) })
