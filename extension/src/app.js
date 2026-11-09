/* global ext, api, getSettings, serverBase, fileUrl, isHttpUrl, fmtBytes, fmtDuration, cleanDomain,
          toNetscapeCookies, readCookies, buildDownload, h, renderAdvanced, readAdvanced, advancedPayload,
          stickyAdv */
// MediaDL full app — every MediaDL feature in a browser tab.
const $ = (id) => document.getElementById(id)
const VIDEO_FORMATS = ['mp4', 'webm', 'mkv']
const AUDIO_FORMATS = ['mp3', 'm4a', 'opus', 'flac', 'wav', 'ogg']
const QUALITIES = [['best', 'Best'], ['2160', '4K'], ['1440', '1440p'], ['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['360', '360p']]
const DIRECT_TYPES = new Set(['image', 'page', 'file', 'torrent'])
let settings = {}

// ── utilities ───────────────────────────────────────────────────────────────
let toastTimer
function toast(text, kind = 'ok', ms = 6000) {
  const t = $('toast')
  t.textContent = text; t.className = `msg ${kind}`; t.hidden = false
  clearTimeout(toastTimer)
  if (ms) toastTimer = setTimeout(() => { t.hidden = true }, ms)
}
async function send(type, extra = {}) {
  const r = await ext.runtime.sendMessage({ type, ...extra })
  if (!r?.ok) throw new Error(r?.error || 'Extension error')
  return r.data
}
function busy(btn, text) {
  const old = btn.textContent; btn.disabled = true; btn.textContent = text
  return () => { btn.disabled = false; btn.textContent = old }
}
async function guard(btn, text, fn) {
  const done = btn ? busy(btn, text) : () => {}
  try { return await fn() } catch (e) { toast(e.message, 'err', 10000) } finally { done() }
}
const ago = (t) => {
  const s = Math.round((Date.now() - new Date(t).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(t).toLocaleDateString()
}
function host(u) { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }

// ── download settings bar (shared by every picker) ──────────────────────────
function dlBar(root, { button = 'Download', onGo } = {}) {
  const kindSel = h('select', {}, h('option', { value: 'video', textContent: '🎬 Video' }), h('option', { value: 'audio', textContent: '🎵 Audio only' }))
  const fmtSel = h('select')
  const qSel = h('select', {}, QUALITIES.map(([v, t]) => h('option', { value: v, textContent: t })))
  const adv = h('div')
  const go = button ? h('button', { className: 'primary', textContent: button }) : null
  const fillFmt = () => {
    const audio = kindSel.value === 'audio'
    const list = audio ? AUDIO_FORMATS : VIDEO_FORMATS
    const want = audio ? settings.audioFormat : settings.videoFormat
    fmtSel.replaceChildren(...list.map((f) => h('option', { value: f, textContent: f.toUpperCase(), selected: f === want })))
    qSel.disabled = audio
  }
  kindSel.value = settings.kind === 'audio' ? 'audio' : 'video'
  qSel.value = QUALITIES.some(([v]) => v === settings.quality) ? settings.quality : 'best'
  kindSel.addEventListener('change', fillFmt)
  fillFmt()
  root.replaceChildren(
    h('div', { className: 'row' },
      h('label', {}, 'Type', kindSel), h('label', {}, 'Quality', qSel), h('label', {}, 'Format', fmtSel),
      h('span', { className: 'spacer' }), go),
    h('details', {}, h('summary', {}, 'Advanced options'), adv))
  renderAdvanced(adv, settings.adv)
  if (go && onGo) go.addEventListener('click', () => onGo(go))
  return {
    root, go, quality: qSel, kind: kindSel, format: fmtSel,
    setLabel(text) { if (go) go.textContent = text },
    /** shared fields for POST /api/download/batch */
    shared() {
      const audio = kindSel.value === 'audio'
      return { mediaType: 'video', format: fmtSel.value, quality: audio ? 'best' : qSel.value, ...advancedPayload(readAdvanced(adv), { audio }) }
    },
    /** settings-like object for buildDownload() */
    single() {
      return { s: { ...settings, kind: kindSel.value, quality: qSel.value, [kindSel.value === 'audio' ? 'audioFormat' : 'videoFormat']: fmtSel.value }, adv: readAdvanced(adv) }
    },
  }
}

async function queueBatch(items, shared, btn) {
  if (!items.length) return toast('Select something first.', 'err')
  await guard(btn, 'Sending…', async () => {
    const r = await send('batch', { items, shared })
    toast(`✅ Queued ${r.count} download${r.count === 1 ? '' : 's'}${shared.delaySeconds ? ` — starting in ${Math.round(shared.delaySeconds / 60)} min` : ''}. Track them in Queue or the toolbar popup.`)
  })
}

// ── selectable list helper (playlist / search / feed) ───────────────────────
function selectable(listEl, toolsEl, countEl, onChange) {
  const update = () => {
    const boxes = [...listEl.querySelectorAll('input[type=checkbox]')]
    const n = boxes.filter((b) => b.checked).length
    for (const b of boxes) b.closest('li,label').classList.toggle('sel', b.checked)
    countEl.textContent = `${n} of ${boxes.length} selected`
    onChange && onChange(n)
  }
  listEl.addEventListener('change', update)
  toolsEl.addEventListener('click', (e) => {
    const sel = e.target.dataset?.sel
    if (!sel) return
    for (const b of listEl.querySelectorAll('input[type=checkbox]')) b.checked = sel === 'all'
    update()
  })
  return { update, selected: () => [...listEl.querySelectorAll('input[type=checkbox]:checked')].map((b) => b._item) }
}

// ── router ──────────────────────────────────────────────────────────────────
const loaders = {}
let current = null
function show(view, params = {}) {
  if (!document.querySelector(`section[data-view="${view}"]`)) view = 'download'
  current = view
  for (const s of document.querySelectorAll('main section')) s.hidden = s.dataset.view !== view
  for (const a of document.querySelectorAll('#nav a[data-view]')) a.classList.toggle('on', a.dataset.view === view)
  const q = new URLSearchParams({ view, ...params })
  history.replaceState(null, '', `?${q}`)
  loaders[view]?.(params)
}
$('nav').addEventListener('click', (e) => {
  const a = e.target.closest('a'); if (!a) return
  if (a.id === 'settings') return ext.runtime.openOptionsPage()
  show(a.dataset.view)
})

// ════════════════════════════════════════════════════════════════════════════
// Download (single link, every option)
// ════════════════════════════════════════════════════════════════════════════
let dBar, dAnalysis = null
async function dAnalyze() {
  const url = $('dUrl').value.trim()
  dAnalysis = null; $('dInfo').hidden = true
  if (!isHttpUrl(url)) return
  await guard($('dCheck'), '…', async () => {
    const a = await api('/api/analyze', { method: 'POST', body: { url }, timeoutMs: 90_000 })
    dAnalysis = a
    $('dInfo').hidden = false
    $('dTitle').textContent = a.title || a.filename || url
    $('dSub').textContent = [a.type, a.is_live && '🔴 live', fmtDuration(a.duration), a.playlist_count && `${a.playlist_count} items`,
      a.size && fmtBytes(a.size), a.uploader, a.extractor].filter(Boolean).join(' · ')
    $('dThumb').hidden = !a.thumbnail; if (a.thumbnail) $('dThumb').src = a.thumbnail
    const qs = [...new Set(a.qualities || [])].filter(Boolean).sort((x, y) => y - x)
    if (qs.length) {
      const sizes = new Map((a.format_options || []).map((f) => [f.height, f.size]))
      dBar.quality.replaceChildren(h('option', { value: 'best', textContent: 'Best' }),
        ...qs.map((q) => h('option', { value: String(q), textContent: `${q}p${sizes.get(q) ? ` · ~${fmtBytes(sizes.get(q))}` : ''}` })))
    }
    const list = a.type === 'playlist' || a.type === 'profile' || a.is_playlist
    $('dMax').closest('.row').hidden = !list
    if (list) toast('This is a playlist / channel — download all of it here, or pick videos in Playlist picker.', 'ok')
    if (a.type === 'page' || a.type === 'image') toast('This page has images — use Image gallery to choose which.', 'ok')
  })
}
loaders.download = (p) => {
  if (!dBar) {
    dBar = dlBar($('dForm'), { button: null })
    $('dCheck').addEventListener('click', dAnalyze)
    $('dUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') dAnalyze() })
    $('dGo').addEventListener('click', () => guard($('dGo'), 'Sending…', async () => {
      const url = $('dUrl').value.trim()
      if (!isHttpUrl(url) && !/^magnet:/i.test(url)) throw new Error('Enter a link first.')
      const { s } = dBar.single()
      const a = dAnalysis
      const extra = { title: a?.title || a?.filename, thumbnail: a?.thumbnail }
      if (a && DIRECT_TYPES.has(a.type)) Object.assign(extra, { mediaType: a.type, format: 'original' })
      if (a && (a.type === 'playlist' || a.type === 'profile' || a.is_playlist)) {
        extra.mediaType = a.type === 'profile' ? 'profile' : 'playlist'
        if ($('dMax').value) extra.maxItems = Number($('dMax').value)
        extra.startIndex = Number($('dStart').value) || 1
      }
      const body = buildDownload(url, s, extra, readAdvanced($('dAdv')))
      const r = await send('queue', { payload: { url, title: extra.title, mode: 'custom', body } })
      toast(r.recurring ? `🔁 Scheduled ${r.recurring} — see Schedules.` : body.delaySeconds ? `⏰ Queued — starts in ${Math.round(body.delaySeconds / 60)} min.` : '✅ Queued — see Queue or the toolbar popup.')
    }))
    $('dStream').addEventListener('click', () => guard($('dStream'), 'Starting…', async () => {
      const { s } = dBar.single()
      await send('stream', { url: $('dUrl').value.trim(), opts: { format: dBar.format.value, quality: s.kind === 'audio' ? 'best' : s.quality } })
      toast('✅ Downloading straight from the site — see your browser\'s Downloads.')
    }))
    $('dAuto').addEventListener('click', () => guard($('dAuto'), 'Working…', async () => {
      await send('queueSmart', { url: $('dUrl').value.trim(), opts: { audio: dBar.kind.value === 'audio' } })
      toast('✅ Queued with auto-detect.')
    }))
    renderAdvanced($('dAdv'), settings.adv, (a) => ext.storage.sync.set({ adv: stickyAdv(a) }))
    // The bar's own collapsed advanced block is redundant here — this view shows it open below.
    dBar.root.querySelector('details').remove()
    $('dMax').closest('.row').hidden = true
  }
  if (p.url && p.url !== $('dUrl').value) { $('dUrl').value = p.url; dAnalyze() }
}

// ════════════════════════════════════════════════════════════════════════════
// Playlist picker
// ════════════════════════════════════════════════════════════════════════════
let pSel, pBar
async function pLoad() {
  const url = $('pUrl').value.trim()
  if (!isHttpUrl(url)) return
  await guard($('pLoad'), 'Loading…', async () => {
    const r = await api('/api/analyze/list-playlist', { method: 'POST', body: { url }, timeoutMs: 120_000 })
    $('pHead').textContent = `${r.title || 'Playlist'}${r.uploader ? ` · ${r.uploader}` : ''} · ${r.total} items${r.previewing < r.total ? ` (showing first ${r.previewing})` : ''}`
    $('pList').replaceChildren(...r.items.map((it) => {
      const cb = h('input', { type: 'checkbox', checked: true }); cb._item = { url: it.url, title: it.title, thumbnail: it.thumbnail }
      return h('li', {}, cb, h('img', { src: it.thumbnail || '', alt: '' }),
        h('div', { className: 'info' }, h('div', { className: 't' }, `${it.index}. ${it.title || it.url}`),
          h('div', { className: 's' }, [fmtDuration(it.duration), it.uploader].filter(Boolean).join(' · '))))
    }))
    $('pTools').hidden = false; $('pBar').hidden = false
    pSel.update()
  })
}
loaders.playlist = (p) => {
  if (!pSel) {
    pBar = dlBar($('pBar'), { button: 'Download selected', onGo: (b) => queueBatch(pSel.selected(), pBar.shared(), b) })
    pSel = selectable($('pList'), $('pTools'), $('pSel'), (n) => pBar.setLabel(`⬇ Download ${n} selected`))
    $('pLoad').addEventListener('click', pLoad)
    $('pUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') pLoad() })
  }
  if (p.url && p.url !== $('pUrl').value) { $('pUrl').value = p.url; pLoad() }
}

