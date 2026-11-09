/* global ext, getSettings, api, buildDownload, isHttpUrl, fmtBytes, fmtDuration,
          cleanDomain, toNetscapeCookies, readCookies, DEFAULT_SETTINGS,
          renderAdvanced, readAdvanced, advancedSummary, stickyAdv */
const $ = (id) => document.getElementById(id)
const VIDEO_FORMATS = ['mp4', 'webm', 'mkv']
const AUDIO_FORMATS = ['mp3', 'm4a', 'opus', 'flac', 'wav', 'ogg']
const DIRECT_TYPES = new Set(['image', 'page', 'file', 'torrent'])

let settings = { ...DEFAULT_SETTINGS }
let tab = null          // active tab
let analysis = null     // last /api/analyze result for $('url')

// ── helpers ─────────────────────────────────────────────────────────────────
async function send(type, extra = {}) {
  const r = await ext.runtime.sendMessage({ type, ...extra })
  if (!r?.ok) throw new Error(r?.error || 'Extension error')
  return r.data
}
function show(el, text, kind = '') {
  el.hidden = !text
  el.textContent = text || ''
  el.className = `msg ${kind}`
}
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn)
    else if (k in n) n[k] = v
    else n.setAttribute(k, v)
  }
  for (const k of kids) if (k != null) n.append(k)
  return n
}
function busy(btn, text) {
  const old = btn.textContent
  btn.disabled = true; btn.textContent = text
  return () => { btn.disabled = false; btn.textContent = old }
}

// ── tabs ────────────────────────────────────────────────────────────────────
function selectTab(name) {
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name))
  for (const p of document.querySelectorAll('.panel')) p.hidden = p.id !== `tab-${name}`
  if (name === 'found') renderFound()
  if (name === 'jobs') refreshJobs()
}
for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => selectTab(b.dataset.tab))
$('openOptions').addEventListener('click', () => ext.runtime.openOptionsPage())
function openApp(view, params = {}) {
  const q = new URLSearchParams({ view, ...params }).toString()
  ext.tabs.create({ url: ext.runtime.getURL(`app.html?${q}`) })
  window.close()
}
$('openApp').addEventListener('click', () => openApp('download', isHttpUrl($('url').value) ? { url: $('url').value.trim() } : {}))

// ── server status ───────────────────────────────────────────────────────────
async function checkServer() {
  const dot = $('server')
  try {
    const h = await api('/health', { timeoutMs: 5000 })
    dot.className = 'dot ok'; dot.title = `Server OK (v${h.version ?? '?'}) — ${settings.serverUrl}`
    return true
  } catch (e) {
    dot.className = 'dot bad'; dot.title = e.message
    return false
  }
}

// ── This page: options ──────────────────────────────────────────────────────
function kind() { return document.querySelector('input[name=kind]:checked').value }

function fillFormats() {
  const audio = kind() === 'audio'
  const list = audio ? AUDIO_FORMATS : VIDEO_FORMATS
  const want = audio ? settings.audioFormat : settings.videoFormat
  $('format').replaceChildren(...list.map((f) => el('option', { value: f, textContent: f.toUpperCase(), selected: f === want })))
  $('quality').disabled = audio
}

function fillQualities(a) {
  const opts = [el('option', { value: 'best', textContent: 'Best available' })]
  const sizes = new Map((a?.format_options || []).map((f) => [f.height, f.size]))
  const qs = [...new Set(a?.qualities || [])].filter(Boolean).sort((x, y) => y - x)
  for (const q of qs) {
    const size = sizes.get(q)
    opts.push(el('option', { value: String(q), textContent: `${q}p${size ? ` · ~${fmtBytes(size)}` : ''}` }))
  }
  $('quality').replaceChildren(...opts)
  $('quality').value = qs.includes(Number(settings.quality)) ? settings.quality : 'best'
}

async function remember(patch) {
  Object.assign(settings, patch)
  await ext.storage.sync.set(patch)
}

for (const r of document.querySelectorAll('input[name=kind]')) {
  r.addEventListener('change', () => { remember({ kind: kind() }); fillFormats() })
}
$('format').addEventListener('change', () => {
  remember(kind() === 'audio' ? { audioFormat: $('format').value } : { videoFormat: $('format').value })
})
$('quality').addEventListener('change', () => remember({ quality: $('quality').value }))

