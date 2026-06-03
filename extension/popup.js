const $ = (id) => document.getElementById(id)
const DEFAULT_API = 'http://localhost:4000'

// Load saved server URL + prefill current tab URL
chrome.storage.sync.get('apiUrl', ({ apiUrl }) => { $('api').value = apiUrl || DEFAULT_API })
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0] && tabs[0].url && tabs[0].url.startsWith('http')) $('url').value = tabs[0].url
})

$('save').addEventListener('click', () => {
  const apiUrl = ($('api').value || DEFAULT_API).replace(/\/$/, '')
  chrome.storage.sync.set({ apiUrl }, () => { $('save').textContent = 'Saved ✓'; setTimeout(() => $('save').textContent = 'Save server URL', 1200) })
})

$('send').addEventListener('click', async () => {
  const url = $('url').value.trim()
  if (!url) return
  const base = ($('api').value || DEFAULT_API).replace(/\/$/, '')
  $('send').textContent = 'Sending…'
  try {
    const res = await fetch(`${base}/api/download/auto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    $('ok').style.display = 'block'
    $('send').textContent = '⬇ Send to MediaDL'
  } catch (e) {
    $('send').textContent = 'Error — check server URL'
    setTimeout(() => $('send').textContent = '⬇ Send to MediaDL', 1800)
  }
})
