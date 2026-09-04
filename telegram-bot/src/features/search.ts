import { Telegraf, Markup } from 'telegraf'
import type { InlineKeyboardButton } from 'telegraf/types'
import type { BotContext } from '../types.js'
import { api, type SearchResult } from '../api.js'
import { searchTokens, setAwaiting, takeAwaiting, type PendingSearch } from '../session.js'
import { esc, truncate } from '../format.js'
import { analyzeAndReply } from './media.js'

const PAGE_SIZE = 8

function render(p: PendingSearch): { text: string; keyboard: InlineKeyboardButton[][] } {
  const kindEmoji: Record<string, string> = { web: '🌐', video: '🎬', image: '🖼', file: '📄', torrent: '🧲', news: '📰' }
  const lines = [`${kindEmoji[p.kind] ?? '🔎'} <b>${esc(p.query)}</b> — ${p.kind}${p.filetype ? ` .${p.filetype}` : ''}  ·  page ${p.page}`]

  const kb: InlineKeyboardButton[][] = []
  p.results.forEach((r, i) => {
    const extra = r.duration ? ` (${r.duration})` : r.size ? ` (${r.size})` : r.seeders != null ? ` (S:${r.seeders})` : ''
    lines.push(`\n<b>${i + 1}.</b> ${esc(truncate(r.title || r.url, 90))}${esc(extra)}\n<i>${esc(truncate(r.source || r.url, 90))}</i>`)
    kb.push([Markup.button.callback(`⬇️ ${i + 1}`, `s:${p.token}:d:${i}`)])
  })
  if (!p.results.length) lines.push('\nNo results.')

  // collapse the download buttons into rows of 4
  const dlRow: InlineKeyboardButton[] = kb.flat()
  const compact: InlineKeyboardButton[][] = []
  for (let i = 0; i < dlRow.length; i += 4) compact.push(dlRow.slice(i, i + 4))

  const nav: InlineKeyboardButton[] = []
  if (p.page > 1) nav.push(Markup.button.callback('◀️ Prev', `s:${p.token}:p:${p.page - 1}`))
  nav.push(Markup.button.callback('🔄', `s:${p.token}:p:${p.page}`))
  if (p.results.length >= PAGE_SIZE) nav.push(Markup.button.callback('Next ▶️', `s:${p.token}:p:${p.page + 1}`))
  compact.push(nav)

  return { text: lines.join('\n'), keyboard: compact }
}

/** Plain message arrived while the user picked a search type from the menu. */
export async function consumeAwaitingSearch(ctx: BotContext, text: string): Promise<boolean> {
  const a = takeAwaiting(ctx.from!.id)
  if (a?.kind !== 'search') { if (a) setAwaiting(ctx.from!.id, a); return false }
  await doSearch(ctx, text, a.searchKind)
  return true
}

async function doSearch(ctx: BotContext, query: string, kind: string, filetype?: string) {
  if (!query.trim()) return ctx.reply('Give me something to search for.')
  const wait = await ctx.reply('🔎 Searching…')
  let res
  try {
    res = await api.search(query, kind, 1, { filetype, limit: PAGE_SIZE, safe: false })
  } catch (e: any) {
    return ctx.telegram.editMessageText(wait.chat.id, wait.message_id, undefined, `❌ ${esc(e.message)}`, { parse_mode: 'HTML' })
  }
  const pending: PendingSearch = { query, kind, page: 1, filetype, safe: false, results: res.results.slice(0, PAGE_SIZE), token: '' }
  pending.token = searchTokens.put(pending)
  const { text, keyboard } = render(pending)
  await ctx.telegram.editMessageText(wait.chat.id, wait.message_id, undefined, text, {
    parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: keyboard },
  })
}

export function registerSearch(bot: Telegraf<BotContext>) {
  bot.command('search', (ctx) => doSearch(ctx, ctx.payload, 'web'))
  bot.command(['searchvideo', 'svideo'], (ctx) => doSearch(ctx, ctx.payload, 'video'))
  bot.command(['searchimage', 'simage'], (ctx) => doSearch(ctx, ctx.payload, 'image'))
  bot.command('news', (ctx) => doSearch(ctx, ctx.payload, 'news'))
  bot.command(['torrents', 'torrent'], (ctx) => doSearch(ctx, ctx.payload, 'torrent'))
  bot.command(['searchfile', 'sfile'], (ctx) => {
    const parts = ctx.payload.trim().split(/\s+/)
    const ft = parts[0] && /^[a-z0-9]{1,8}$/i.test(parts[0]) ? parts[0].toLowerCase() : undefined
    const q = ft ? parts.slice(1).join(' ') : ctx.payload
    return doSearch(ctx, q, 'file', ft)
  })

  bot.action(/^s:([0-9a-f]{8}):p:(\d+)$/, async (ctx) => {
    const p = searchTokens.get(ctx.match[1]) as PendingSearch | undefined
    if (!p) { await ctx.answerCbQuery('Search expired — run it again.', { show_alert: true }); return }
    const page = Number(ctx.match[2])
    await ctx.answerCbQuery('Loading…')
    try {
      const res = await api.search(p.query, p.kind, page, { filetype: p.filetype, limit: PAGE_SIZE, safe: p.safe })
      p.page = page
      p.results = res.results.slice(0, PAGE_SIZE)
    } catch (e: any) { await ctx.answerCbQuery(e.message, { show_alert: true }); return }
    const { text, keyboard } = render(p)
    await ctx.editMessageText(text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: keyboard } }).catch(() => {})
  })

  bot.action(/^s:([0-9a-f]{8}):d:(\d+)$/, async (ctx) => {
    const p = searchTokens.get(ctx.match[1]) as PendingSearch | undefined
    if (!p) { await ctx.answerCbQuery('Search expired.', { show_alert: true }); return }
    const r: SearchResult | undefined = p.results[Number(ctx.match[2])]
    if (!r) { await ctx.answerCbQuery('Gone.', { show_alert: true }); return }
    const target = r.magnet || r.url
    await ctx.answerCbQuery('Opening…')
    await analyzeAndReply(ctx, target)
  })
}