function onAdvChange(a) {
  $('advSummary').textContent = advancedSummary(a) ? `· ${advancedSummary(a)}` : ''
  remember({ adv: stickyAdv(a) })   // clip / delay / repeat are never remembered
}

// ── This page: analyze ──────────────────────────────────────────────────────
async function analyze() {
  const url = $('url').value.trim()
  analysis = null
  $('info').hidden = true
  if (!isHttpUrl(url)) { show($('pageMsg'), url ? 'Enter a full http(s) link.' : ''); setMode(null); return }
  const done = busy($('analyze'), '…')
  show($('pageMsg'), 'Looking up this link…')
  try {
    analysis = await api('/api/analyze', { method: 'POST', body: { url }, timeoutMs: 90_000 })
    renderInfo(analysis)
    show($('pageMsg'), '')
  } catch (e) {
    show($('pageMsg'), `${e.message}\nYou can still try "auto-detect" below.`, 'err')
  } finally { done(); setMode(analysis) }
}

function renderInfo(a) {
  $('info').hidden = false
  $('title').textContent = a.title || a.filename || $('url').value
  const bits = [
    a.type && a.type[0].toUpperCase() + a.type.slice(1),
    a.is_live && '🔴 live',
    fmtDuration(a.duration),
    a.playlist_count && `${a.playlist_count} items`,
    a.size && fmtBytes(a.size),
    a.uploader, a.extractor,
  ].filter(Boolean)
  $('sub').textContent = bits.join(' · ')
  $('thumb').hidden = !a.thumbnail
  if (a.thumbnail) $('thumb').src = a.thumbnail
  fillQualities(a)
}

function setMode(a) {
  const type = a?.type
  const direct = DIRECT_TYPES.has(type)
  document.querySelector('.seg').hidden = direct
  $('quality').closest('.grid2').hidden = direct
  const list = type === 'playlist' || type === 'profile' || !!a?.is_playlist
  $('playlistBox').hidden = !list
  $('pickItems').hidden = !list
  $('pickImages').hidden = !(type === 'page' || type === 'image')
  $('pickRow').hidden = $('pickItems').hidden && $('pickImages').hidden
  $('stream').hidden = direct || list
  $('download').textContent = direct ? `⬇ Download ${type}` : list ? '⬇ Download all' : '⬇ Download'
}
$('pickItems').addEventListener('click', () => openApp('playlist', { url: $('url').value.trim() }))
$('pickImages').addEventListener('click', () => openApp('gallery', { url: $('url').value.trim() }))

$('analyze').addEventListener('click', analyze)
$('url').addEventListener('keydown', (e) => { if (e.key === 'Enter') analyze() })

// ── This page: download ─────────────────────────────────────────────────────
$('download').addEventListener('click', async () => {
  const url = $('url').value.trim()
  if (!isHttpUrl(url) && !/^magnet:/i.test(url)) return show($('pageMsg'), 'Enter a link first.', 'err')
  const s = { ...settings, kind: kind(), quality: $('quality').value }
  s[s.kind === 'audio' ? 'audioFormat' : 'videoFormat'] = $('format').value
  const type = analysis?.type || 'video'
  const extra = { title: analysis?.title || analysis?.filename || tab?.title, thumbnail: analysis?.thumbnail }
  if (DIRECT_TYPES.has(type)) Object.assign(extra, { mediaType: type, format: 'original' })
  if (type === 'playlist' || type === 'profile' || analysis?.is_playlist) {
    extra.mediaType = type === 'profile' ? 'profile' : 'playlist'
    if ($('maxItems').value) extra.maxItems = Number($('maxItems').value)
    extra.startIndex = Number($('startIndex').value) || 1
  }
  const done = busy($('download'), 'Sending…')
  try {
    const body = buildDownload(url, s, extra, readAdvanced($('adv')))
    const r = await send('queue', { payload: { url, title: extra.title, mode: 'custom', body } })
    if (r.recurring) return show($('pageMsg'), `🔁 Scheduled to run ${r.recurring}. Manage it under Schedules in the full app (⤢).`, 'ok')
    if (body.delaySeconds) show($('pageMsg'), `⏰ Queued — starts in ${Math.round(body.delaySeconds / 60)} min.`, 'ok')
    selectTab('jobs')
  } catch (e) { show($('pageMsg'), e.message, 'err') } finally { done() }
})