// ════════════════════════════════════════════════════════════════════════════
// Image gallery
// ════════════════════════════════════════════════════════════════════════════
let gSel
async function gLoad() {
  const url = $('gUrl').value.trim()
  if (!isHttpUrl(url)) return
  await guard($('gLoad'), 'Loading…', async () => {
    const r = await api('/api/analyze/preview-page', { method: 'POST', body: { url }, timeoutMs: 120_000 })
    $('gHead').textContent = `${r.page_title || host(url)} · ${r.total} images`
    $('gGrid').replaceChildren(...r.items.map((it) => {
      const cb = h('input', { type: 'checkbox', checked: true }); cb._item = { url: it.url, mediaType: 'image', format: 'original' }
      return h('label', { title: it.url }, h('img', { src: it.url, alt: '', loading: 'lazy' }), cb)
    }))
    $('gTools').hidden = !r.items.length
    if (!r.items.length) toast('No images found on that page.', 'err')
    gSel.update()
  })
}
loaders.gallery = (p) => {
  if (!gSel) {
    gSel = selectable($('gGrid'), $('gTools'), $('gSel'), (n) => { $('gGo').textContent = `⬇ Download ${n} with MediaDL` })
    $('gLoad').addEventListener('click', gLoad)
    $('gUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') gLoad() })
    $('gGo').addEventListener('click', () => queueBatch(gSel.selected(), { mediaType: 'image', format: 'original' }, $('gGo')))
    $('gDirect').addEventListener('click', () => guard($('gDirect'), 'Saving…', async () => {
      const items = gSel.selected()
      for (const it of items) await ext.downloads.download({ url: it.url, conflictAction: 'uniquify' })
      toast(`✅ Saving ${items.length} images straight from the site.`)
    }))
  }
  if (p.url && p.url !== $('gUrl').value) { $('gUrl').value = p.url; gLoad() }
}

