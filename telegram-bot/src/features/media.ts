import { Telegraf, Markup } from 'telegraf'
import type { InlineKeyboardButton } from 'telegraf/types'
import type { BotContext } from '../types.js'
import { api, type AnalyzeResult, type DownloadOptions } from '../api.js'
import { getSettings, mediaTokens, setAwaiting, takeAwaiting, type PendingMedia } from '../session.js'
import { bytes, duration, esc, extractUrl, truncate } from '../format.js'
import { reachable } from '../config.js'
import { trackJob } from '../jobs.js'

/** Turn the user's saved settings into the option bag every download shares. */
function baseOptions(userId: number): Partial<DownloadOptions> {
  const s = getSettings(userId)
  return {
    subtitles: s.subtitles,
    embedThumbnail: s.embedThumbnail,
    embedMetadata: s.embedMetadata,
    sponsorBlock: s.sponsorBlock,
    splitChapters: s.splitChapters,
    normalizeAudio: s.normalizeAudio,
    writeThumbnail: s.writeThumbnail,
    speedLimit: s.speedLimit || undefined,
    proxy: s.proxy || undefined,
    concurrentFragments: s.concurrentFragments,
  }
}

export function mediaCard(token: string, a: AnalyzeResult, userId: number): { text: string; keyboard: InlineKeyboardButton[][] } {
  const s = getSettings(userId)
  const lines: string[] = []
  const title = a.title || a.filename || a.url || 'media'
  lines.push(`🔎 <b>${esc(truncate(title, 90))}</b>`)

  const meta: string[] = [`type: ${a.type}`]
  if (a.extractor) meta.push(a.extractor)
  if (a.duration) meta.push(`⏱ ${duration(a.duration)}`)
  if (a.size) meta.push(`💾 ${bytes(a.size)}`)
  if (a.uploader) meta.push(`👤 ${a.uploader}`)
  if (a.item_count) meta.push(`📃 ${a.item_count} items`)
  else if (a.playlist_count) meta.push(`📃 ${a.playlist_count} items`)
  if (a.is_live) meta.push('🔴 LIVE')
  if (a._cached) meta.push('(cached)')
  lines.push(`<i>${esc(meta.join('  ·  '))}</i>`)
  if (a.note) lines.push(esc(a.note))
  const why = a.error ?? a.extract_error
  if (why) lines.push(`⚠️ ${esc(why.hint)}`)

  const kb: InlineKeyboardButton[][] = []
  const isPlaylist = a.type === 'playlist' || a.is_playlist

  if (isPlaylist) {
    lines.push('\nPick how many items to grab:')
    kb.push([
      Markup.button.callback('⬇️ All', `dl:${token}:pl:0`),
      Markup.button.callback('First 10', `dl:${token}:pl:10`),
      Markup.button.callback('First 25', `dl:${token}:pl:25`),
    ])
    kb.push([
      Markup.button.callback('First 50', `dl:${token}:pl:50`),
      Markup.button.callback(`🎵 Audio ×all (${s.audioFormat})`, `dl:${token}:pla:0`),
    ])
  } else if (a.type === 'video' && a.audio_only) {
    const best = a.audio_options?.[0]
    lines.push(`\n🎵 Audio-only source${best?.abr ? ` · up to ${best.abr} kbps` : ''}${best?.size ? ` · ~${bytes(best.size)}` : ''}. Pick a format:`)
    const fmts = Array.from(new Set([s.audioFormat, 'mp3', 'm4a', 'opus', 'flac']))
    for (let i = 0; i < fmts.length; i += 3) {
      kb.push(fmts.slice(i, i + 3).map((f) => Markup.button.callback(`🎵 ${f.toUpperCase()}`, `dl:${token}:a:${f}`)))
    }
    kb.push([Markup.button.callback('✂️ Clip', `clip:${token}`), Markup.button.callback('⚙️ Options', 'settings:open')])
  } else if (a.type === 'video') {
    const opts = a.format_options?.length
      ? a.format_options.map((f) => ({ label: `${f.height}p${f.size ? ` · ${bytes(f.size)}` : ''}`, q: String(f.height) }))
      : (a.qualities ?? []).map((h) => ({ label: `${h}p`, q: String(h) }))

    if (a.is_stream || a.is_live || opts.length === 0) {
      lines.push('\nNo fixed qualities — will grab the best available stream.')
      kb.push([Markup.button.callback(`⬇️ Best (${s.videoFormat})`, `dl:${token}:q:best`)])
    } else {
      lines.push('\nPick a quality:')
      for (let i = 0; i < opts.length; i += 2) {
        kb.push(
          opts.slice(i, i + 2).map((o) => Markup.button.callback(`⬇️ ${o.label}`, `dl:${token}:q:${o.q}`)),
        )
      }
      kb.push([
        Markup.button.callback(`⬇️ Best`, `dl:${token}:q:best`),
        Markup.button.callback(`🏆 Max`, `dl:${token}:q:max`),
      ])
    }
    kb.push([
      Markup.button.callback(`🎵 ${s.audioFormat.toUpperCase()}`, `dl:${token}:a:${s.audioFormat}`),
      Markup.button.callback('✂️ Clip', `clip:${token}`),
      Markup.button.callback('⚙️ Options', 'settings:open'),
    ])
  } else if (a.type === 'page' && a.error) {
    // Nothing found — say why, and offer the one action that can fix it.
    if (a.error.reason === 'login') kb.push([Markup.button.callback('🍪 Add cookies', 'menu:cookies')])
    else if (a.error.reason === 'network' || a.error.reason === 'blocked') {
      kb.push([Markup.button.callback('🌐 Proxy settings', 'menu:proxy')])
    }
    kb.push([Markup.button.callback('🖼 Try scraping images anyway', `dl:${token}:img:original`)])
  } else if (a.type === 'image' || a.type === 'page') {
    lines.push('\nScrape and download every image on the page.')
    kb.push([Markup.button.callback('🖼 Download images', `dl:${token}:img:original`)])
    if (a.type === 'page') kb.push([Markup.button.callback('👁 Preview image list', `preview:${token}`)])
  } else if (a.type === 'file' || a.type === 'torrent') {
    kb.push([Markup.button.callback(`⬇️ Download ${a.type === 'torrent' ? 'torrent' : 'file'}`, `dl:${token}:file:x`)])
  }

  return { text: lines.join('\n'), keyboard: kb }
}

