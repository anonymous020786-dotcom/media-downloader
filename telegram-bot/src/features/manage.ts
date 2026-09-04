import { Telegraf } from 'telegraf'
import type { BotContext } from '../types.js'
import { api } from '../api.js'
import { isAdmin } from '../config.js'
import { esc } from '../format.js'
import { getSettings, resetSettings, saveSettings, setAwaiting, takeAwaiting } from '../session.js'
import { settingsView } from '../ui.js'

const QUALITY_CYCLE = ['best', 'max', '2160', '1440', '1080', '720', '480', '360']
const VFORMAT_CYCLE = ['mp4', 'mkv', 'webm', 'mov', 'ts', 'gif']
const AFORMAT_CYCLE = ['mp3', 'm4a', 'opus', 'ogg', 'flac', 'wav']

const next = (arr: string[], cur: string) => arr[(arr.indexOf(cur) + 1) % arr.length] ?? arr[0]

async function showSettings(ctx: BotContext, edit = false) {
  const { text, keyboard } = settingsView(getSettings(ctx.from!.id))
  const extra = { parse_mode: 'HTML' as const, reply_markup: { inline_keyboard: keyboard } }
  if (edit) await ctx.editMessageText(text, extra).catch(() => {})
  else await ctx.reply(text, extra)
}