// ════════════════════════════════════════════════════════════════════════════
// Batch links
// ════════════════════════════════════════════════════════════════════════════
let bBar
function bLinks() {
  const seen = new Set()
  return $('bText').value.split(/\s+/).map((s) => s.trim())
    .filter((s) => (isHttpUrl(s) || /^magnet:/i.test(s)) && !seen.has(s) && seen.add(s))
}
function bCount() {
  const n = bLinks().length
  $('bCount').textContent = `${n} link${n === 1 ? '' : 's'}${n > 200 ? ' — only the first 200 will be sent' : ''}`
  bBar.setLabel(`⬇ Download ${Math.min(n, 200)}`)
}
loaders.batch = () => {
  if (bBar) return
  bBar = dlBar($('bBar'), { button: 'Download', onGo: (b) => queueBatch(bLinks().map((url) => (/^magnet:/i.test(url) ? { url, mediaType: 'torrent', format: 'original' } : { url })), bBar.shared(), b) })
  $('bText').addEventListener('input', bCount)
  $('bTabs').addEventListener('click', async () => {
    // Reading other tabs' addresses needs the optional "tabs" permission — asked
    // here, first thing in the click (Firefox requires that).
    if (!(await ext.permissions.request({ permissions: ['tabs'] }))) return toast('Permission to read open tabs was not given.', 'err')
    const tabs = await ext.tabs.query({})
    const urls = tabs.map((t) => t.url).filter((u) => isHttpUrl(u))
    $('bText').value = [$('bText').value.trim(), ...urls].filter(Boolean).join('\n')
    bCount()
  })
  bCount()
}