export async function analyzeAndReply(ctx: BotContext, url: string) {
  const userId = ctx.from!.id
  const wait = await ctx.reply('🔎 Analyzing…')
  let a: AnalyzeResult
  try {
    a = await api.analyze(url)
    // A playlist/channel URL analyzes as a single video — check for item count.
    if (a.type === 'video' && a.is_playlist) {
      try { a = { ...(await api.analyzePlaylist(url)), thumbnail: a.thumbnail } } catch { /* keep video result */ }
    }
  } catch (e: any) {
    await ctx.telegram.editMessageText(wait.chat.id, wait.message_id, undefined, `❌ ${esc(e.message)}`, { parse_mode: 'HTML' })
    return
  }
  if (!a.url) a.url = url

  const s = getSettings(userId)
  const token = mediaTokens.put({ url, analysis: a, userId })

  // Fast path: user opted out of the quality menu.
  if (s.autoDownloadBest && (a.type === 'video')) {
    await ctx.telegram.deleteMessage(wait.chat.id, wait.message_id).catch(() => {})
    await startDownload(ctx, { url, analysis: a, userId }, { kind: 'q', value: s.quality })
    return
  }

  const { text, keyboard } = mediaCard(token, a, userId)
  await ctx.telegram.editMessageText(wait.chat.id, wait.message_id, undefined, text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard },
  })
}

interface Choice { kind: 'q' | 'a' | 'img' | 'file' | 'pl' | 'pla'; value: string }

