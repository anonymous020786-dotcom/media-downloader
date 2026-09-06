import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Telegraf } from 'telegraf'
import type { BotContext } from './types.js'
import { config, isAllowed } from './config.js'
import { api } from './api.js'
import { clearAwaiting } from './session.js'
import { esc, extractUrls } from './format.js'
import { store } from './store.js'
import { registerHelp, COMMAND_LIST } from './features/help.js'
import { registerMenu } from './features/menu.js'
import { registerMedia, analyzeAndReply, consumeAwaitingClip } from './features/media.js'
import { registerCollections } from './features/collections.js'
import { registerSearch, consumeAwaitingSearch } from './features/search.js'
import { registerQueue } from './features/queue.js'
import { registerManage } from './features/manage.js'

const bot = new Telegraf<BotContext>(config.botToken, {
  telegram: config.apiRoot ? { apiRoot: config.apiRoot } : undefined,
  handlerTimeout: 9_000_000, // downloads are tracked in long-running handlers
})

// ── Access control ──────────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  const uid = ctx.from?.id
  if (!isAllowed(uid)) {
    if (ctx.chat?.type === 'private') {
      await ctx.reply(
        `⛔ Not authorized.\nYour Telegram id is <code>${uid}</code> — add it to TELEGRAM_ALLOWED_USERS in the repo-root .env and restart the bot.`,
        { parse_mode: 'HTML' },
      ).catch(() => {})
    }
    console.warn(`[bot] denied user ${uid} (@${ctx.from?.username ?? '?'})`)
    return
  }
  return next()
})

// /cancel clears any pending conversational prompt (the queue-stop lives in queue.ts)
bot.use(async (ctx, next) => {
  const t = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined
  if (t && /^\/cancel(@\w+)?\b/.test(t)) clearAwaiting(ctx.from!.id)
  return next()
})

// ── Features ────────────────────────────────────────────────────────────────
registerHelp(bot)
registerMenu(bot)
registerMedia(bot)
const { consumeAwaitingBatch, runBatch } = registerCollections(bot)
registerSearch(bot)
registerQueue(bot)
const { consumeAwaiting } = registerManage(bot)

const lastMultiUrls = new Map<number, string[]>()

// ── Documents: cookies.txt during a /cookies add flow, or a .torrent file ────
bot.on('document', async (ctx) => {
  const doc = ctx.message.document
  const name = (doc.file_name ?? '').toLowerCase()
  try {
    const link = await ctx.telegram.getFileLink(doc.file_id)
    if (name.endsWith('.torrent')) {
      await analyzeAndReply(ctx, link.href)
      return
    }
    if ((doc.file_size ?? 0) > 2_000_000) {
      await ctx.reply('That file is large — send a link to it instead, or a .torrent.')
      return
    }
    // Otherwise treat it as text for a pending flow (cookies.txt).
    const res = await fetch(link.href)
    const text = await res.text()
    if (await consumeAwaiting(ctx, text)) return
    await ctx.reply("Got a file but I'm not expecting one. Use /cookies add <domain> first, or send a .torrent.")
  } catch (e: any) {
    await ctx.reply(`❌ ${esc(e.message)}`, { parse_mode: 'HTML' })
  }
})

// ── Catch-all text: pending flows, then treat as URL(s) ─────────────────────
bot.on('text', async (ctx) => {
  const text = ctx.message.text
  if (text.startsWith('/')) return // unknown command

  if (await consumeAwaitingBatch(ctx, text)) return
  if (await consumeAwaitingClip(ctx, text)) return
  if (await consumeAwaitingSearch(ctx, text)) return
  if (await consumeAwaiting(ctx, text)) return

  // In groups, only react to links when the bot is addressed (mention or reply).
  if (ctx.chat.type !== 'private') {
    const mentioned = text.includes(`@${bot.botInfo?.username}`)
    const repliedToBot = ctx.message.reply_to_message?.from?.id === bot.botInfo?.id
    if (!mentioned && !repliedToBot) return
  }

  const urls = extractUrls(text)
  if (urls.length === 1) return analyzeAndReply(ctx, urls[0])
  if (urls.length > 1) {
    lastMultiUrls.set(ctx.from!.id, urls)
    await ctx.reply(`Found ${urls.length} links — analyze the first, or batch them all?`, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🔎 First only', callback_data: 'multi:first' },
          { text: `📦 Batch all ${urls.length}`, callback_data: 'multi:batch' },
        ]],
      },
    })
    return
  }
  return ctx.reply('Send me a link, or /help for everything I can do.')
})