// ════════════════════════════════════════════════════════════════════════════
// Search
// ════════════════════════════════════════════════════════════════════════════
let sSel, sBar, sPage = 1
function sItem(r, kind) {
  const url = r.magnet || r.url
  if (kind === 'image') return { url, title: r.title, mediaType: 'image', format: 'original' }
  if (kind === 'file') return { url, title: r.title, mediaType: 'file', format: 'original' }
  if (kind === 'torrent') return { url, title: r.title, mediaType: 'torrent', format: 'original' }
  return { url, title: r.title, thumbnail: r.thumbnail }
}
async function sRun(more = false) {
  const query = $('sQ').value.trim(); if (!query) return
  const kind = $('sKind').value
  sPage = more ? sPage + 1 : 1
  await guard(more ? $('sMore') : $('sGo'), 'Searching…', async () => {
    const r = await api('/api/analyze/search', { method: 'POST', timeoutMs: 60_000,
      body: { query, kind, filetype: kind === 'file' ? ($('sType').value.trim() || undefined) : undefined, page: sPage, limit: 30, safe: $('sSafe').checked } })
    const rows = r.results.map((x) => {
      const cb = h('input', { type: 'checkbox' }); cb._item = sItem(x, kind)
      const meta = [x.source || host(x.url), x.duration, x.size, x.seeds && `▲${x.seeds} ▼${x.leechers ?? '?'}`, x.date].filter(Boolean).join(' · ')
      return h('li', {}, cb,
        x.thumbnail ? h('img', { src: x.thumbnail, alt: '', loading: 'lazy' }) : null,
        h('div', { className: 'info' },
          h('div', { className: 't', title: x.url }, x.title || x.url),
          h('div', { className: 's' }, meta), x.snippet ? h('div', { className: 's' }, x.snippet) : null),
        h('button', { className: 'mini', textContent: 'Open', on: { click: () => ext.tabs.create({ url: x.url, active: false }) } }),
        h('button', { className: 'mini', textContent: '⬇', title: 'Download this one', on: { click: (e) => queueBatch([cb._item], sBar.shared(), e.target) } }))
    })
    if (more) $('sList').append(...rows); else $('sList').replaceChildren(...rows)
    $('sTools').hidden = $('sBar').hidden = !$('sList').children.length
    $('sMore').hidden = !r.has_more
    if (!r.results.length && !more) toast('No results.', 'err')
    sSel.update()
  })
}
loaders.search = () => {
  if (sSel) return
  sBar = dlBar($('sBar'), { button: 'Download selected', onGo: (b) => queueBatch(sSel.selected(), sBar.shared(), b) })
  sSel = selectable($('sList'), $('sTools'), $('sSel'), (n) => sBar.setLabel(`⬇ Download ${n} selected`))
  $('sGo').addEventListener('click', () => sRun())
  $('sMore').addEventListener('click', () => sRun(true))
  $('sQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') sRun() })
  $('sKind').addEventListener('change', () => { $('sType').hidden = $('sKind').value !== 'file' })
}

