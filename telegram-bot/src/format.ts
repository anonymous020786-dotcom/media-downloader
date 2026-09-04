import type { JobProgress } from './api.js'

/** Escape text for Telegram HTML parse mode. */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function bytes(n: number | null | undefined): string {
  if (!n || n < 0) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`
}

export function duration(secs: number | null | undefined): string {
  if (!secs || secs < 0) return '—'
  const s = Math.round(secs)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${m}:${String(ss).padStart(2, '0')}`
}

export function speed(bps: number | null | undefined): string {
  return bps && bps > 0 ? `${bytes(bps)}/s` : '—'
}

export function bar(pct: number, width = 12): string {
  const p = Math.max(0, Math.min(100, pct || 0))
  const filled = Math.round((p / 100) * width)
  return '▰'.repeat(filled) + '▱'.repeat(width - filled)
}

const STATUS_LABEL: Record<string, string> = {
  queued: '⏳ Queued',
  starting: '🚀 Starting',
  downloading: '⬇️ Downloading',
  scraping: '🕸 Scraping',
  converting: '🎞 Converting',
  processing: '⚙️ Processing',
  completed: '✅ Completed',
  failed: '❌ Failed',
  unknown: '❔ Unknown',
}

export function renderProgress(p: JobProgress, header?: string): string {
  const lines: string[] = []
  if (header) lines.push(`<b>${esc(header)}</b>`)
  lines.push(`${STATUS_LABEL[p.status] ?? p.status}  <code>${bar(p.progress)}</code> ${Math.round(p.progress || 0)}%`)

  const meta: string[] = []
  if (p.status === 'downloading') {
    if (p.downloaded != null && p.total != null && p.total > 0) meta.push(`${bytes(p.downloaded)} / ${bytes(p.total)}`)
    else if (p.downloaded != null) meta.push(bytes(p.downloaded))
    if (p.speed) meta.push(speed(p.speed))
    if (p.eta) meta.push(`ETA ${duration(p.eta)}`)
  }
  if (p.total_files) meta.push(`file ${p.completed_files ?? 0}/${p.total_files}`)
  if (meta.length) lines.push(esc(meta.join('  ·  ')))
  if (p.filename) lines.push(`<code>${esc(p.filename)}</code>`)
  if (p.note) lines.push(`<i>${esc(p.note)}</i>`)
  if (p.status === 'failed' && p.error) lines.push(`<i>${esc(p.error)}</i>`)
  return lines.join('\n')
}

/** First http(s) URL / magnet in a string. */
export function extractUrl(text: string | undefined): string | undefined {
  if (!text) return undefined
  const m = text.match(/\b(?:https?:\/\/|magnet:\?)[^\s<>"']+/i)
  return m?.[0]
}

/** All http(s) URLs / magnets in a string, deduped, in order. */
export function extractUrls(text: string | undefined): string[] {
  if (!text) return []
  const m = text.match(/(?:https?:\/\/|magnet:\?)[^\s<>"']+/gi) ?? []
  return [...new Set(m)]
}

export function truncate(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
