// MediaDL browser extension — sends URLs to your MediaDL server's /api/download/auto

const DEFAULT_API = 'http://localhost:4000'

async function apiBase() {
  const { apiUrl } = await chrome.storage.sync.get('apiUrl')
  return (apiUrl || DEFAULT_API).replace(/\/$/, '')
}

async function sendToMediaDL(url) {
  if (!url) return
  try {
    const base = await apiBase()
    const res = await fetch(`${base}/api/download/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    notify('Queued in MediaDL ✓', `${data.mediaType || 'media'} → ${url.slice(0, 60)}`)
  } catch (e) {
    notify('MediaDL error', `Could not reach server. Is it running? (${e.message})`)
  }
}

function notify(title, message) {
  try {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icon.png', title, message })
  } catch { /* notifications optional */ }
}

chrome.runtime.onInstalled.addListener(() => {
  const ctx = [
    { id: 'mediadl-link',  title: 'Download link with MediaDL',  contexts: ['link'] },
    { id: 'mediadl-video', title: 'Download video with MediaDL', contexts: ['video'] },
    { id: 'mediadl-image', title: 'Download image with MediaDL', contexts: ['image'] },
    { id: 'mediadl-audio', title: 'Download audio with MediaDL', contexts: ['audio'] },
    { id: 'mediadl-page',  title: 'Download this page with MediaDL', contexts: ['page'] },
    { id: 'mediadl-sel',   title: 'Download selected URL with MediaDL', contexts: ['selection'] },
  ]
  ctx.forEach((c) => chrome.contextMenus.create(c))
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url =
    info.linkUrl || info.srcUrl ||
    (info.menuItemId === 'mediadl-sel' ? (info.selectionText || '').trim() : '') ||
    info.pageUrl || (tab && tab.url)
  sendToMediaDL(url)
})
