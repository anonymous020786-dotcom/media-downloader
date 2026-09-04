import { Telegraf, Markup } from 'telegraf'
import type { BotContext } from '../types.js'
import { api } from '../api.js'
import { esc } from '../format.js'
import { deliverFiles, trackJob } from '../jobs.js'
import { genericTokens } from '../session.js'
import { queueView } from '../ui.js'

export function registerQueue(bot: Telegraf<BotContext>) {
  const showQueue = async (ctx: BotContext, edit: boolean) => {
    let jobs
    try { jobs = await api.jobs() } catch (e: any) {
      const m = `❌ Backend not reachable: ${esc(e.message)}`
      return edit ? ctx.editMessageText(m, { parse_mode: 'HTML' }).catch(() => {}) : ctx.reply(m, { parse_mode: 'HTML' })
    }
    const { text, keyboard } = queueView(jobs)
    const extra = { parse_mode: 'HTML' as const, link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: keyboard } }
    if (edit) await ctx.editMessageText(text, extra).catch(() => {})
    else await ctx.reply(text, extra)
  }

  bot.command(['jobs', 'queue'], (ctx) => showQueue(ctx, false))
  bot.action('menu:queue', async (ctx) => { await ctx.answerCbQuery(); await showQueue(ctx, true) })
  bot.action('jobs:refresh', async (ctx) => { await ctx.answerCbQuery('Refreshing…'); await showQueue(ctx, true) })

  bot.action('jobs:stopall', async (ctx) => {
    await ctx.answerCbQuery()
    try { const r = await api.stopAll(); await ctx.reply(`🛑 Stopped ${r.stopped} running job(s).`) }
    catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
  })

  bot.action('jobs:clear', async (ctx) => {
    await ctx.answerCbQuery()
    try {
      const jobs = await api.jobs()
      let n = 0
      for (const j of jobs) {
        if (['completed', 'failed'].includes(j.progress.status)) { await api.deleteJob(j.jobId).catch(() => {}); n++ }
      }
      await ctx.reply(`🧹 Cleared ${n} finished job(s).`)
    } catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
  })

  bot.action(/^job:kill:([0-9a-f-]{6,})$/, async (ctx) => {
    await ctx.answerCbQuery('Stopping…')
    try { await api.deleteJob(ctx.match[1]) } catch { /* may have finished */ }
    await showQueue(ctx, true)
  })

  bot.command(['cancel', 'stop'], async (ctx) => {
    const id = ctx.payload.trim()
    try {
      if (id) { await api.deleteJob(id); return ctx.reply(`🛑 Stopped ${id.slice(0, 8)}.`) }
      const r = await api.stopAll()
      await ctx.reply(`🛑 Stopped ${r.stopped} running download(s).`)
    } catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
  })

  bot.command('retry', async (ctx) => {
    const id = ctx.payload.trim()
    if (!id) return ctx.reply('Usage: /retry <jobId>')
    try {
      await api.retryJob(id)
      await ctx.reply('🔁 Re-queued.')
      void trackJob(ctx.telegram, ctx.chat!.id, id, { header: `retry ${id.slice(0, 8)}` })
    } catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
  })

  bot.command('files', async (ctx) => {
    const id = ctx.payload.trim()
    if (!id) return ctx.reply("Usage: /files <jobId>   — re-send a finished job's files.")
    await deliverFiles(ctx.telegram, ctx.chat!.id, id, `job ${id.slice(0, 8)}`)
  })

  bot.action(/^job:retry:([0-9a-f-]{6,})$/, async (ctx) => {
    await ctx.answerCbQuery('Retrying…')
    const id = ctx.match[1]
    try {
      await api.retryJob(id)
      await ctx.editMessageReplyMarkup(undefined).catch(() => {})
      void trackJob(ctx.telegram, ctx.chat!.id, id, { header: `retry ${id.slice(0, 8)}` })
    } catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
  })

  bot.action(/^job:del:([0-9a-f-]{6,})$/, async (ctx) => {
    await ctx.answerCbQuery('Deleted')
    await api.deleteJob(ctx.match[1]).catch(() => {})
    await ctx.editMessageReplyMarkup(undefined).catch(() => {})
  })

  // ── Recurring schedules ──────────────────────────────────────────────────
  bot.command('schedules', async (ctx) => {
    try {
      const list = await api.schedules()
      if (!list.length) return ctx.reply('No recurring schedules. Add one with /schedule <hourly|daily|weekly> <url>.')
      await ctx.reply(
        list.map((s) => `• <code>${esc(s.pattern)}</code>\n  ${esc(s.key)}`).join('\n\n'),
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: list.map((s) => [Markup.button.callback(`🗑 ${s.pattern}`, `sched:del:${genericTokens.put(s.key)}`)]) } },
      )
    } catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
  })

  bot.action(/^sched:del:([0-9a-f]{8})$/, async (ctx) => {
    const key = genericTokens.get(ctx.match[1])
    if (!key) { await ctx.answerCbQuery('Expired', { show_alert: true }); return }
    await ctx.answerCbQuery('Removing…')
    try { await api.deleteSchedule(key); await ctx.editMessageReplyMarkup(undefined).catch(() => {}) }
    catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
  })

  // ── Merge separate audio + video ─────────────────────────────────────────
  bot.command('merge', async (ctx) => {
    const [jobId, video, audio, fmt] = ctx.payload.trim().split(/\s+/)
    if (!jobId || !video || !audio) return ctx.reply('Usage: /merge <jobId> <videoFile> <audioFile> [outputFormat=mp4]')
    const note = await ctx.reply('🔗 Merging…')
    try {
      await api.merge({ job_id: jobId, video_file: video, audio_file: audio, output_format: fmt || 'mp4' })
      await ctx.telegram.editMessageText(note.chat.id, note.message_id, undefined, '✅ Merged — sending.', {})
      await deliverFiles(ctx.telegram, ctx.chat!.id, jobId, 'merged')
    } catch (e: any) {
      await ctx.telegram.editMessageText(note.chat.id, note.message_id, undefined, `❌ ${esc(e.message)}`, { parse_mode: 'HTML' })
    }
  })

  // ── Engines ──────────────────────────────────────────────────────────────
  bot.command('engines', async (ctx) => {
    try {
      const st = await api.status()
      const e = st.engines ?? {}
      const body = Object.entries(e).map(([k, v]) => `  ${k}: <code>${esc(v ?? '—')}</code>`).join('\n')
      await ctx.reply(`🔧 <b>Download engines</b>\n${body || '(unknown)'}`, { parse_mode: 'HTML' })
    } catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
  })
}