export async function startDownload(ctx: BotContext, pending: PendingMedia, choice: Choice, extra: Partial<DownloadOptions> = {}) {
  const { url, analysis: a, userId } = pending
  const s = getSettings(userId)
  const opts: DownloadOptions = { url, mediaType: 'video', ...baseOptions(userId), ...extra }
  let header = truncate(a.title || a.filename || url, 70)

  switch (choice.kind) {
    case 'q':
      opts.mediaType = 'video'
      opts.format = s.videoFormat
      opts.quality = choice.value || s.quality || 'best'
      header = `🎬 ${header} · ${opts.quality}`
      break
    case 'a':
      opts.mediaType = 'video'
      opts.format = choice.value || s.audioFormat
      opts.quality = 'best'
      header = `🎵 ${header} · ${opts.format}`
      break
    case 'img':
      opts.mediaType = a.type === 'page' ? 'page' : 'image'
      opts.format = choice.value || 'original'
      header = `🖼 ${header}`
      break
    case 'file':
      opts.mediaType = a.type === 'torrent' ? 'torrent' : 'file'
      opts.format = 'original'
      header = `📦 ${header}`
      break
    case 'pl':
    case 'pla': {
      opts.mediaType = 'playlist'
      opts.format = choice.kind === 'pla' ? s.audioFormat : s.videoFormat
      opts.quality = choice.kind === 'pla' ? 'best' : s.quality
      const n = Number(choice.value || '0')
      if (n > 0) opts.maxItems = n
      opts.startIndex = 1
      header = `📃 ${header}${n ? ` · first ${n}` : ' · all'}`
      break
    }
  }

  // Explicit per-call overrides (clip times, gif format, sub langs, capture…)
  // win over the choice-derived defaults set in the switch above.
  Object.assign(opts, extra)

  const chatId = ctx.chat?.id ?? ctx.from!.id
  const scheduled = !!(extra.delaySeconds || extra.repeatEvery)
  const isPlaylist = choice.kind === 'pl' || choice.kind === 'pla'
  const isPageScrape = opts.mediaType === 'page' || opts.mediaType === 'image'

  // ── Fast path: pipe the file straight to the user's device, no server disk.
  // Only for a single item that isn't scheduled, captured, clipped or scraped.
  const canStream = !scheduled && !isPlaylist && !isPageScrape && !opts.capture && !opts.startTime
  if (canStream) {
    try {
      const s = await api.stream({ url, format: opts.format, quality: opts.quality, cookies: opts.cookies, proxy: opts.proxy })
      const link = reachable(s.url)
      await ctx.reply(
        `⬇️ <b>${esc(header)}</b>\nTap to download straight to your device — nothing is stored on the server:\n${esc(link)}` +
          (/\/\/(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(link) ? '\n\n<i>Open on a device on the same Wi-Fi as the server.</i>' : ''),
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
      )
      return
    } catch (e: any) {
      // 422 = this source can't be streamed (falls through to the download job)
      if (e?.status !== 422) console.warn('[stream] falling back to job:', e?.message)
    }
  }

  let res: { jobId: string; scheduled?: boolean; recurring?: string }
  try {
    res = await api.download(opts)
  } catch (e: any) {
    await ctx.reply(`❌ Couldn't queue download: ${esc(e.message)}`, { parse_mode: 'HTML' })
    return
  }

  if (res.recurring) {
    await ctx.reply(`🔁 Scheduled <b>${esc(res.recurring)}</b> — new copies download automatically. Manage with /schedules.`, { parse_mode: 'HTML' })
    return
  }
  if (res.scheduled) {
    await ctx.reply(`⏰ Queued for later. It'll appear in /jobs when it starts.`)
    return
  }

  void trackJob(ctx.telegram, chatId, res.jobId, {
    header,
    redoToken: mediaTokens.put(pending),
  })
}

export function registerMedia(bot: Telegraf<BotContext>) {
  bot.command(['analyze', 'dl', 'download'], async (ctx) => {
    const url = extractUrl(ctx.payload) || extractUrl(ctx.message.text)
    if (!url) return ctx.reply('Usage: /analyze <url>  — or just send me a link.')
    await analyzeAndReply(ctx, url)
  })

  bot.command('audio', async (ctx) => {
    const url = extractUrl(ctx.payload)
    if (!url) return ctx.reply('Usage: /audio <url>')
    const userId = ctx.from!.id
    const s = getSettings(userId)
    let a: AnalyzeResult
    try { a = await api.analyze(url) } catch (e: any) { return ctx.reply(`❌ ${e.message}`) }
    await startDownload(ctx, { url, analysis: a, userId }, { kind: 'a', value: s.audioFormat })
  })

  bot.command('best', async (ctx) => {
    const url = extractUrl(ctx.payload)
    if (!url) return ctx.reply('Usage: /best <url>')
    const userId = ctx.from!.id
    let a: AnalyzeResult
    try { a = await api.analyze(url) } catch (e: any) { return ctx.reply(`❌ ${e.message}`) }
    await startDownload(ctx, { url, analysis: a, userId }, { kind: 'q', value: 'best' })
  })

  bot.command('capture', async (ctx) => {
    const parts = ctx.payload.trim().split(/\s+/)
    const url = extractUrl(parts[0])
    if (!url) return ctx.reply('Usage: /capture <url> [seconds]  — record playback for MSE/blob streams with no direct file.')
    const seconds = Number(parts[1]) || undefined
    const userId = ctx.from!.id
    let a: AnalyzeResult
    try { a = await api.analyze(url) } catch (e: any) { return ctx.reply(`❌ ${e.message}`) }
    await startDownload(ctx, { url, analysis: a, userId }, { kind: 'q', value: 'best' }, { capture: true, captureSeconds: seconds })
  })

  // ── Callback: a download button on a media card ────────────────────────────
  bot.action(/^dl:([0-9a-f]{8}):(q|a|img|file|pl|pla):(.+)$/, async (ctx) => {
    const [, token, kind, value] = ctx.match
    const pending = mediaTokens.get(token)
    if (!pending) { await ctx.answerCbQuery('This card expired — send the link again.', { show_alert: true }); return }
    await ctx.answerCbQuery('Queued ✅')
    await ctx.editMessageReplyMarkup(undefined).catch(() => {})
    await startDownload(ctx, pending, { kind: kind as Choice['kind'], value })
  })

  bot.action(/^preview:([0-9a-f]{8})$/, async (ctx) => {
    const pending = mediaTokens.get(ctx.match[1])
    if (!pending) { await ctx.answerCbQuery('Expired', { show_alert: true }); return }
    await ctx.answerCbQuery('Scraping…')
    try {
      const p = await api.previewPage(pending.url)
      const sample = p.items.slice(0, 15).map((i, n) => `${n + 1}. ${esc(i.url)}`).join('\n')
      await ctx.reply(`👁 <b>${esc(p.page_title || pending.url)}</b>\n${p.total} image(s) found.\n\n${sample}${p.total > 15 ? '\n…' : ''}`, {
        parse_mode: 'HTML', link_preview_options: { is_disabled: true },
      })
    } catch (e: any) { await ctx.reply(`❌ ${esc(e.message)}`, { parse_mode: 'HTML' }) }
  })

  bot.action(/^clip:([0-9a-f]{8})$/, async (ctx) => {
    const token = ctx.match[1]
    if (!mediaTokens.get(token)) { await ctx.answerCbQuery('Card expired.', { show_alert: true }); return }
    setAwaiting(ctx.from!.id, { kind: 'clip', token })
    await ctx.answerCbQuery()
    await ctx.reply('✂️ Send the time range as <code>START END</code> — e.g. <code>0:30 1:45</code> or <code>00:01:00 00:02:30</code>.', { parse_mode: 'HTML' })
  })

  // Re-open a media card (from the "Redo" button after a download)
  bot.action(/^redo:([0-9a-f]{8})$/, async (ctx) => {
    const pending = mediaTokens.get(ctx.match[1])
    if (!pending) { await ctx.answerCbQuery('Expired — send the link again.', { show_alert: true }); return }
    await ctx.answerCbQuery()
    const token = mediaTokens.put(pending)
    const { text, keyboard } = mediaCard(token, pending.analysis, ctx.from!.id)
    await ctx.reply(text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: keyboard } })
  })

  // ── /mp3 — alias for a quick audio grab ───────────────────────────────────
  bot.command('mp3', async (ctx) => {
    const url = extractUrl(ctx.payload)
    if (!url) return ctx.reply('Usage: /mp3 <url>')
    const userId = ctx.from!.id
    let a: AnalyzeResult
    try { a = await api.analyze(url) } catch (e: any) { return ctx.reply(`❌ ${e.message}`) }
    await startDownload(ctx, { url, analysis: a, userId }, { kind: 'a', value: 'mp3' })
  })

  // ── /info — metadata only, no download menu ───────────────────────────────
  bot.command(['info', 'meta'], async (ctx) => {
    const url = extractUrl(ctx.payload)
    if (!url) return ctx.reply('Usage: /info <url>')
    const wait = await ctx.reply('🔎 …')
    let a: AnalyzeResult
    try { a = await api.analyze(url) } catch (e: any) {
      return ctx.telegram.editMessageText(wait.chat.id, wait.message_id, undefined, `❌ ${esc(e.message)}`, { parse_mode: 'HTML' })
    }
    const rows = [
      `<b>${esc(a.title || a.filename || url)}</b>`,
      `type: <code>${a.type}</code>${a.extractor ? ` · ${esc(a.extractor)}` : ''}`,
      a.duration ? `duration: ${duration(a.duration)}` : '',
      a.uploader ? `uploader: ${esc(a.uploader)}` : '',
      a.size ? `size: ${bytes(a.size)}` : '',
      a.qualities?.length ? `qualities: ${a.qualities.join(', ')}` : '',
      a.item_count ? `items: ${a.item_count}` : a.playlist_count ? `items: ${a.playlist_count}` : '',
      a.is_live ? 'LIVE' : '',
      a.note ? `<i>${esc(a.note)}</i>` : '',
    ].filter(Boolean)
    const token = mediaTokens.put({ url, analysis: a, userId: ctx.from!.id })
    await ctx.telegram.editMessageText(wait.chat.id, wait.message_id, undefined, rows.join('\n'), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [[{ text: '⬇️ Download…', callback_data: `redo:${token}` }]] },
    })
  })

  // ── /thumb — just the poster/thumbnail image ──────────────────────────────
  bot.command('thumb', async (ctx) => {
    const url = extractUrl(ctx.payload)
    if (!url) return ctx.reply('Usage: /thumb <url>')
    try {
      const a = await api.analyze(url)
      if (a.thumbnail) await ctx.replyWithPhoto(a.thumbnail, { caption: esc(a.title || ''), parse_mode: 'HTML' })
      else await ctx.reply('No thumbnail found for that link.')
    } catch (e: any) { await ctx.reply(`❌ ${esc(e.message)}`, { parse_mode: 'HTML' }) }
  })

  // ── /subs — download subtitles only ──────────────────────────────────────
  bot.command(['subs', 'subtitles'], async (ctx) => {
    const parts = ctx.payload.trim().split(/\s+/)
    const url = extractUrl(parts[0])
    if (!url) return ctx.reply('Usage: /subs <url> [lang…]   e.g. /subs <url> en es')
    const langs = parts.slice(1).filter((p) => /^[a-z-]{2,5}$/i.test(p))
    const userId = ctx.from!.id
    let a: AnalyzeResult
    try { a = await api.analyze(url) } catch (e: any) { return ctx.reply(`❌ ${e.message}`) }
    await startDownload(ctx, { url, analysis: a, userId }, { kind: 'q', value: '360' }, {
      subtitles: true, subtitleLangs: langs.length ? langs : undefined,
    })
  })

  // ── /gif — make a GIF from a time range ──────────────────────────────────
  bot.command('gif', async (ctx) => {
    const parts = ctx.payload.trim().split(/\s+/)
    const url = extractUrl(parts[0])
    if (!url || !parts[1]) return ctx.reply('Usage: /gif <url> <start> [end]   e.g. /gif <url> 0:12 0:18')
    const userId = ctx.from!.id
    let a: AnalyzeResult
    try { a = await api.analyze(url) } catch (e: any) { return ctx.reply(`❌ ${e.message}`) }
    await startDownload(ctx, { url, analysis: a, userId }, { kind: 'q', value: '480' }, {
      format: 'gif', startTime: parts[1], endTime: parts[2],
    })
  })

  // Bare URL (no command) is handled in index.ts message handler → analyzeAndReply.
}

/** Consume a plain message when the user is entering a clip time range. */
export async function consumeAwaitingClip(ctx: BotContext, text: string): Promise<boolean> {
  const a = takeAwaiting(ctx.from!.id)
  if (a?.kind !== 'clip') { if (a) setAwaiting(ctx.from!.id, a); return false }
  const pending = mediaTokens.get(a.token)
  if (!pending) { await ctx.reply('That card expired — send the link again.'); return true }
  const [start, end] = text.trim().split(/\s+/)
  if (!start) { await ctx.reply('Need at least a start time.'); return true }
  await startDownload(ctx, pending, { kind: 'q', value: getSettings(ctx.from!.id).quality }, { startTime: start, endTime: end })
  return true
}
