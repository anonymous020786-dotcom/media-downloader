import { Telegram } from 'telegraf'
import type { InlineKeyboardMarkup, InputFile, InputMediaPhoto } from 'telegraf/types'
import { api, type JobProgress } from './api.js'
import { config, fileLink } from './config.js'
import { bytes, esc, renderProgress, truncate } from './format.js'

const POLL_MS = 1_500
const EDIT_MS = 2_500 // Telegram allows ~1 edit/sec/chat; stay well under

interface TrackOpts {
  header: string
  /** Telegram user id (accepted for call-site compatibility; unused). */
  userId?: number
  /** Source URL (accepted for call-site compatibility; unused). */
  url?: string
  /** Media kind (accepted for call-site compatibility; unused). */
  kind?: string
  /** mediaToken id so the post-download "Redo" button can reopen the card. */
  redoToken?: string
  /** Called once the job reaches a terminal state. */
  onDone?: (files: string[]) => void
}

/**
 * Poll a job to completion, keeping one Telegram message updated with a live
 * progress bar, then deliver every produced file to the chat.
 */
export async function trackJob(tg: Telegram, chatId: number, jobId: string, opts: TrackOpts): Promise<void> {
  const msg = await tg.sendMessage(chatId, renderProgress({ status: 'queued', progress: 0 }, opts.header), {
    parse_mode: 'HTML',
  })
  const msgId = msg.message_id

  let lastText = ''
  let lastEdit = 0
  const edit = async (text: string, markup?: InlineKeyboardMarkup, force = false) => {
    if (!force && (text === lastText || Date.now() - lastEdit < EDIT_MS)) return
    lastText = text
    lastEdit = Date.now()
    await tg.editMessageText(chatId, msgId, undefined, text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(markup ? { reply_markup: markup } : {}),
    }).catch(() => {})
  }

  const deadline = Date.now() + 6 * 60 * 60 * 1000
  const start = Date.now()
  let progress: JobProgress = { status: 'queued', progress: 0 }
  let unknownStreak = 0

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS))
    try { progress = await api.jobState(jobId) } catch { continue }
    if (progress.status === 'completed' || progress.status === 'failed') break
    if (progress.status === 'unknown') {
      if (++unknownStreak * POLL_MS > 90_000 && Date.now() - start > 90_000) {
        progress = { status: 'failed', progress: 0, error: 'Job is no longer tracked by the backend.' }
        break
      }
      continue
    }
    unknownStreak = 0
    await edit(renderProgress(progress, opts.header))
  }

  if (progress.status === 'failed') {
    await edit(renderProgress(progress, opts.header), failedKb(jobId, opts.redoToken), true)
    opts.onDone?.([])
    return
  }

  let files: string[] = []
  try { files = (await api.files(jobId)).map((e) => e.name) } catch { /* use progress payload */ }
  if (!files.length && progress.files?.length) files = progress.files

  await edit(
    renderProgress({ ...progress, status: 'completed', progress: 100 }, opts.header) +
      `\n\n<b>${files.length}</b> file(s) — sending…`,
    undefined, true,
  )

  await deliverFiles(tg, chatId, jobId, opts.header, opts.redoToken)
  opts.onDone?.(files)
}

function failedKb(jobId: string, redoToken?: string): InlineKeyboardMarkup {
  const row = [{ text: '🔁 Retry', callback_data: `job:retry:${jobId}` }, { text: '🗑 Delete', callback_data: `job:del:${jobId}` }]
  if (redoToken) row.unshift({ text: '⚙️ Options', callback_data: `redo:${redoToken}` })
  return { inline_keyboard: [row] }
}

