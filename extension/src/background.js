// MediaDL extension — background (Chromium: service worker; Firefox: event page).
// Owns: context menus, keyboard shortcuts, the job list + polling, auto-saving
// finished files, notifications, the toolbar badge and network media sniffing.
/* global ext, getSettings, serverBase, api, buildDownload, fileUrl, isHttpUrl */
if (typeof importScripts === 'function') importScripts('lib/shared.js', 'lib/options.js')

const MAX_JOBS = 50
const DONE = new Set(['completed', 'failed', 'cancelled'])
const AUDIO_EXT = /^(mp3|m4a|aac|opus|ogg|flac|wav|alac)$/
const DIRECT_TYPES = new Set(['image', 'page', 'file', 'torrent'])

// ── Job store (storage.local "jobs": newest first) ──────────────────────────
async function getJobs() { return (await ext.storage.local.get('jobs')).jobs || [] }
async function setJobs(jobs) {
  await ext.storage.local.set({ jobs: jobs.slice(0, MAX_JOBS) })
  await updateBadge(jobs)
}
async function patchJob(jobId, patch) {
  const jobs = await getJobs()
  const j = jobs.find((x) => x.jobId === jobId)
  if (j) { Object.assign(j, patch); await setJobs(jobs) }
  return j
}

async function updateBadge(jobs) {
  const n = (jobs || await getJobs()).filter((j) => !DONE.has(j.status)).length
  try {
    await ext.action.setBadgeBackgroundColor({ color: '#6d28d9' })
    await ext.action.setBadgeText({ text: n ? String(n) : '' })
  } catch { /* badge unsupported */ }
}

async function notify(title, message, id) {
  const s = await getSettings()
  if (!s.notify) return
  try {
    await ext.notifications.create(id || '', {
      type: 'basic', iconUrl: ext.runtime.getURL('icons/icon-128.png'), title, message: String(message).slice(0, 250),
    })
  } catch { /* notifications optional */ }
}

// ── Queue a download ────────────────────────────────────────────────────────
// mode 'auto' lets the server detect the media type (best for unknown links);
// otherwise `body` is a full POST /api/download payload built by the caller.
async function queue({ url, title, mode = 'auto', body }) {
  if (!isHttpUrl(url) && !/^magnet:/i.test(url || '')) throw new Error('That is not a downloadable link.')
  const res = mode === 'auto'
    ? await api('/api/download/auto', { method: 'POST', body: { url }, timeoutMs: 45_000 })
    : await api('/api/download', { method: 'POST', body, timeoutMs: 30_000 })
  if (res.recurring) {
    // A repeating schedule, not a single job — it lives in the Schedules list.
    return { recurring: res.recurring, title: title || url }
  }
  const job = {
    jobId: res.jobId, url, title: title || url, addedAt: Date.now(),
    kind: body && AUDIO_EXT.test(body.format) ? 'audio' : 'video',
    status: 'queued', progress: 0, saved: false,
    startsAt: body?.delaySeconds ? Date.now() + body.delaySeconds * 1000 : undefined,
  }
  await addJobs([job])
  return job
}

async function addJobs(list) {
  const jobs = await getJobs()
  jobs.unshift(...list)
  await setJobs(jobs)
  ensurePolling()
}

/** Many links at once (playlist picks, gallery, search results, feeds, pasted
 *  list). items: [{url, title?, thumbnail?, mediaType?, format?}] */
async function queueBatch(items, shared = {}) {
  const res = await api('/api/download/batch', { method: 'POST', body: { items: items.slice(0, 200), ...shared }, timeoutMs: 60_000 })
  const audio = AUDIO_EXT.test(shared.format || '')
  const now = Date.now()
  await addJobs(res.jobs.map((j, i) => ({
    jobId: j.jobId, url: j.url, title: j.title || j.url, addedAt: now + i,
    kind: audio ? 'audio' : 'video', status: 'queued', progress: 0, saved: false,
  })))
  return res
}

/** Pipe-through link: the server streams straight from the source (no copy is
 *  kept). Opens the browser's own download of it. */
async function streamDownload(url, { format, quality } = {}) {
  const res = await api('/api/stream', { method: 'POST', body: { url, format, quality }, timeoutMs: 60_000 })
  const link = `${await serverBase()}/api/stream/${res.token}`
  await ext.downloads.download({ url: link, conflictAction: 'uniquify' })
  return { url: link }
}

/** Analyze first so saved advanced options (proxy, speed limit, template…)
 *  apply — /api/download/auto can't carry them. Falls back to auto-detect. */
async function queueSmart(url, { audio = false, title } = {}) {
  const s = await getSettings()
  const settings = audio ? { ...s, kind: 'audio' } : s
  let a = null
  try { a = await api('/api/analyze', { method: 'POST', body: { url }, timeoutMs: 45_000 }) } catch { /* auto below */ }
  if (!a) return queue({ url, title, mode: 'auto' })
  const extra = { title: title || a.title || a.filename, thumbnail: a.thumbnail }
  if (DIRECT_TYPES.has(a.type)) Object.assign(extra, { mediaType: a.type, format: 'original' })
  else if (a.type === 'playlist' || a.type === 'profile' || a.is_playlist) extra.mediaType = a.type === 'profile' ? 'profile' : 'playlist'
  return queue({ url, title: extra.title, mode: 'custom', body: buildDownload(url, settings, extra) })
}