// ════════════════════════════════════════════════════════════════════════════
// Feeds
// ════════════════════════════════════════════════════════════════════════════
let fSel, fBar
async function fLoad() {
  const url = $('fUrl').value.trim(); if (!isHttpUrl(url)) return
  await guard($('fLoad'), 'Loading…', async () => {
    const r = await api('/api/download/feed', { method: 'POST', body: { url }, timeoutMs: 60_000 })
    $('fHead').textContent = `${r.feed_title || host(url)} · ${r.type.toUpperCase()} · ${r.count} items`
    if (r.items.some((i) => /^audio\//.test(i.enclosure_type || ''))) fBar.kind.value = 'audio', fBar.kind.dispatchEvent(new Event('change'))
    $('fList').replaceChildren(...r.items.map((it) => {
      const cb = h('input', { type: 'checkbox' }); cb._item = { url: it.url, title: it.title, thumbnail: it.thumbnail || undefined }
      return h('li', {}, cb, it.thumbnail ? h('img', { src: it.thumbnail, alt: '', loading: 'lazy' }) : null,
        h('div', { className: 'info' }, h('div', { className: 't' }, it.title || it.url),
          h('div', { className: 's' }, [it.group, it.pub_date && new Date(it.pub_date).toLocaleDateString(), it.duration_str || fmtDuration(it.duration)].filter(Boolean).join(' · '))))
    }))
    $('fTools').hidden = $('fBar').hidden = !r.items.length
    fSel.update()
  })
}
loaders.feed = () => {
  if (fSel) return
  fBar = dlBar($('fBar'), { button: 'Download selected', onGo: (b) => queueBatch(fSel.selected(), fBar.shared(), b) })
  fSel = selectable($('fList'), $('fTools'), $('fSel'), (n) => fBar.setLabel(`⬇ Download ${n} selected`))
  $('fLoad').addEventListener('click', fLoad)
  $('fUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') fLoad() })
}

// ════════════════════════════════════════════════════════════════════════════
// Server queue
// ════════════════════════════════════════════════════════════════════════════
const openFiles = new Set()
const STATUS = { queued: 'Waiting', starting: 'Starting', downloading: 'Downloading', scraping: 'Collecting',
  converting: 'Converting', processing: 'Processing', completed: 'Done', failed: 'Failed' }

