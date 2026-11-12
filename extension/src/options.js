/* global ext, getSettings, DEFAULT_SETTINGS, renderAdvanced, stickyAdv, ONE_SHOT_KEYS */
const $ = (id) => document.getElementById(id)
const TEXT = ['serverUrl', 'botUsername']
const SELECT = ['kind', 'quality', 'videoFormat', 'audioFormat']
const CHECK = ['autoSave', 'notify']

function msg(text, kind = '') { const m = $('testMsg'); m.hidden = !text; m.textContent = text; m.className = `msg ${kind}` }

function normalizeServer(raw) {
  let v = (raw || '').trim() || DEFAULT_SETTINGS.serverUrl
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`
  return new URL(v).origin // drops paths / trailing slashes
}

/** Ask for permission to talk to the server (Firefox asks even for localhost;
 *  Chromium already has localhost and only asks for other addresses). */
async function grantServer(origin) {
  const origins = [`${origin}/*`]
  if (await ext.permissions.contains({ origins })) return true
  return ext.permissions.request({ origins })
}

;(async () => {
  const s = await getSettings()
  for (const id of [...TEXT, ...SELECT]) $(id).value = s[id] ?? ''
  for (const id of CHECK) $(id).checked = !!s[id]
  $('sniff').checked = await ext.permissions.contains({ origins: ['<all_urls>'] })

  const adv = $('adv')
  renderAdvanced(adv, s.adv, (a) => ext.storage.sync.set({ adv: stickyAdv(a) }))
  for (const k of ONE_SHOT_KEYS) adv.querySelector(`[data-adv=${k}]`)?.closest('label').setAttribute('hidden', '')
  for (const fs of adv.querySelectorAll('fieldset')) {
    if (![...fs.querySelectorAll('label')].some((l) => !l.hidden)) fs.hidden = true
  }

  for (const id of [...TEXT, ...SELECT]) $(id).addEventListener('change', () => ext.storage.sync.set({ [id]: $(id).value.trim() }))
  for (const id of CHECK) $(id).addEventListener('change', () => ext.storage.sync.set({ [id]: $(id).checked }))
})()

$('test').addEventListener('click', async () => {
  let origin
  try { origin = normalizeServer($('serverUrl').value) } catch { return msg('That is not a valid address.', 'err') }
  // permissions.request must run straight from the click (Firefox), so ask first.
  const ok = await grantServer(origin)
  if (!ok) return msg(`The browser did not allow access to ${origin}.`, 'err')
  $('serverUrl').value = origin
  await ext.storage.sync.set({ serverUrl: origin })
  msg('Connecting…')
  try {
    const r = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(6000) })
    const h = await r.json()
    msg(`✅ Connected to MediaDL v${h.version ?? '?'} at ${origin}.`, 'ok')
  } catch {
    msg(`❌ Nothing answered at ${origin}.\nStart MediaDL (npm run dev in the media-downloader folder) and try again.`, 'err')
  }
})

$('sniff').addEventListener('change', async () => {
  const origins = ['<all_urls>']
  if ($('sniff').checked) $('sniff').checked = await ext.permissions.request({ origins })
  else await ext.permissions.remove({ origins })
})