async function queueWithDefaults(url, { audio = false, title } = {}) {
  try {
    const job = await queueSmart(url, { audio, title })
    await notify('Queued in MediaDL', `${job.kind === 'audio' ? '🎵' : '🎬'} ${job.title || title || url}`)
  } catch (e) {
    await notify('MediaDL — could not queue', e.message)
  }
}

// ── Polling + auto-save ─────────────────────────────────────────────────────
let polling = null
async function pollJobs() {
  if (polling) return polling
  polling = (async () => {
    const jobs = await getJobs()
    const live = jobs.filter((j) => !DONE.has(j.status))
    await Promise.all(live.map(async (j) => {
      try {
        const st = await api(`/api/jobs/${j.jobId}/state`, { timeoutMs: 10_000 })
        if (st.status === 'unknown') {
          // Progress record expired (server restarted / >24h) — stop tracking.
          if (Date.now() - j.addedAt > 5 * 60_000) Object.assign(j, { status: 'failed', error: 'Lost track of this job (server restarted?)' })
          return
        }
        Object.assign(j, {
          status: st.status, progress: st.progress ?? j.progress, speed: st.speed, eta: st.eta,
          downloaded: st.downloaded, total: st.total, error: st.error,
          title: (j.title === j.url && st.filename) ? st.filename : j.title,
        })
      } catch { /* server unreachable — try again next tick */ }
    }))
    await setJobs(jobs)
    const finished = live.filter((j) => DONE.has(j.status))
    for (const j of finished) await onFinished(j)
    if (!jobs.some((j) => !DONE.has(j.status))) await ext.alarms.clear('poll')
    return jobs
  })()
  try { return await polling } finally { polling = null }
}

async function onFinished(j) {
  if (j.status === 'failed') {
    await notify('MediaDL — download failed', `${j.title}\n${j.error || ''}`)
    return
  }
  const s = await getSettings()
  if (s.autoSave && !j.saved) {
    try {
      const n = await saveJobFiles(j.jobId)
      await notify('MediaDL — saved ✓', `${j.title}\n${n} file${n === 1 ? '' : 's'} → Downloads/MediaDL`, `done-${j.jobId}`)
    } catch (e) {
      await notify('MediaDL — finished, but saving failed', `${j.title}\n${e.message}`)
    }
  } else {
    await notify('MediaDL — ready ✓', `${j.title}\nOpen the extension to save it.`, `done-${j.jobId}`)
  }
}

/** Save every file of a job into Downloads/MediaDL via the browser. */
async function saveJobFiles(jobId) {
  const base = await serverBase()
  const files = await api(`/api/files/${jobId}`, { timeoutMs: 15_000 })
  if (!files.length) throw new Error('The server has no files for this job (already removed?)')
  for (const f of files) {
    const safe = f.name.replace(/[\\/:*?"<>|]+/g, '_')
    await ext.downloads.download({ url: fileUrl(base, jobId, f.name), filename: `MediaDL/${safe}`, conflictAction: 'uniquify' })
  }
  await patchJob(jobId, { saved: true })
  return files.length
}

function ensurePolling() {
  ext.alarms.create('poll', { periodInMinutes: 0.5 })
  // Quick follow-ups while the worker is alive, so short jobs finish promptly.
  for (const ms of [3000, 8000, 15000, 25000]) setTimeout(() => { pollJobs().catch(() => {}) }, ms)
}

ext.alarms.onAlarm.addListener((a) => { if (a.name === 'poll') pollJobs().catch(() => {}) })

ext.notifications?.onClicked?.addListener((id) => {
  if (id.startsWith('done-')) ext.downloads.showDefaultFolder?.()
})

// ── Context menus ───────────────────────────────────────────────────────────
const MENUS = [
  { id: 'dl',        title: 'Download with MediaDL',            contexts: ['link', 'video', 'audio', 'image', 'page', 'selection'] },
  { id: 'dl-audio',  title: 'Download audio only (MP3/…) with MediaDL', contexts: ['link', 'video', 'audio', 'page', 'selection'] },
  { id: 'dl-stream', title: 'Download directly (no copy on server)', contexts: ['link', 'video', 'audio', 'page'] },
  { id: 'gallery',   title: 'Pick images on this page with MediaDL…', contexts: ['page', 'image'] },
  { id: 'open-app',  title: 'Open MediaDL app', contexts: ['action'] },
]

function openApp(view, params = {}) {
  const q = new URLSearchParams({ view, ...params }).toString()
  return ext.tabs.create({ url: ext.runtime.getURL(`app.html?${q}`) })
}
async function buildMenus() {
  await ext.contextMenus.removeAll()
  for (const m of MENUS) ext.contextMenus.create(m)
}
ext.runtime.onInstalled.addListener(async (d) => {
  await buildMenus()
  await updateBadge()
  if (d.reason === 'install') ext.runtime.openOptionsPage()
})
ext.runtime.onStartup?.addListener(() => { updateBadge(); pollJobs().catch(() => {}) })

ext.contextMenus.onClicked.addListener((info, tab) => {
  const raw = info.linkUrl || info.srcUrl ||
    (info.selectionText || '').trim() || info.pageUrl || tab?.url
  const fromPage = !info.linkUrl && !info.srcUrl && !info.selectionText
  // A <video src="blob:…"> can't be fetched by the server; send the page instead.
  const url = /^blob:/i.test(raw) ? (info.pageUrl || tab?.url) : raw
  if (info.menuItemId === 'open-app') return openApp('download')
  if (info.menuItemId === 'gallery') return openApp('gallery', { url: info.pageUrl || tab?.url })
  if (info.menuItemId === 'dl-stream') {
    return streamDownload(url).catch((e) => notify('MediaDL — direct download failed', e.message))
  }
  queueWithDefaults(url, { audio: info.menuItemId === 'dl-audio', title: fromPage ? tab?.title : undefined })
})

// ── Keyboard shortcuts ──────────────────────────────────────────────────────
ext.commands?.onCommand.addListener(async (cmd) => {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) return
  if (cmd === 'download-page') queueWithDefaults(tab.url, { title: tab.title })
  if (cmd === 'download-audio') queueWithDefaults(tab.url, { audio: true, title: tab.title })
})

// ── Network media sniffing (only sees anything once the user grants the
//    optional "all sites" permission in Settings) ─────────────────────────────
const MEDIA_EXT = /\.(m3u8|mpd|mp4|m4v|webm|mkv|mov|mp3|m4a|aac|ogg|opus|flac|wav)(\?|#|$)/i
const MEDIA_CT = /^(video\/|audio\/|application\/(vnd\.apple\.mpegurl|x-mpegurl|dash\+xml))/i
const SEGMENT = /(\.ts|\.m4s|\/seg[-_]?\d+|[-_]frag\d+|\/chunk[-_]?\d+|range=)/i

function headerValue(headers, name) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name)
  return h ? h.value : ''
}