$('stream').addEventListener('click', async () => {
  const url = $('url').value.trim()
  if (!isHttpUrl(url)) return
  const audio = kind() === 'audio'
  const done = busy($('stream'), 'Starting…')
  try {
    await send('stream', { url, opts: { format: $('format').value, quality: audio ? 'best' : $('quality').value } })
    show($('pageMsg'), '✅ Downloading straight from the site — watch your browser’s Downloads.', 'ok')
  } catch (e) { show($('pageMsg'), `${e.message}
Use ⬇ Download instead — it handles more sites.`, 'err') } finally { done() }
})

$('quick').addEventListener('click', async () => {
  const url = $('url').value.trim()
  if (!url) return
  const done = busy($('quick'), 'Working…')
  try {
    await send('queueSmart', { url, opts: { audio: kind() === 'audio', title: analysis?.title || tab?.title } })
    selectTab('jobs')
  } catch (e) { show($('pageMsg'), e.message, 'err') } finally { done() }
})

// ── Found on page ───────────────────────────────────────────────────────────
// Runs inside the page (via activeTab — no blanket site access needed).
function scanPage() {
  const out = []; const seen = new Set(); let blob = false
  const add = (raw, kind, label) => {
    let url
    try { url = new URL(raw, location.href).href } catch { return }
    if (url.startsWith('blob:')) { blob = true; return }
    if (!/^https?:/i.test(url) || seen.has(url)) return
    seen.add(url)
    out.push({ url, kind, label: (label || '').trim().slice(0, 120) })
  }
  for (const m of document.querySelectorAll('video, audio')) {
    const k = m.tagName.toLowerCase()
    const label = m.getAttribute('title') || m.getAttribute('aria-label') || document.title
    if (m.currentSrc) add(m.currentSrc, k, label)
    else if (m.src) add(m.src, k, label)
    for (const s of m.querySelectorAll('source[src]')) add(s.getAttribute('src'), k, label)
  }
  for (const p of ['og:video', 'og:video:url', 'og:video:secure_url', 'og:audio', 'twitter:player:stream']) {
    const c = document.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.content
    if (c) add(c, p.includes('audio') ? 'audio' : 'video', document.title)
  }
  const re = /\.(mp4|m4v|webm|mkv|mov|avi|m3u8|mpd|mp3|m4a|aac|ogg|opus|flac|wav|zip|rar|7z|pdf|torrent)(\?|#|$)/i
  for (const a of document.querySelectorAll('a[href]')) {
    if (re.test(a.href)) add(a.href, 'link', a.textContent || a.title)
  }
  for (const a of document.querySelectorAll('a[href^="magnet:"]')) {
    if (!seen.has(a.href)) { seen.add(a.href); out.push({ url: a.href, kind: 'magnet', label: a.textContent.trim().slice(0, 120) }) }
  }
  return { items: out.slice(0, 60), blob }
}

let found = null
async function scanFound() {
  if (!tab?.id || !isHttpUrl(tab.url)) return { items: [], blob: false, blocked: true }
  let results = []
  try {
    results = await ext.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: scanPage })
  } catch {
    try { results = await ext.scripting.executeScript({ target: { tabId: tab.id }, func: scanPage }) } catch { /* restricted page */ }
  }
  const items = []; const seen = new Set(); let blob = false
  for (const r of results || []) {
    blob ||= !!r.result?.blob
    for (const it of r.result?.items || []) if (!seen.has(it.url)) { seen.add(it.url); items.push(it) }
  }
  try {
    const key = `media:${tab.id}`
    const sniffed = (await ext.storage.session.get(key))[key] || []
    for (const m of sniffed) {
      if (seen.has(m.url)) continue
      seen.add(m.url)
      items.push({ url: m.url, kind: /mpegurl|dash|\.m3u8|\.mpd/i.test(m.type + m.url) ? 'stream' : (m.type.startsWith('audio') ? 'audio' : 'video'), label: 'from network', size: m.size })
    }
  } catch { /* no session storage */ }
  return { items, blob }
}

function fileName(url) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop()) || url } catch { return url }
}