function withTimeout<T>(p: Promise<T>, sec: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${sec}s`)), sec * 1000)),
  ])
}

async function sendLinks(
  tg: Telegram, chatId: number, jobId: string,
  files: { name: string; size: number }[], reason: string,
): Promise<void> {
  if (!files.length) return
  const lan = !config.publicBaseUrl || /^https?:\/\/(localhost|127\.)/.test(config.publicBaseUrl)
  const lines = files.map((f) => `• <code>${esc(f.name)}</code> · ${bytes(f.size)}\n${esc(fileLink(jobId, f.name))}`)
  await tg.sendMessage(
    chatId,
    `📎 <b>${reason}</b> — tap to download:\n\n${lines.join('\n\n')}` +
      (lan ? '\n\n<i>Open on a device on the same Wi-Fi as the server.</i>' : ''),
    { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
  ).catch(() => {})
}

/**
 * Push every file for a finished job into the chat. Upload to Telegram when we
 * can; otherwise (or when the upload stalls — common if an ISP throttles
 * Telegram) hand over a direct link instead. Controlled by TELEGRAM_DELIVERY.
 */
export async function deliverFiles(
  tg: Telegram, chatId: number, jobId: string, header: string, redoToken?: string,
): Promise<void> {
  let entries
  try {
    entries = await api.files(jobId)
  } catch (e: any) {
    await tg.sendMessage(chatId, `⚠️ Couldn't list files: ${esc(e.message)}`, { parse_mode: 'HTML' })
    return
  }
  if (!entries.length) {
    await tg.sendMessage(chatId, '⚠️ The job finished but produced no files.')
    return
  }

  const cap = config.maxUploadMb * 1024 * 1024
  const linkFallback: { name: string; size: number }[] = []

  // Link-only mode, or files over the upload cap → straight to links.
  const over = entries.filter((e) => e.size > cap)
  const under = entries.filter((e) => e.size <= cap)
  console.log(`[deliver] job ${jobId.slice(0, 8)}: mode=${config.delivery}, ${under.length} uploadable, ${over.length} over cap`)

  if (config.delivery === 'link') {
    await sendLinks(tg, chatId, jobId, entries, `${entries.length} file(s) ready`)
  } else {
    linkFallback.push(...over)

    const isImg = (n: string, m: string) => (m.startsWith('image/') && !m.includes('gif')) || /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(n)
    const photos = under.filter((f) => isImg(f.name, f.mime) && f.size <= 10 * 1024 * 1024)
    const rest = under.filter((f) => !photos.includes(f))
    const timeout = config.uploadTimeoutSec

    for (let i = 0; i < photos.length; i += 10) {
      const group = photos.slice(i, i + 10)
      try {
        const media: InputMediaPhoto[] = await Promise.all(group.map(async (f, k) => {
          const { buffer } = await api.fileBuffer(jobId, f.name)
          return {
            type: 'photo',
            media: { source: buffer, filename: f.name } as InputFile,
            ...(i === 0 && k === 0 ? { caption: `🖼 ${esc(truncate(header, 80))} — ${photos.length} image(s)`, parse_mode: 'HTML' as const } : {}),
          }
        }))
        await withTimeout(tg.sendMediaGroup(chatId, media), timeout * 2, 'album')
      } catch (e: any) {
        console.error(`[deliver] album failed: ${e?.message}`)
        if (config.delivery === 'upload') for (const f of group) await sendOne(tg, chatId, jobId, f, header, timeout, linkFallback)
        else linkFallback.push(...group)
      }
    }

    for (const f of rest) await sendOne(tg, chatId, jobId, f, header, timeout, linkFallback)

    await sendLinks(tg, chatId, jobId, linkFallback,
      linkFallback.some((f) => f.size > cap)
        ? `${linkFallback.length} file(s) too big for Telegram`
        : `${linkFallback.length} file(s) — upload stalled`)
  }

  // Action bar (url buttons need a public host — a LAN IP can be rejected, so
  // the ZIP link goes in the text instead).
  const zipLine = entries.length > 1 ? `\n📦 ZIP all: ${esc(fileLink(jobId))}` : ''
  const row = redoToken ? [[{ text: '🔁 Redo', callback_data: `redo:${redoToken}` }]] : []
  await tg.sendMessage(chatId, `✅ <b>${esc(truncate(header, 90))}</b> — done.${zipLine}`, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(row.length ? { reply_markup: { inline_keyboard: row } } : {}),
  }).catch(() => {})
}

async function sendOne(
  tg: Telegram, chatId: number, jobId: string,
  f: { name: string; size: number; mime: string }, header: string,
  timeoutSec: number, linkFallback: { name: string; size: number }[],
) {
  const caption = `<b>${esc(truncate(header, 80))}</b>\n<code>${esc(f.name)}</code> · ${bytes(f.size)}`
  const common = { caption, parse_mode: 'HTML' as const }
  try {
    const { buffer, mime } = await api.fileBuffer(jobId, f.name)
    const input: InputFile = { source: buffer, filename: f.name }
    console.log(`[deliver] uploading ${f.name} (${bytes(buffer.length)})`)
    const send = async () => {
      if (mime.startsWith('video/') || /\.(mp4|mkv|webm|mov)$/i.test(f.name)) {
        await tg.sendVideo(chatId, input, { ...common, supports_streaming: true })
      } else if (mime.startsWith('audio/') || /\.(mp3|m4a|opus|ogg|flac|wav|aac)$/i.test(f.name)) {
        await tg.sendAudio(chatId, input, common)
      } else if ((mime.startsWith('image/') && !mime.includes('gif')) && f.size <= 10 * 1024 * 1024) {
        await tg.sendPhoto(chatId, input, common)
      } else {
        await tg.sendDocument(chatId, input, common)
      }
    }
    await withTimeout(send(), timeoutSec, 'upload')
    console.log(`[deliver] sent ${f.name}`)
  } catch (e: any) {
    console.error(`[deliver] ${f.name}: ${e?.message} → link fallback`)
    linkFallback.push({ name: f.name, size: f.size })
  }
}
