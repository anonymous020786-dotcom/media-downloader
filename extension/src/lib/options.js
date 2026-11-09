// Advanced download options — one definition rendered in both the popup's
// "More options" and the full app, so they always offer the same controls and
// build the same POST /api/download payload. Classic script (no modules).
/* global ext, api */
/* eslint-disable no-var */

var SUB_LANGS = [['auto', 'Auto-detect'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'],
  ['pt', 'Portuguese'], ['it', 'Italian'], ['ru', 'Russian'], ['ja', 'Japanese'], ['ko', 'Korean'],
  ['zh', 'Chinese'], ['ar', 'Arabic'], ['hi', 'Hindi']]

var OUTPUT_TEMPLATES = [['', 'Default'], ['%(title)s.%(ext)s', 'Title only'],
  ['%(uploader)s - %(title)s.%(ext)s', 'Uploader – Title'],
  ['%(upload_date>%Y-%m-%d)s %(title)s.%(ext)s', 'Date – Title'],
  ['%(id)s %(title)s.%(ext)s', 'ID – Title'],
  ['%(playlist_index)03d %(title)s.%(ext)s', 'Playlist index'], ['__custom__', 'Custom…']]

var ADV_DEFAULTS = {
  subtitles: false, subtitleLang: 'auto', embedThumbnail: true, embedMetadata: true, writeThumbnail: false,
  sponsorBlock: false, splitChapters: false, normalizeAudio: false,
  startTime: '', endTime: '', outputTemplate: '', customTemplate: '',
  speedLimit: '', concurrentFragments: 16, proxy: '', capture: false,
  priority: 5, delayMinutes: '', repeatEvery: '', webhookUrl: '',
}

function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn)
    else if (k === 'dataset') Object.assign(n.dataset, v)
    else if (k in n) n[k] = v
    else n.setAttribute(k, v)
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c)
  return n
}

/** Build the advanced-options form inside `root`. `values` = saved defaults.
 *  `onChange(values)` fires on every edit (used to remember choices). */
function renderAdvanced(root, values, onChange) {
  const v = { ...ADV_DEFAULTS, ...(values || {}) }
  const fire = () => onChange && onChange(readAdvanced(root))
  const check = (key, label, hint) => h('label', { className: 'check', title: hint || '' },
    h('input', { type: 'checkbox', dataset: { adv: key }, checked: !!v[key], on: { change: fire } }), label)
  const text = (key, label, ph, type = 'text') => h('label', {}, label,
    h('input', { type, dataset: { adv: key }, value: v[key] ?? '', placeholder: ph || '', on: { change: fire } }))
  const select = (key, label, opts) => h('label', {}, label,
    h('select', { dataset: { adv: key }, on: { change: fire } },
      opts.map(([val, txt]) => h('option', { value: String(val), textContent: txt, selected: String(v[key]) === String(val) }))))
  const section = (title, ...kids) => h('fieldset', { className: 'adv-sec' }, h('legend', {}, title), ...kids)

  const customTpl = text('customTemplate', 'Custom template', '%(title)s [%(id)s].%(ext)s')
  const syncTpl = () => { customTpl.hidden = root.querySelector('[data-adv=outputTemplate]').value !== '__custom__' }

  root.replaceChildren(
    section('Subtitles',
      check('subtitles', 'Download subtitles'),
      select('subtitleLang', 'Language', SUB_LANGS)),
    section('Clip',
      h('div', { className: 'grid2' }, text('startTime', 'Start', '0:30'), text('endTime', 'End', '2:10'))),
    section('Output',
      check('embedThumbnail', 'Embed thumbnail'),
      check('embedMetadata', 'Embed title / artist tags'),
      check('writeThumbnail', 'Also save thumbnail as a file'),
      select('outputTemplate', 'File name', OUTPUT_TEMPLATES), customTpl),
    section('Post-processing',
      check('sponsorBlock', 'Skip sponsor / intro segments (YouTube)'),
      check('splitChapters', 'Split into one file per chapter'),
      check('normalizeAudio', 'Normalize loudness')),
    section('Network & anti-blocking',
      h('label', {}, 'Proxy / VPN', h('select', { dataset: { adv: 'proxy' }, on: { change: fire } },
        h('option', { value: '', textContent: 'None (direct)' }),
        h('option', { value: 'auto', textContent: 'Auto (default / rotate saved)' }))),
      h('div', { className: 'grid2' },
        text('speedLimit', 'Speed limit', 'e.g. 5M (empty = unlimited)'),
        text('concurrentFragments', 'Parallel fragments', '16', 'number')),
      check('capture', 'Screen-capture fallback', 'Record streams that have no direct URL (not for DRM content)')),
    section('Scheduling',
      h('div', { className: 'grid2' },
        select('priority', 'Queue priority', [[1, 'High'], [5, 'Normal'], [10, 'Low']]),
        text('delayMinutes', 'Start in (minutes)', 'now', 'number')),
      select('repeatEvery', 'Repeat', [['', 'Once'], ['hourly', 'Every hour'], ['daily', 'Every day (09:00)'], ['weekly', 'Every Monday']])),
    section('When finished',
      text('webhookUrl', 'Call this webhook URL', 'https://…', 'url')),
  )
  root.querySelector('[data-adv=outputTemplate]').addEventListener('change', syncTpl)
  syncTpl()
  loadProxyOptions(root, v.proxy)
}