async function renderFound() {
  found ||= await scanFound()
  const list = $('foundList')
  const icon = { video: '🎬', audio: '🎵', stream: '📡', link: '🔗', magnet: '🧲' }
  list.replaceChildren(...found.items.map((it) => {
    const isStream = it.kind === 'stream' || /\.(m3u8|mpd)(\?|$)/i.test(it.url)
    const status = el('span', { className: 'muted small' })
    return el('li', {},
      el('div', { className: 'name', title: it.url }, `${icon[it.kind] || '📄'} ${fileName(it.url)}`),
      el('div', { className: 'line' },
        el('span', { className: 'muted small' }, [it.label, it.size && fmtBytes(it.size)].filter(Boolean).join(' · ')),
        el('span', { className: 'spacer' }),
        status,
        el('button', { className: 'mini', textContent: 'MediaDL', title: 'Send to your MediaDL server', on: { click: async () => {
          try { await send('queueSmart', { url: it.url, opts: { title: it.label && it.label !== 'from network' ? it.label : fileName(it.url) } }); status.textContent = 'queued ✓' }
          catch (e) { status.textContent = e.message }
        } } }),
        isStream || it.kind === 'magnet' ? null : el('button', { className: 'mini', textContent: 'Save', title: 'Download the file directly in the browser', on: { click: async () => {
          try { await ext.downloads.download({ url: it.url, conflictAction: 'uniquify' }); status.textContent = 'saving…' }
          catch (e) { status.textContent = e.message }
        } } }),
      ))
  }))
  let empty = ''
  if (!found.items.length) {
    empty = found.blocked ? 'Open a normal web page to look for media.'
      : found.blob ? 'This page streams its video in pieces, so there is no single file to grab.\nUse the "This page" tab — MediaDL will fetch it from the page link.'
      : 'No media files found on this page.\nTry the "This page" tab — MediaDL understands 1000+ sites.'
  }
  show($('foundEmpty'), empty)
  const sniffing = await ext.permissions.contains({ origins: ['<all_urls>'] }).catch(() => true)
  $('enableSniff').hidden = sniffing
  const c = $('foundCount'); c.hidden = !found.items.length; c.textContent = found.items.length
}

$('enableSniff').addEventListener('click', async () => {
  const ok = await ext.permissions.request({ origins: ['<all_urls>'] })
  if (ok) show($('foundEmpty'), 'Stream detection is on. Reload the page and play the video, then open MediaDL again.', 'ok')
})

// ── Downloads ───────────────────────────────────────────────────────────────
const STATUS_TEXT = {
  queued: 'Waiting', starting: 'Starting', downloading: 'Downloading', scraping: 'Collecting',
  converting: 'Converting', processing: 'Processing', completed: 'Done', failed: 'Failed', cancelled: 'Cancelled',
}

function renderJobs(jobs) {
  const live = jobs.filter((j) => !['completed', 'failed', 'cancelled'].includes(j.status)).length
  const c = $('jobCount'); c.hidden = !live; c.textContent = live
  $('jobsEmpty').hidden = jobs.length > 0
  $('jobList').replaceChildren(...jobs.map((j) => {
    const pct = Math.max(0, Math.min(100, Math.round(j.progress || 0)))
    const done = j.status === 'completed'
    const ended = ['completed', 'failed', 'cancelled'].includes(j.status)
    const detail = ended ? '' : [
      `${pct}%`,
      j.speed && `${fmtBytes(j.speed)}/s`,
      j.eta && `${fmtDuration(j.eta)} left`,
      j.total && `${fmtBytes(j.downloaded || 0)} / ${fmtBytes(j.total)}`,
    ].filter(Boolean).join(' · ')
    const act = (label, title, fn) => el('button', { className: 'mini', textContent: label, title, on: { click: fn } })
    return el('li', {},
      el('div', { className: 'name', title: j.url }, `${j.kind === 'audio' ? '🎵' : '🎬'} ${j.title || j.url}`),
      ended ? null : el('div', { className: 'bar-outer' }, el('div', { className: 'bar-inner', style: `width:${pct}%` })),
      el('div', { className: 'line' },
        el('span', { className: `st-${j.status}` }, STATUS_TEXT[j.status] || j.status),
        el('span', { className: 'muted small' }, detail || (done && j.saved ? 'saved to Downloads/MediaDL' : '')),
        el('span', { className: 'spacer' }),
        done ? act(j.saved ? 'Save again' : 'Save', 'Save into Downloads/MediaDL', async (e) => {
          const b = e.target; b.disabled = true; b.textContent = 'Saving…'
          try { await send('save', { jobId: j.jobId }); b.textContent = 'Saved ✓' } catch (err) { b.textContent = 'Error'; b.title = err.message }
        }) : null,
        j.status === 'failed' ? act('Retry', 'Queue it again', async () => {
          await send('queue', { payload: { url: j.url, title: j.title, mode: 'auto' } }).catch(() => {})
          refreshJobs()
        }) : null,
        !ended ? act('Cancel', 'Stop this download', async () => renderJobs(await send('cancel', { jobId: j.jobId }))) : null,
        ended ? act('✕', 'Remove from list', async () => renderJobs(await send('remove', { jobId: j.jobId }))) : null,
      ),
      j.status === 'failed' && j.error ? el('div', { className: 'muted small' }, j.error.slice(0, 200)) : null,
    )
  }))
}

