#!/usr/bin/env node
// MediaDL smoke tests — hits key endpoints and reports pass/fail.
// Usage: node scripts/smoke-test.mjs   (services must be running)

const API   = process.env.API_URL  ?? 'http://localhost:4000'
const SITE  = process.env.SITE_URL ?? 'http://localhost:3000'
const PY    = process.env.PY_URL   ?? 'http://localhost:8000'

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
  await test('backend /health/deep (redis+mysql+python)', async () => {
    const d = await getJSON(`${API}/health/deep`)
    assert(d.checks.redis === 'ok', `redis ${d.checks.redis}`)
    assert(d.checks.mysql === 'ok', `mysql ${d.checks.mysql}`)
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
  await test('frontend landing 200', async () => {
    const r = await fetch(`${SITE}/`); assert(r.ok, `HTTP ${r.status}`)
  })
  await test('frontend custom 404', async () => {
    const r = await fetch(`${SITE}/__definitely_missing__`); assert(r.status === 404, `HTTP ${r.status}`)
  })

  console.log(results.join('\n'))
  console.log(`\n${pass} passed, ${fail} failed\n`)
  process.exit(fail ? 1 : 0)
}

run().catch((e) => { console.error(e); process.exit(1) })