export function registerManage(bot: Telegraf<BotContext>) {
  bot.command(['settings', 'config'], (ctx) => showSettings(ctx))
  bot.action('settings:open', async (ctx) => { await ctx.answerCbQuery(); await showSettings(ctx) })

  bot.command('whoami', async (ctx) => {
    const u = ctx.from!
    await ctx.reply(
      `id: <code>${u.id}</code>\n` +
      `handle: @${esc(u.username ?? '—')}\n` +
      `access: ${isAdmin(u.id) ? 'admin' : 'user'}\n` +
      `chat: <code>${ctx.chat?.id}</code> (${ctx.chat?.type})`,
      { parse_mode: 'HTML' },
    )
  })

  bot.action(/^set:(.+)$/, async (ctx) => {
    const userId = ctx.from!.id
    const s = getSettings(userId)
    const arg = ctx.match[1]

    if (arg === 'close') { await ctx.answerCbQuery(); await ctx.deleteMessage().catch(() => {}); return }
    if (arg === 'reset') { resetSettings(userId); await ctx.answerCbQuery('Reset'); await showSettings(ctx, true); return }
    if (arg === 'quality') s.quality = next(QUALITY_CYCLE, s.quality)
    else if (arg === 'vformat') s.videoFormat = next(VFORMAT_CYCLE, s.videoFormat)
    else if (arg === 'aformat') s.audioFormat = next(AFORMAT_CYCLE, s.audioFormat)
    else if (arg === 'fragments') s.concurrentFragments = s.concurrentFragments >= 32 ? 1 : s.concurrentFragments * 2
    else if (arg === 'speedlimit') {
      setAwaiting(userId, { kind: 'speedlimit' })
      await ctx.answerCbQuery()
      await ctx.reply('Send a speed limit like <code>5M</code> or <code>800K</code> (or "off").', { parse_mode: 'HTML' })
      return
    }
    else if (arg.startsWith('proxy:')) s.proxy = arg.slice('proxy:'.length)
    else if (arg in s && typeof (s as any)[arg] === 'boolean') (s as any)[arg] = !(s as any)[arg]
    else { await ctx.answerCbQuery('?'); return }

    saveSettings(userId)
    await ctx.answerCbQuery('Saved')
    await showSettings(ctx, true)
  })

  // ── Proxy manager ─────────────────────────────────────────────────────────
  bot.command('proxy', async (ctx) => {
    const parts = ctx.payload.trim().split(/\s+/).filter(Boolean)
    const sub = parts[0]?.toLowerCase()
    try {
      if (!sub || sub === 'list') {
        const { presets, saved } = await api.proxyList()
        const lines = ['🌐 <b>Proxies</b>']
        if (presets.length) lines.push('\n<b>Presets</b>\n' + presets.map((p: any) => `• <code>${esc(p.id)}</code> ${esc(p.label)} — ${esc(p.url)}`).join('\n'))
        lines.push('\n<b>Saved</b>')
        lines.push(saved.length
          ? saved.map((p: any) => `• <code>${esc(p.id)}</code> ${esc(p.label)}${p.is_default ? ' ⭐' : ''}${p.last_ip ? ` (${esc(p.last_ip)} ${esc(p.country || '')})` : ''}`).join('\n')
          : '(none)')
        lines.push('\n<i>/proxy add &lt;label&gt; &lt;url&gt;  ·  /proxy test &lt;id|url&gt;  ·  /proxy default &lt;id&gt;  ·  /proxy rm &lt;id&gt;</i>')
        return ctx.reply(lines.join('\n'), { parse_mode: 'HTML', link_preview_options: { is_disabled: true } })
      }
      if (sub === 'add') {
        const url = parts[parts.length - 1]
        const label = parts.slice(1, -1).join(' ') || 'proxy'
        if (!/^(https?|socks4|socks5h?):\/\//i.test(url || '')) return ctx.reply('Give a url starting with http(s):// or socks5://')
        const r = await api.proxyAdd(label, url)
        return ctx.reply(`✅ Saved <code>${esc(r.id)}</code>`, { parse_mode: 'HTML' })
      }
      if (sub === 'test') {
        if (!parts[1]) return ctx.reply('Usage: /proxy test <id|url>')
        const note = await ctx.reply('🧪 Testing…')
        const r = await api.proxyTest(parts[1])
        return ctx.telegram.editMessageText(note.chat.id, note.message_id, undefined,
          r.ok ? `✅ OK — exit IP ${esc(r.ip || '?')} ${esc(r.country || '')}` : `❌ ${esc(r.error || 'failed')}`,
          { parse_mode: 'HTML' })
      }
      if (sub === 'default') {
        if (!parts[1]) return ctx.reply('Usage: /proxy default <id>')
        await api.proxyDefault(parts[1]); return ctx.reply('⭐ Default set.')
      }
      if (sub === 'rm' || sub === 'remove' || sub === 'delete') {
        if (!parts[1]) return ctx.reply('Usage: /proxy rm <id>')
        await api.proxyDelete(parts[1]); return ctx.reply('🗑 Removed.')
      }
      return ctx.reply('Subcommands: list · add · test · default · rm')
    } catch (e: any) { return ctx.reply(`❌ ${e.message}`) }
  })

  // ── Cookie manager ────────────────────────────────────────────────────────
  bot.command('cookies', async (ctx) => {
    const parts = ctx.payload.trim().split(/\s+/).filter(Boolean)
    const sub = parts[0]?.toLowerCase()
    try {
      if (!sub || sub === 'list') {
        const list = await api.cookieList()
        const body = list.length
          ? list.map((c) => `• <code>${esc(c.id)}</code> ${esc(c.domain)} — ${c.count} cookie(s) ${c.enabled ? '✅' : '⏸'}`).join('\n')
          : '(none)'
        return ctx.reply(`🍪 <b>Saved cookies</b>\n${body}\n\n<i>/cookies add &lt;domain&gt;  then paste the cookies.txt in your next message  ·  /cookies rm &lt;id&gt;</i>`,
          { parse_mode: 'HTML' })
      }
      if (sub === 'add') {
        const domain = parts[1]
        if (!domain) return ctx.reply('Usage: /cookies add <domain>')
        setAwaiting(ctx.from!.id, { kind: 'cookies', domain })
        return ctx.reply(`🍪 Now paste the Netscape cookies.txt (or a raw Cookie header) for <b>${esc(domain)}</b> in your next message.`, { parse_mode: 'HTML' })
      }
      if (sub === 'rm' || sub === 'remove' || sub === 'delete') {
        if (!parts[1]) return ctx.reply('Usage: /cookies rm <id>')
        await api.cookieDelete(parts[1]); return ctx.reply('🗑 Removed.')
      }
      if (sub === 'on' || sub === 'off') {
        if (!parts[1]) return ctx.reply(`Usage: /cookies ${sub} <id>`)
        await api.cookieToggle(parts[1], sub === 'on'); return ctx.reply(`${sub === 'on' ? '✅' : '⏸'} Done.`)
      }
      return ctx.reply('Subcommands: list · add · rm · on · off')
    } catch (e: any) { return ctx.reply(`❌ ${e.message}`) }
  })

  // ── System ───────────────────────────────────────────────────────────────
  bot.command('status', async (ctx) => {
    try {
      const [h, st] = await Promise.all([api.health().catch(() => null), api.status().catch(() => null)])
      const lines = ['📊 <b>Status</b>']
      if (h) lines.push(`backend: ${esc(h.status)} · v${esc(h.version || '?')} · up ${Math.floor((h.uptime || 0) / 60)}m`)
      if (st) {
        lines.push(`overall: <b>${esc(st.status)}</b>`)
        for (const [k, v] of Object.entries(st.checks ?? {})) lines.push(`  ${k}: ${esc(v)}`)
        if (st.engines) lines.push('\nengines:\n' + Object.entries(st.engines).map(([k, v]) => `  ${k}: ${esc(v ?? '—')}`).join('\n'))
      }
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
    } catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
  })

  bot.command('sites', async (ctx) => {
    try {
      const s = await api.sites()
      await ctx.reply(
        `🗂 <b>${s.named_extractors.toLocaleString()}</b> named site extractors\n` +
        Object.entries(s.by_engine).map(([k, v]) => `  ${k}: ${v.toLocaleString()}`).join('\n') +
        '\n\n<i>Plus a headless-render + direct-probe fallback for anything else.</i>',
        { parse_mode: 'HTML' },
      )
    } catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
  })


  /** Consume a plain message when the user is mid-flow for a manage action. */
  async function consumeAwaiting(ctx: BotContext, text: string): Promise<boolean> {
    const userId = ctx.from!.id
    const a = takeAwaiting(userId)
    if (!a) return false

    if (a.kind === 'cookies') {
      try { await api.cookieAdd(a.domain, text.trim()); await ctx.reply(`✅ Saved cookies for ${esc(a.domain)}.`, { parse_mode: 'HTML' }) }
      catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
      return true
    }
    if (a.kind === 'proxy_add') {
      const m = text.trim().split(/\s+/)
      const url = m.pop()!
      try { const r = await api.proxyAdd(m.join(' ') || 'proxy', url); await ctx.reply(`✅ Saved ${r.id}`) }
      catch (e: any) { await ctx.reply(`❌ ${e.message}`) }
      return true
    }
    if (a.kind === 'speedlimit') {
      const v = text.trim()
      getSettings(userId).speedLimit = /^(off|none|0|unlimited)$/i.test(v) ? '' : v
      saveSettings(userId)
      await ctx.reply(`🐌 Speed limit: ${getSettings(userId).speedLimit || 'unlimited'}`)
      return true
    }
    // not ours — put it back
    setAwaiting(userId, a)
    return false
  }

  return { consumeAwaiting }
}