async function refreshJobs() {
  try { renderJobs(await send('poll')) } catch { renderJobs(await send('jobs').catch(() => [])) }
}
$('clearDone').addEventListener('click', async () => renderJobs(await send('clearDone')))

// ── Cookies ─────────────────────────────────────────────────────────────────
// readCookies() must be the first await in each handler: Firefox only allows
// permissions.request() directly inside the click.
function cookieDomain() {
  const d = cleanDomain($('domain').value)
  if (!d) throw new Error('Enter a site first, e.g. youtube.com')
  return d
}

$('ckServer').addEventListener('click', async () => {
  try {
    const domain = cookieDomain()
    const cookies = await readCookies(domain)
    await api('/api/cookies', { method: 'POST', body: { domain, cookies: toNetscapeCookies(cookies), label: 'browser extension' } })
    show($('ckMsg'), `✅ ${cookies.length} cookies for ${domain} saved on your MediaDL server — downloads from ${domain} now use your login.`, 'ok')
  } catch (e) { show($('ckMsg'), `❌ ${e.message}`, 'err') }
})

$('ckBot').addEventListener('click', async () => {
  try {
    const domain = cookieDomain()
    const cookies = await readCookies(domain)
    await navigator.clipboard.writeText(toNetscapeCookies(cookies))
    const bot = (settings.botUsername || DEFAULT_SETTINGS.botUsername).replace(/^@/, '')
    show($('ckMsg'), `✅ Copied ${cookies.length} cookies for ${domain}.\n\nIn the Telegram chat that opens, send:\n/cookies add ${domain}\nthen paste (Ctrl+V) as the next message.`, 'ok')
    await ext.tabs.create({ url: `https://t.me/${encodeURIComponent(bot)}` })
  } catch (e) { show($('ckMsg'), `❌ ${e.message}`, 'err') }
})

$('ckFile').addEventListener('click', async () => {
  try {
    const domain = cookieDomain()
    const cookies = await readCookies(domain)
    const url = URL.createObjectURL(new Blob([toNetscapeCookies(cookies)], { type: 'text/plain' }))
    await ext.downloads.download({ url, filename: `${domain}-cookies.txt`, saveAs: true })
    show($('ckMsg'), `✅ Saved ${cookies.length} cookies for ${domain}. Keep this file private — it is your login.`, 'ok')
  } catch (e) { show($('ckMsg'), `❌ ${e.message}`, 'err') }
})

// ── init ────────────────────────────────────────────────────────────────────
;(async () => {
  settings = await getSettings()
  document.querySelector(`input[name=kind][value=${settings.kind === 'audio' ? 'audio' : 'video'}]`).checked = true
  renderAdvanced($('adv'), settings.adv, onAdvChange)
  $('advSummary').textContent = advancedSummary(settings.adv) ? `· ${advancedSummary(settings.adv)}` : ''
  fillFormats()
  fillQualities(null)

  ;[tab] = await ext.tabs.query({ active: true, currentWindow: true })
  if (tab?.url && isHttpUrl(tab.url)) {
    $('url').value = tab.url
    try { $('domain').value = cleanDomain(new URL(tab.url).hostname) } catch { /* ignore */ }
  }

  refreshJobs()
  setInterval(refreshJobs, 1500)
  scanFound().then((f) => { found = f; const c = $('foundCount'); c.hidden = !f.items.length; c.textContent = f.items.length })

  const up = await checkServer()
  if (!up) show($('pageMsg'), `Can't reach your MediaDL server at ${settings.serverUrl}.\nStart it with "npm run dev", or fix the address in ⚙ Settings.`, 'err')
  else if (isHttpUrl($('url').value)) analyze()
})()