ext.webRequest.onHeadersReceived.addListener(async (d) => {
  try {
    if (d.tabId < 0 || d.statusCode >= 400) return
    const ct = headerValue(d.responseHeaders, 'content-type')
    if (!(MEDIA_EXT.test(d.url) || MEDIA_CT.test(ct)) || SEGMENT.test(d.url)) return
    if (/^(chrome-extension|moz-extension):/i.test(d.initiator || d.originUrl || '')) return
    const size = Number(headerValue(d.responseHeaders, 'content-length')) || null
    const key = `media:${d.tabId}`
    const list = (await ext.storage.session.get(key))[key] || []
    const url = d.url.replace(/([?&])(range|bytestart|byteend)=[^&]*/gi, '$1').replace(/[?&]+$/, '')
    if (list.some((m) => m.url === url)) return
    list.push({ url, type: ct.split(';')[0] || '', size, at: Date.now() })
    await ext.storage.session.set({ [key]: list.slice(-40) })
  } catch { /* storage.session unavailable */ }
}, { urls: ['<all_urls>'], types: ['media', 'xmlhttprequest', 'other'] }, ['responseHeaders'])

ext.tabs.onUpdated.addListener((tabId, change) => {
  if (change.url) ext.storage.session?.remove(`media:${tabId}`).catch(() => {})
})
ext.tabs.onRemoved.addListener((tabId) => { ext.storage.session?.remove(`media:${tabId}`).catch(() => {}) })

// ── Messages from the popup / options page ──────────────────────────────────
ext.runtime.onMessage.addListener((msg, _sender, reply) => {
  const run = async () => {
    switch (msg?.type) {
      case 'queue':      return await queue(msg.payload)
      case 'queueSmart': return await queueSmart(msg.url, msg.opts)
      case 'batch':      return await queueBatch(msg.items, msg.shared)
      case 'stream':     return await streamDownload(msg.url, msg.opts)
      case 'track':      await addJobs(msg.jobs); return await getJobs()
      case 'poll':       return await pollJobs()
      case 'jobs':       return await getJobs()
      case 'save':       return await saveJobFiles(msg.jobId)
      case 'remove':     { const jobs = (await getJobs()).filter((j) => j.jobId !== msg.jobId); await setJobs(jobs); return jobs }
      case 'clearDone':  { const jobs = (await getJobs()).filter((j) => !DONE.has(j.status)); await setJobs(jobs); return jobs }
      case 'cancel': {
        await api(`/api/jobs/${msg.jobId}`, { method: 'DELETE' }).catch(() => {})
        await patchJob(msg.jobId, { status: 'cancelled' })
        return await getJobs()
      }
      default: throw new Error(`unknown message ${msg?.type}`)
    }
  }
  run().then((data) => reply({ ok: true, data }), (e) => reply({ ok: false, error: e.message }))
  return true // async reply
})
