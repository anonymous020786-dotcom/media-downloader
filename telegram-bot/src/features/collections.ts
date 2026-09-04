import { Telegraf, Markup } from 'telegraf'
import type { BotContext } from '../types.js'
import { api, type AnalyzeResult } from '../api.js'
import { getSettings, mediaTokens, setAwaiting, takeAwaiting } from '../session.js'
import { esc, extractUrl, extractUrls, truncate } from '../format.js'
import { trackJob } from '../jobs.js'
import { startDownload } from './media.js'

async function runBatch(ctx: BotContext, urls: string[]) {
  const userId = ctx.from!.id
  const s = getSettings(userId)
  if (!urls.length) return ctx.reply('No URLs found.')
  if (urls.length > 200) return ctx.reply('Maximum 200 URLs per batch.')

  const note = await ctx.reply(`📦 Queuing ${urls.length} URL(s)…`)
  let out
  try {
    out = await api.batch(urls.map((url) => ({ url })), {
      quality: s.quality,
      format: s.videoFormat,
      subtitles: s.subtitles,
      embedThumbnail: s.embedThumbnail,
      embedMetadata: s.embedMetadata,
      sponsorBlock: s.sponsorBlock,
      normalizeAudio: s.normalizeAudio,
      speedLimit: s.speedLimit || undefined,
      proxy: s.proxy || undefined,
      concurrentFragments: s.concurrentFragments,
    })
  } catch (e: any) {
    return ctx.telegram.editMessageText(note.chat.id, note.message_id, undefined, `❌ ${esc(e.message)}`, { parse_mode: 'HTML' })
  }

  await ctx.telegram.editMessageText(
    note.chat.id, note.message_id, undefined,
    `📦 Queued <b>${out.count}</b> job(s). Tracking each below.`, { parse_mode: 'HTML' },
  )
  const chatId = ctx.chat?.id ?? userId
  for (const j of out.jobs) {
    void trackJob(ctx.telegram, chatId, j.jobId, { header: truncate(j.url, 70) })
  }
}

