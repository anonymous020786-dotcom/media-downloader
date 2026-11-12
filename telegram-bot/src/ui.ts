import { Markup } from 'telegraf'
import type { InlineKeyboardButton } from 'telegraf/types'
import type { JobView } from './api.js'
import type { UserSettings } from './session.js'
import { bar, bytes, esc, truncate } from './format.js'

type KB = InlineKeyboardButton[][]
const B = Markup.button.callback

// ── Home panel ──────────────────────────────────────────────────────────────
export function homeView(): { text: string; keyboard: KB } {
  return {
    text:
      '<b>🎬 MediaDL — control panel</b>\n' +
      'Send a link any time to download it. Or pick a section:',
    keyboard: [
      [B('⬇️ Download', 'menu:download'), B('🔎 Search', 'menu:search')],
      [B('📋 Queue', 'menu:queue'), B('⚙️ Settings', 'menu:settings')],
      [B('🌐 Proxy', 'menu:proxy'), B('🍪 Cookies', 'menu:cookies')],
      [B('📊 Status', 'menu:status'), B('❓ Help', 'menu:help')],
    ],
  }
}

export function backRow(to = 'menu:home'): InlineKeyboardButton[] {
  return [B('◀️ Back', to), B('✖️ Close', 'menu:close')]
}

export function downloadView(s: UserSettings): { text: string; keyboard: KB } {
  return {
    text:
      '<b>⬇️ Download</b>\n\n' +
      'Just send me a URL — video, image page, playlist, file host, torrent/magnet or an HLS link.\n\n' +
      `Current defaults: <b>${esc(s.quality)}</b> · ${esc(s.videoFormat)} / ${esc(s.audioFormat)}` +
      `${s.autoDownloadBest ? ' · auto (no menu)' : ''}` +
      `${s.proxy ? ` · proxy ${esc(s.proxy)}` : ''}`,
    keyboard: [
      [B(`${s.autoDownloadBest ? '✅' : '▫️'} Skip quality menu`, 'set:autoDownloadBest')],
      [B('🎬 Change quality', 'set:quality'), B('🎵 Audio format', 'set:aformat')],
      [B('📥 Paste multiple (batch)', 'menu:batch')],
      backRow(),
    ],
  }
}

export function searchMenuView(): { text: string; keyboard: KB } {
  return {
    text: '<b>🔎 Search</b>\nPick a type, then send your query:',
    keyboard: [
      [B('🌐 Web', 'menu:s:web'), B('🎬 Video', 'menu:s:video'), B('🖼 Image', 'menu:s:image')],
      [B('📄 File', 'menu:s:file'), B('🧲 Torrent', 'menu:s:torrent'), B('📰 News', 'menu:s:news')],
      backRow(),
    ],
  }
}

// ── Queue ───────────────────────────────────────────────────────────────────
export function queueView(jobs: JobView[]): { text: string; keyboard: KB } {
  const sorted = [...jobs].sort((a, b) => b.addedAt - a.addedAt).slice(0, 12)
  const active = sorted.filter((j) => !['completed', 'failed'].includes(j.progress.status))

  const lines = ['<b>📋 Queue</b>']
  if (!sorted.length) lines.push('\nNothing this session.')
  for (const j of sorted) {
    const p = j.progress
    const icon = p.status === 'completed' ? '✅' : p.status === 'failed' ? '❌' : p.status === 'downloading' ? '⬇️' : '⏳'
    const tail =
      p.status === 'completed' ? `${p.files?.length ?? 0} file(s)` :
      p.status === 'failed' ? esc(truncate(p.error || 'failed', 50)) :
      `${bar(p.progress, 8)} ${Math.round(p.progress || 0)}%`
    lines.push(`${icon} <b>${esc(truncate(j.title || j.url, 48))}</b>\n   <code>${j.jobId.slice(0, 8)}</code> · ${tail}`)
  }

  const kb: KB = []
  for (const j of active.slice(0, 6)) {
    kb.push([B(`🛑 Stop ${truncate(j.title || j.jobId.slice(0, 8), 40)}`, `job:kill:${j.jobId}`)])
  }
  kb.push([B('🔄 Refresh', 'menu:queue'), B('🛑 Stop all', 'jobs:stopall'), B('🧹 Clear done', 'jobs:clear')])
  kb.push(backRow())
  return { text: lines.join('\n'), keyboard: kb }
}

// ── Settings ────────────────────────────────────────────────────────────────
export function settingsView(s: UserSettings): { text: string; keyboard: KB } {
  const on = (b: boolean) => (b ? '✅' : '▫️')
  const text =
    '<b>⚙️ Download settings</b>\nApplied to every download unless you pick otherwise on the card.\n\n' +
    `Proxy: <code>${esc(s.proxy || 'direct')}</code>\n` +
    `Speed limit: <code>${s.speedLimit || 'unlimited'}</code>\n` +
    `HLS fragments: <code>${s.concurrentFragments}</code>`
  const kb: KB = [
    [B(`🎬 Quality: ${s.quality}`, 'set:quality'), B(`📼 Video: ${s.videoFormat}`, 'set:vformat'), B(`🎵 Audio: ${s.audioFormat}`, 'set:aformat')],
    [B(`${on(s.subtitles)} Subtitles`, 'set:subtitles'), B(`${on(s.embedThumbnail)} Embed thumb`, 'set:embedThumbnail'), B(`${on(s.embedMetadata)} Metadata`, 'set:embedMetadata')],
    [B(`${on(s.sponsorBlock)} SponsorBlock`, 'set:sponsorBlock'), B(`${on(s.splitChapters)} Split chapters`, 'set:splitChapters')],
    [B(`${on(s.normalizeAudio)} Normalize audio`, 'set:normalizeAudio'), B(`${on(s.writeThumbnail)} Save thumb file`, 'set:writeThumbnail')],
    [B(`${on(s.autoDownloadBest)} Skip quality menu`, 'set:autoDownloadBest'), B('🐌 Speed limit', 'set:speedlimit')],
    [B(`${on(s.adult)} 🔞 Adult content`, 'set:adult')],
    [B('🌐 Direct', 'set:proxy:'), B('🔁 Auto-proxy', 'set:proxy:auto'), B('↔️ Fragments', 'set:fragments')],
    [B('♻️ Reset', 'set:reset')],
    backRow(),
  ]
  return { text, keyboard: kb }
}

export { bytes }