bot.action('multi:batch', async (ctx) => {
  const urls = lastMultiUrls.get(ctx.from!.id)
  if (!urls?.length) { await ctx.answerCbQuery('Expired', { show_alert: true }); return }
  await ctx.answerCbQuery('Queuing…')
  await ctx.editMessageReplyMarkup(undefined).catch(() => {})
  await runBatch(ctx, urls)
})
bot.action('multi:first', async (ctx) => {
  const urls = lastMultiUrls.get(ctx.from!.id)
  if (!urls?.length) { await ctx.answerCbQuery('Expired', { show_alert: true }); return }
  await ctx.answerCbQuery()
  await ctx.editMessageReplyMarkup(undefined).catch(() => {})
  await analyzeAndReply(ctx, urls[0])
})

bot.catch((err, ctx) => {
  console.error(`[bot] error for ${ctx.updateType}:`, err instanceof Error ? err.message : err)
})

// ── Boot ────────────────────────────────────────────────────────────────────
// ── Single-instance lock ────────────────────────────────────────────────────
// Two bots polling one token → Telegram 409 Conflict → updates handled
// erratically ("download never arrives"). Refuse to start if another is alive.
const LOCK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'bot.lock')
function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch (e: any) { return e.code === 'EPERM' }
}
async function acquireLock() {
  let prev = 0
  try { prev = Number(fs.readFileSync(LOCK, 'utf8').trim()) } catch { /* none */ }
  if (prev && prev !== process.pid && pidAlive(prev)) {
    // Could be a `tsx watch` reload where the old child is still exiting —
    // give it a moment before giving up.
    for (let i = 0; i < 15 && pidAlive(prev); i++) await new Promise((r) => setTimeout(r, 200))
    if (pidAlive(prev)) {
      console.error(`[bot] another instance is already running (pid ${prev}). ` +
        `Stop it first, or delete ${LOCK} if it's stale. Exiting.`)
      process.exit(1)
    }
  }
  fs.mkdirSync(path.dirname(LOCK), { recursive: true })
  fs.writeFileSync(LOCK, String(process.pid))
}
function releaseLock() {
  try { if (Number(fs.readFileSync(LOCK, 'utf8').trim()) === process.pid) fs.unlinkSync(LOCK) } catch { /* */ }
}

async function main() {
  await acquireLock()
  try {
    const h = await api.health()
    console.log(`[bot] backend OK — v${h.version ?? '?'}`)
  } catch (e: any) {
    console.warn(`[bot] ⚠️  backend not reachable at ${config.backendUrl} (${e.message}). Start it with "npm run dev".`)
  }

  await bot.telegram.setMyCommands(COMMAND_LIST).catch(() => {})

  const me = await bot.telegram.getMe()
  bot.botInfo = me
  // launch() resolves only when the bot stops — start it without awaiting.
  void bot.launch({ dropPendingUpdates: true })
  console.log(`[bot] @${me.username} is live. Allowed users: ${config.allowAll ? 'ALL' : config.allowedUsers.join(', ') || '(NONE — message the bot to get your id)'}`)
}

process.once('SIGINT', () => { releaseLock(); store.flush(); bot.stop('SIGINT') })
process.once('SIGTERM', () => { releaseLock(); store.flush(); bot.stop('SIGTERM') })
process.once('exit', releaseLock)

main().catch((e) => { console.error('[bot] fatal:', e); releaseLock(); process.exit(1) })