async function filesPanel(job, box) {
  const base = await serverBase()
  const files = await api(`/api/files/${job.jobId}`)
  if (!files.length) { box.replaceChildren(h('div', { className: 'muted small' }, 'No files left on the server (already saved and cleaned up).')); return }
  const save = (f) => ext.downloads.download({ url: fileUrl(base, job.jobId, f.name), filename: `MediaDL/${f.name.replace(/[\\/:*?"<>|]+/g, '_')}`, conflictAction: 'uniquify' })
  const vids = files.filter((f) => /^video\//.test(f.mime)); const auds = files.filter((f) => /^audio\//.test(f.mime))
  box.replaceChildren(
    ...files.map((f) => h('div', { className: 'line' },
      h('span', {}, `📄 ${f.name}`), h('span', { className: 'muted' }, fmtBytes(f.size)), h('span', { className: 'spacer' }),
      /^(video|audio)\//.test(f.mime) ? h('button', { className: 'mini', textContent: '▶ Play', on: { click: () => show('player', { job: job.jobId, file: f.name }) } }) : null,
      h('button', { className: 'mini', textContent: 'Save', on: { click: () => save(f) } }))),
    files.length > 1 ? h('div', { className: 'line' }, h('span', { className: 'spacer' }),
      h('button', { className: 'mini', textContent: `Save all ${files.length}`, on: { click: () => files.forEach(save) } }),
      h('button', { className: 'mini', textContent: 'Save as ZIP', on: { click: () => ext.downloads.download({ url: `${base}/api/files/${job.jobId}/zip`, conflictAction: 'uniquify' }) } })) : null,
    vids.length && auds.length ? h('div', { className: 'line' },
      h('span', { className: 'muted' }, 'Separate video + audio?'), h('span', { className: 'spacer' }),
      h('button', { className: 'mini', textContent: '🔗 Merge into one MP4', on: { click: (e) => guard(e.target, 'Merging…', async () => {
        const r = await api('/api/download/merge', { method: 'POST', timeoutMs: 600_000,
          body: { job_id: job.jobId, video_file: vids[0].name, audio_file: auds[0].name, output_format: 'mp4' } })
        toast(`✅ Merged → ${r.output_file} (${fmtBytes(r.size)})`)
        filesPanel(job, box)
      }) } })) : null,
  )
}

async function qRender() {
  const [jobs, st] = await Promise.all([api('/api/jobs', { timeoutMs: 10_000 }), api('/api/jobs/stats', { timeoutMs: 10_000 }).catch(() => null)])
  if (st) $('qStats').textContent = `${st.active} running · ${st.waiting} waiting · ${st.completed} done · ${st.failed} failed`
  const live = jobs.filter((j) => !['completed', 'failed'].includes(j.progress?.status)).length
  $('qCount').hidden = !live; $('qCount').textContent = live
  if (current !== 'queue') return
  $('qEmpty').hidden = jobs.length > 0
  $('qList').replaceChildren(...jobs.map((j) => {
    const p = j.progress || {}; const pct = Math.round(p.progress || 0)
    const ended = p.status === 'completed' || p.status === 'failed'
    const filesBox = h('div', { className: 'files' })
    if (openFiles.has(j.jobId)) filesPanel(j, filesBox).catch((e) => filesBox.replaceChildren(e.message))
    const btn = (label, fn, cls = 'mini') => h('button', { className: cls, textContent: label, on: { click: fn } })
    return h('li', {},
      h('div', { className: 'name', title: j.url }, `${j.mediaType === 'image' ? '🖼' : /^(mp3|m4a|opus|flac|wav|ogg|aac)$/.test(j.format) ? '🎵' : '🎬'} ${j.title || p.filename || j.url}`),
      ended ? null : h('div', { className: 'bar-outer' }, h('div', { className: 'bar-inner', style: `width:${pct}%` })),
      h('div', { className: 'line' },
        h('span', { className: `st-${p.status}` }, STATUS[p.status] || p.status || 'Waiting'),
        h('span', { className: 'muted small' }, [!ended && `${pct}%`, p.speed && `${fmtBytes(p.speed)}/s`, p.eta && `${fmtDuration(p.eta)} left`,
          p.total_files > 1 && `${p.completed_files ?? 0}/${p.total_files} files`, host(j.url), ago(j.addedAt)].filter(Boolean).join(' · ')),
        h('span', { className: 'spacer' }),
        p.status === 'completed' ? btn(openFiles.has(j.jobId) ? 'Hide files' : 'Files', () => { openFiles.has(j.jobId) ? openFiles.delete(j.jobId) : openFiles.add(j.jobId); qRender() }) : null,
        p.status === 'failed' ? btn('Retry', () => guard(null, '', async () => { await api(`/api/jobs/${j.jobId}/retry`, { method: 'POST' }); toast('Retrying.'); qRender() })) : null,
        btn(ended ? '✕' : 'Cancel', () => guard(null, '', async () => { await api(`/api/jobs/${j.jobId}`, { method: 'DELETE' }); qRender() }))),
      p.status === 'failed' && p.error ? h('div', { className: 'muted small' }, p.error.slice(0, 300)) : null,
      filesBox)
  }))
}
loaders.queue = () => qRender().catch((e) => toast(e.message, 'err'))
$('qStop').addEventListener('click', () => confirm('Stop every running and waiting download on the server?') &&
  guard($('qStop'), 'Stopping…', async () => { const r = await api('/api/jobs/stop-all', { method: 'POST' }); toast(`Stopped ${r.stopped}.`); qRender() }))
$('qClearDone').addEventListener('click', () => guard($('qClearDone'), '…', async () => { await api('/api/jobs?type=completed', { method: 'DELETE' }); qRender() }))
$('qClearFail').addEventListener('click', () => guard($('qClearFail'), '…', async () => { await api('/api/jobs?type=failed', { method: 'DELETE' }); qRender() }))

// ════════════════════════════════════════════════════════════════════════════
// Schedules
// ════════════════════════════════════════════════════════════════════════════
const CRON_TEXT = { '0 * * * *': 'every hour', '0 9 * * *': 'every day at 09:00', '0 9 * * 1': 'every Monday at 09:00' }
loaders.schedules = () => guard(null, '', async () => {
  const rows = await api('/api/download/schedules')
  $('schEmpty').hidden = rows.length > 0
  $('schList').replaceChildren(...rows.map((r) => h('li', {},
    h('div', { className: 'name' }, r.name || r.key),
    h('div', { className: 'line' },
      h('span', {}, `🔁 ${CRON_TEXT[r.pattern] || r.pattern}`),
      h('span', { className: 'muted small' }, r.next ? `next: ${new Date(r.next).toLocaleString()}` : ''),
      h('span', { className: 'spacer' }),
      h('button', { className: 'mini danger', textContent: 'Delete', on: { click: () => confirm('Delete this recurring download?') &&
        guard(null, '', async () => { await api(`/api/download/schedules/${encodeURIComponent(r.key)}`, { method: 'DELETE' }); loaders.schedules() }) } })))))
})

// ════════════════════════════════════════════════════════════════════════════
// Proxies
// ════════════════════════════════════════════════════════════════════════════
function proxyResult(r) {
  return r.ok ? `✅ works — IP ${r.ip || '?'}${r.country ? `, ${r.city ? `${r.city}, ` : ''}${r.country}` : ''}${r.latency_ms ? `, ${r.latency_ms} ms` : ''}`
    : `❌ ${r.error || 'not working'}`
}
loaders.proxies = () => guard(null, '', async () => {
  const { presets = [], saved = [] } = await api('/api/proxy')
  const test = (ref) => (e) => guard(e.target, 'Testing…', async () => { toast(proxyResult(await api('/api/proxy/test', { method: 'POST', body: { proxy: ref }, timeoutMs: 70_000 })), 'ok', 10000); loaders.proxies() })
  $('xSaved').replaceChildren(...(saved.length ? saved.map((p) => h('li', {},
    h('div', { className: 'name' }, `${p.is_default ? '★ ' : ''}${p.label}`),
    h('div', { className: 'line' },
      h('span', { className: p.last_ok === 1 ? 'st-completed' : p.last_ok === 0 ? 'st-failed' : 'muted' },
        p.last_ok === 1 ? `working${p.last_ip ? ` · ${p.last_ip}` : ''}${p.country ? ` · ${p.country}` : ''}` : p.last_ok === 0 ? 'failed last test' : 'not tested'),
      p.last_tested ? h('span', { className: 'muted small' }, ago(p.last_tested)) : null,
      h('span', { className: 'spacer' }),
      h('button', { className: 'mini', textContent: 'Test', on: { click: test(p.id) } }),
      p.is_default ? null : h('button', { className: 'mini', textContent: '★ Make default', on: { click: () => guard(null, '', async () => { await api(`/api/proxy/${p.id}/default`, { method: 'PATCH' }); loaders.proxies() }) } }),
      h('button', { className: 'mini danger', textContent: 'Delete', on: { click: () => confirm(`Delete proxy "${p.label}"?`) && guard(null, '', async () => { await api(`/api/proxy/${p.id}`, { method: 'DELETE' }); loaders.proxies() }) } })))) :
    [h('li', { className: 'muted' }, 'None saved yet.')]))
  $('xPresets').replaceChildren(...(presets.length ? presets.map((p) => h('li', {},
    h('div', { className: 'line' }, h('span', {}, p.label), h('span', { className: 'spacer' }), h('button', { className: 'mini', textContent: 'Test', on: { click: test(p.id) } })))) :
    [h('li', { className: 'muted' }, 'No built-in proxies configured on this server.')]))
})
$('xTest').addEventListener('click', () => guard($('xTest'), 'Testing…', async () => {
  toast(proxyResult(await api('/api/proxy/test', { method: 'POST', body: { proxy: $('xUrl').value.trim() }, timeoutMs: 70_000 })), 'ok', 10000)
}))
$('xAdd').addEventListener('click', () => guard($('xAdd'), 'Saving…', async () => {
  const url = $('xUrl').value.trim(); if (!url) throw new Error('Enter the proxy address.')
  await api('/api/proxy', { method: 'POST', body: { label: $('xLabel').value.trim() || host(url.replace(/^\w+:\/\//, 'http://')) || 'Proxy', url } })
  $('xUrl').value = ''; $('xLabel').value = ''
  toast('✅ Saved. Test it to check it works.'); loaders.proxies()
}))

// ════════════════════════════════════════════════════════════════════════════
// Cookies
// ════════════════════════════════════════════════════════════════════════════
loaders.cookies = () => guard(null, '', async () => {
  const rows = await api('/api/cookies')
  $('cList').replaceChildren(...(rows.length ? rows.map((c) => {
    const tog = h('input', { type: 'checkbox', checked: c.enabled, on: { change: () => guard(null, '', async () => { await api(`/api/cookies/${c.id}`, { method: 'PATCH', body: { enabled: tog.checked } }) }) } })
    return h('li', {},
      h('div', { className: 'name' }, `🍪 ${c.domain}`),
      h('div', { className: 'line' },
        h('label', { className: 'check' }, tog, 'use for downloads'),
        h('span', { className: 'muted small' }, `${c.count} cookies${c.label ? ` · ${c.label}` : ''} · updated ${ago(c.updated_at)}`),
        h('span', { className: 'spacer' }),
        h('button', { className: 'mini', textContent: 'Refresh from browser', on: { click: (e) => importCookies(c.domain, e.target) } }),
        h('button', { className: 'mini danger', textContent: 'Delete', on: { click: () => confirm(`Delete saved cookies for ${c.domain}?`) && guard(null, '', async () => { await api(`/api/cookies/${c.id}`, { method: 'DELETE' }); loaders.cookies() }) } })))
  }) : [h('li', { className: 'muted' }, 'No site logins saved yet.')]))
})
async function importCookies(domain, btn) {
  // readCookies() first — Firefox only allows the permission prompt directly inside a click.
  try {
    const d = cleanDomain(domain); if (!d) throw new Error('Enter a site, e.g. youtube.com')
    const cookies = await readCookies(d)
    await guard(btn, 'Saving…', async () => {
      await api('/api/cookies', { method: 'POST', body: { domain: d, cookies: toNetscapeCookies(cookies), label: 'browser extension' } })
      toast(`✅ Saved ${cookies.length} cookies for ${d}.`); loaders.cookies()
    })
  } catch (e) { toast(e.message, 'err') }
}
$('cImport').addEventListener('click', () => importCookies($('cDomain').value, $('cImport')))
$('cPaste').addEventListener('click', () => guard($('cPaste'), 'Saving…', async () => {
  const d = cleanDomain($('cDomain').value); if (!d) throw new Error('Enter the site first, e.g. youtube.com')
  await api('/api/cookies', { method: 'POST', body: { domain: d, cookies: $('cText').value, label: 'pasted' } })
  $('cText').value = ''; toast(`✅ Saved cookies for ${d}.`); loaders.cookies()
}))

// ════════════════════════════════════════════════════════════════════════════
// Status
// ════════════════════════════════════════════════════════════════════════════
loaders.status = () => guard(null, '', async () => {
  const [s, st] = await Promise.all([api('/api/status'), api('/api/jobs/stats').catch(() => null)])
  const badge = { operational: '✅ All systems working', degraded: '⚠️ Partly degraded', major_outage: '❌ Major outage' }[s.status] || s.status
  const kv = (k, v, cls = '') => h('div', { className: `msg ${cls}` }, h('span', {}, k), h('b', {}, v ?? '—'))
  $('stBox').replaceChildren(
    h('p', { className: `msg ${s.status === 'operational' ? 'ok' : 'err'}` }, `${badge} · checked ${ago(s.updated_at)}`),
    s.incident?.active ? h('p', { className: 'msg err' }, `Incident: ${s.incident.message}`) : null,
    st ? h('h2', {}, 'Downloads') : null,
    st ? h('div', { className: 'status-grid' }, kv('Running', st.active), kv('Waiting', st.waiting), kv('Completed', st.completed), kv('Failed', st.failed)) : null,
    h('h2', {}, 'Services'),
    h('div', { className: 'status-grid' }, ...Object.entries(s.checks || {}).map(([k, v]) => kv(k, v === 'ok' ? 'OK' : 'DOWN', v === 'ok' ? 'ok' : 'err'))),
    h('h2', {}, 'Download engines'),
    h('div', { className: 'status-grid' }, ...Object.entries(s.engines || {}).map(([k, v]) => kv(k, v || 'not installed'))),
    s.sites ? h('p', { className: 'hint' }, `${s.sites.named_extractors.toLocaleString()} sites with dedicated support, plus a generic extractor for most other pages.`) : null,
  )
})

// ════════════════════════════════════════════════════════════════════════════
// Player (a <video> uses range requests, which the server serves inline)
// ════════════════════════════════════════════════════════════════════════════
loaders.player = async (p) => {
  if (!p.job || !p.file) return show('queue')
  const src = fileUrl(await serverBase(), p.job, p.file)
  $('plTitle').textContent = p.file
  if ($('plVideo').src !== src) $('plVideo').src = src
  $('plSave').onclick = () => ext.downloads.download({ url: src, filename: `MediaDL/${p.file.replace(/[\\/:*?"<>|]+/g, '_')}`, conflictAction: 'uniquify' })
}

// ── boot ────────────────────────────────────────────────────────────────────
;(async () => {
  settings = await getSettings()
  try {
    const hh = await api('/health', { timeoutMs: 5000 })
    $('server').className = 'dot ok'; $('server').title = `MediaDL v${hh.version} at ${settings.serverUrl}`
  } catch (e) {
    $('server').className = 'dot bad'; $('server').title = e.message
    toast(`${e.message}\nStart MediaDL (npm run dev) or fix the address in ⚙ Settings.`, 'err', 0)
  }
  const { view, ...params } = Object.fromEntries(new URLSearchParams(location.search))
  show(view || 'download', params)
  setInterval(() => { if (current === 'queue' || !$('qCount').hidden) qRender().catch(() => {}) }, 2000)
  qRender().catch(() => {})
})()