/** Fill the proxy dropdown from the server (presets + saved proxies). */
async function loadProxyOptions(root, selected) {
  const sel = root.querySelector('[data-adv=proxy]')
  try {
    const { presets = [], saved = [] } = await api('/api/proxy', { timeoutMs: 8000 })
    for (const p of saved) sel.append(h('option', { value: p.id, textContent: `★ ${p.label}${p.country ? ` (${p.country})` : ''}${p.is_default ? ' — default' : ''}` }))
    for (const p of presets) sel.append(h('option', { value: p.id, textContent: p.label }))
  } catch { /* server offline — keep None/Auto */ }
  sel.value = [...sel.options].some((o) => o.value === selected) ? selected : ''
}

function readAdvanced(root) {
  const out = {}
  for (const n of root.querySelectorAll('[data-adv]')) {
    out[n.dataset.adv] = n.type === 'checkbox' ? n.checked : n.value.trim()
  }
  return out
}

/** Convert form values to the extra fields of a POST /api/download body. */
function advancedPayload(a, { audio = false } = {}) {
  const tpl = a.outputTemplate === '__custom__' ? a.customTemplate : a.outputTemplate
  const lang = a.subtitleLang && a.subtitleLang !== 'auto' ? a.subtitleLang : null
  const p = {
    subtitles:      !audio && !!a.subtitles,
    subtitleLangs:  !audio && a.subtitles && lang ? [...new Set([lang, 'en', 'en-US'])] : undefined,
    embedThumbnail: !!a.embedThumbnail,
    embedMetadata:  a.embedMetadata !== false,
    writeThumbnail: !!a.writeThumbnail,
    sponsorBlock:   !!a.sponsorBlock,
    splitChapters:  !!a.splitChapters,
    normalizeAudio: !!a.normalizeAudio,
    capture:        !!a.capture,
    priority:       Number(a.priority) || 5,
    concurrentFragments: Math.min(16, Math.max(1, Number(a.concurrentFragments) || 16)),
  }
  if (a.startTime) p.startTime = a.startTime
  if (a.endTime) p.endTime = a.endTime
  if (tpl) p.outputTemplate = tpl
  if (a.speedLimit) p.speedLimit = a.speedLimit
  if (a.proxy) p.proxy = a.proxy
  if (a.webhookUrl) p.webhookUrl = a.webhookUrl
  if (Number(a.delayMinutes) > 0) p.delaySeconds = Math.round(Number(a.delayMinutes) * 60)
  if (a.repeatEvery) p.repeatEvery = a.repeatEvery
  return p
}

/** Short summary of what's switched on, for the collapsed "More options" row. */
function advancedSummary(a) {
  const on = []
  if (a.subtitles) on.push('subs')
  if (a.startTime || a.endTime) on.push('clip')
  if (a.sponsorBlock) on.push('SponsorBlock')
  if (a.splitChapters) on.push('chapters')
  if (a.normalizeAudio) on.push('normalize')
  if (a.proxy) on.push('proxy')
  if (a.speedLimit) on.push(`≤${a.speedLimit}/s`)
  if (Number(a.delayMinutes) > 0) on.push(`in ${a.delayMinutes} min`)
  if (a.repeatEvery) on.push(a.repeatEvery)
  if (Number(a.priority) === 1) on.push('high priority')
  if (a.webhookUrl) on.push('webhook')
  return on.join(' · ')
}