export function registerCollections(bot: Telegraf<BotContext>) {
  bot.command('batch', async (ctx) => {
    const urls = extractUrls(ctx.payload)
    if (urls.length) return runBatch(ctx, urls)
    setAwaiting(ctx.from!.id, { kind: 'batch' })
    await ctx.reply('📦 Send me the URLs to batch-download — one per line (or space-separated). Send /cancel to abort.')
  })

  bot.command(['playlist', 'profile'], async (ctx) => {
    const parts = ctx.payload.trim().split(/\s+/)
    const url = extractUrl(parts[0])
    if (!url) return ctx.reply('Usage: /playlist <url> [count]   (count omitted = all items)')
    const count = Number(parts.find((p) => /^\d+$/.test(p))) || 0
    const userId = ctx.from!.id

    const wait = await ctx.reply('🔎 Analyzing playlist…')
    let a: AnalyzeResult
    try {
      a = await api.analyzePlaylist(url)
    } catch (e: any) {
      return ctx.telegram.editMessageText(wait.chat.id, wait.message_id, undefined, `❌ ${esc(e.message)}`, { parse_mode: 'HTML' })
    }
    a.url = url
    const token = mediaTokens.put({ url, analysis: a, userId })

    if (count > 0) {
      await ctx.telegram.deleteMessage(wait.chat.id, wait.message_id).catch(() => {})
      await startDownload(ctx, { url, analysis: a, userId }, { kind: 'pl', value: String(count) })
      return
    }

    await ctx.telegram.editMessageText(
      wait.chat.id, wait.message_id, undefined,
      `📃 <b>${esc(truncate(a.title || url, 90))}</b>\n${a.item_count ? `${a.item_count} items` : 'item count unknown'} · ${esc(a.extractor || '')}\n\nHow many?`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback('All', `dl:${token}:pl:0`),
              Markup.button.callback('10', `dl:${token}:pl:10`),
              Markup.button.callback('25', `dl:${token}:pl:25`),
              Markup.button.callback('50', `dl:${token}:pl:50`),
            ],
            [Markup.button.callback('🎵 Audio × all', `dl:${token}:pla:0`)],
          ],
        },
      },
    )
  })

  bot.command('later', async (ctx) => {
    const parts = ctx.payload.trim().split(/\s+/)
    const mins = Number(parts[0])
    const url = extractUrl(parts.slice(1).join(' ')) || extractUrl(parts[1])
    if (!mins || !url) return ctx.reply('Usage: /later <minutes> <url>   e.g. /later 30 https://…')
    const userId = ctx.from!.id
    let a: AnalyzeResult
    try { a = await api.analyze(url) } catch (e: any) { return ctx.reply(`❌ ${e.message}`) }
    await startDownload(ctx, { url, analysis: a, userId }, { kind: 'q', value: getSettings(userId).quality }, { delaySeconds: Math.round(mins * 60) })
  })

  bot.command('schedule', async (ctx) => {
    const parts = ctx.payload.trim().split(/\s+/)
    const every = parts[0]?.toLowerCase()
    const url = extractUrl(parts.slice(1).join(' ')) || extractUrl(parts[1])
    if (!['hourly', 'daily', 'weekly'].includes(every) || !url) {
      return ctx.reply('Usage: /schedule <hourly|daily|weekly> <url>')
    }
    const userId = ctx.from!.id
    let a: AnalyzeResult
    try { a = await api.analyze(url) } catch (e: any) { return ctx.reply(`❌ ${e.message}`) }
    await startDownload(ctx, { url, analysis: a, userId }, { kind: 'q', value: getSettings(userId).quality }, { repeatEvery: every as 'hourly' | 'daily' | 'weekly' })
  })

  bot.command('feed', async (ctx) => {
    const url = extractUrl(ctx.payload)
    if (!url) return ctx.reply('Usage: /feed <rss-or-m3u-url>')
    const wait = await ctx.reply('📡 Fetching feed…')
    let feed
    try { feed = await api.feed(url) } catch (e: any) {
      return ctx.telegram.editMessageText(wait.chat.id, wait.message_id, undefined, `❌ ${esc(e.message)}`, { parse_mode: 'HTML' })
    }
    const items = (feed.items ?? []).slice(0, 20)
    if (!items.length) {
      return ctx.telegram.editMessageText(wait.chat.id, wait.message_id, undefined, 'No items in that feed.', {})
    }
    const userId = ctx.from!.id
    const rows = items.map((it, i) => {
      const link = it.enclosure?.url || it.url || it.link || ''
      const token = mediaTokens.put({ url: link, analysis: { type: 'video', url: link, title: it.title } as AnalyzeResult, userId })
      return [Markup.button.callback(`⬇️ ${i + 1}. ${truncate(it.title || link, 45)}`, `dl:${token}:q:best`)]
    })
    // "grab all" via batch
    const allUrls = items.map((it) => it.enclosure?.url || it.url || it.link || '').filter(Boolean)
    const allToken = mediaTokens.put({ url: allUrls.join('\n'), analysis: { type: 'video' } as AnalyzeResult, userId })
    rows.unshift([Markup.button.callback(`📦 Download all ${allUrls.length}`, `feedall:${allToken}`)])

    await ctx.telegram.editMessageText(
      wait.chat.id, wait.message_id, undefined,
      `📡 <b>${esc(truncate(feed.title || url, 90))}</b>\n${items.length} recent item(s):`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } },
    )
  })

  bot.action(/^feedall:([0-9a-f]{8})$/, async (ctx) => {
    const pending = mediaTokens.get(ctx.match[1])
    if (!pending) { await ctx.answerCbQuery('Expired', { show_alert: true }); return }
    await ctx.answerCbQuery('Queuing all…')
    await ctx.editMessageReplyMarkup(undefined).catch(() => {})
    await runBatch(ctx, pending.url.split('\n').filter(Boolean))
  })

  /** Called from index.ts when a plain message arrives and the user is in "batch" mode. */
  async function consumeAwaitingBatch(ctx: BotContext, text: string): Promise<boolean> {
    const a = takeAwaiting(ctx.from!.id)
    if (a?.kind !== 'batch') { if (a) setAwaiting(ctx.from!.id, a); return false }
    await runBatch(ctx, extractUrls(text))
    return true
  }

  return { consumeAwaitingBatch, runBatch }
}
