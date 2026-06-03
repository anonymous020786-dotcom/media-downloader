// Save a remote file to a user-chosen location.
// Uses the File System Access API (Chromium) when available so the user can
// pick the exact folder/filename; falls back to a normal browser download.

function extToMime(name: string): string {
  const e = (name.split('.').pop() || '').toLowerCase()
  const map: Record<string, string> = {
    mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', mov: 'video/quicktime',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', opus: 'audio/opus', flac: 'audio/flac', wav: 'audio/wav',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp',
  }
  return map[e] || 'application/octet-stream'
}

export async function saveToLocation(url: string, filename: string): Promise<'picker' | 'download' | 'error'> {
  // Preferred: let the user choose where to save (Chromium desktop)
  const anyWin = window as any
  if (typeof anyWin.showSaveFilePicker === 'function') {
    try {
      const ext = filename.includes('.') ? filename.split('.').pop()! : ''
      const handle = await anyWin.showSaveFilePicker({
        suggestedName: filename,
        types: ext ? [{ description: 'File', accept: { [extToMime(filename)]: ['.' + ext] } }] : undefined,
      })
      const writable = await handle.createWritable()
      const resp = await fetch(url)
      if (!resp.ok || !resp.body) throw new Error('fetch failed')
      // Stream straight to disk (handles huge videos without buffering in RAM)
      await resp.body.pipeTo(writable)
      return 'picker'
    } catch (e: any) {
      // User cancelled the picker — not an error
      if (e?.name === 'AbortError') return 'download'
      // fall through to normal download
    }
  }

  // Fallback: trigger a normal browser download to the default folder
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    return 'download'
  } catch {
    return 'error'
  }
}
