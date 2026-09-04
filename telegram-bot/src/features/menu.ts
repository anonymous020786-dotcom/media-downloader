import { Telegraf } from 'telegraf'
import type { BotContext } from '../types.js'
import { api } from '../api.js'
import { config } from '../config.js'
import { esc } from '../format.js'
import { getSettings, setAwaiting } from '../session.js'
import { homeView, downloadView, searchMenuView, settingsView, backRow } from '../ui.js'
import { HELP } from './help.js'

export function registerMenu(bot: Telegraf<BotContext>) {
  const show = async (ctx: BotContext, v: { text: string; keyboard: any[][] }, edit: boolean) => {
    const extra = { parse_mode: 'HTML' as const, link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: v.keyboard } }
    if (edit) await ctx.editMessageText(v.text, extra).catch(() => ctx.reply(v.text, extra))
    else await ctx.reply(v.text, extra)
  }

  bot.command(['menu', 'panel', 'start'], (ctx) => show(ctx, homeView(), false))
  bot.action('menu:home', async (ctx) => { await ctx.answerCbQuery(); await show(ctx, homeView(), true) })
  bot.action('menu:close', async (ctx) => { await ctx.answerCbQuery(); await ctx.deleteMessage().catch(() => {}) })

  bot.action('menu:download', async (ctx) => { await ctx.answerCbQuery(); await show(ctx, downloadView(getSettings(ctx.from!.id)), true) })
  bot.action('menu:batch', async (ctx) => {
    await ctx.answerCbQuery()
    setAwaiting(ctx.from!.id, { kind: 'batch' })
    await ctx.reply('📥 Send the URLs — one per line. /cancel to abort.')
  })

  bot.action('menu:search', async (ctx) => { await ctx.answerCbQuery(); await show(ctx, searchMenuView(), true) })
  bot.action(/^menu:s:(web|video|image|file|torrent|news)$/, async (ctx) => {
    const kind = ctx.match[1]
    setAwaiting(ctx.from!.id, { kind: 'search', searchKind: kind })
    await ctx.answerCbQuery()
    await ctx.reply(`🔎 ${kind} search — send your query:`)
  })

  bot.action('menu:settings', async (ctx) => { await ctx.answerCbQuery(); await show(ctx, settingsView(getSettings(ctx.from!.id)), true) })

  bot.action('menu:proxy', async (ctx) => {
    await ctx.answerCbQuery()
    try {
      const { presets, saved } = await api.proxyList()
      const body = [
        `<b>🌐 Proxy / VPN pool</b>`,
        presets.length ? `Presets: ${presets.length}` : '',
        `Saved: ${saved.length}${saved.find((p: any) => p.is_default) ? ' (one default ⭐)' : ''}`,
        '',
        '<i>Manage with /proxy — add · test · default · rm</i>',
      ].filter(Boolean).join('\n')
      await show(ctx, { text: body, keyboard: [backRow()] }, true)
    } catch (e: any) { await show(ctx, { text: `❌ ${esc(e.message)}`, keyboard: [backRow()] }, true) }
  })

  bot.action('menu:cookies', async (ctx) => {
    await ctx.answerCbQuery()
    try {
      const list = await api.cookieList()
      const body = [
        `<b>🍪 Saved cookies</b>`,
        list.length ? list.map((c) => `• ${esc(c.domain)} — ${c.count} ${c.enabled ? '✅' : '⏸'}`).join('\n') : '(none)',
        '',
        '<i>/cookies add &lt;domain&gt; then paste cookies.txt · /cookies rm &lt;id&gt;</i>',
      ].join('\n')
      await show(ctx, { text: body, keyboard: [backRow()] }, true)
    } catch (e: any) { await show(ctx, { text: `❌ ${esc(e.message)}`, keyboard: [backRow()] }, true) }
  })

  bot.action('menu:status', async (ctx) => {
    await ctx.answerCbQuery()
    try {
      const [h, st, sites] = await Promise.all([
        api.health().catch(() => null), api.status().catch(() => null), api.sites().catch(() => null),
      ])
      const lines = ['<b>📊 Status</b>']
      if (h) lines.push(`backend: ${esc(h.status)} · v${esc(h.version || '?')}`)
      if (st?.checks) for (const [k, v] of Object.entries(st.checks)) lines.push(`  ${k}: ${esc(v)}`)
      if (sites) lines.push(`sites: ${sites.named_extractors.toLocaleString()} extractors`)
      lines.push(`\nupload cap: ${config.maxUploadMb} MB`)
      await show(ctx, { text: lines.join('\n'), keyboard: [backRow()] }, true)
    } catch (e: any) { await show(ctx, { text: `❌ ${esc(e.message)}`, keyboard: [backRow()] }, true) }
  })

  bot.action('menu:help', async (ctx) => {
    await ctx.answerCbQuery()
    await show(ctx, { text: HELP, keyboard: [backRow()] }, true)
  })

  // menu:queue is registered in queue.ts (it reuses that module's renderer)
}
