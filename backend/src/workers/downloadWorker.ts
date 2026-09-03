import axios from 'axios'
import type { DownloadJob } from '../types.js'
import { resolveProxy } from '../routes/proxy.js'
import { kv, MemQueue, type MemJob } from '../lib/store.js'

// Errors that usually mean "this CDN/site blocked our server IP" — worth a
// one-shot retry through the user's proxy/VPN pool before giving up.
const BLOCK_RE = /\b(403|451|429)\b|forbidden|geo[\s-]?block|geo[\s-]?restrict|not available|unavailable in your|region|blocked|access denied|country/i

const PYTHON_URL = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'

// Kept exports so the rest of the codebase (routes, socket) needs no changes.
export const redisConnection = kv
export const downloadQueue = new MemQueue()

// ── Progress bridge ──────────────────────────────────────────────────────────
// The python service keeps download progress in its own memory. While a job is
// running we poll it and mirror the payload into our kv so jobs.ts / socket.ts
// (which read `job:<id>:progress`) keep working exactly as before.
function bridgeProgress(jobId: string): () => void {
  let stopped = false
  const tick = async () => {
    if (stopped) return
    try {
      const { data } = await axios.get(`${PYTHON_URL}/progress/${jobId}`, { timeout: 5_000 })
      if (data && data.status && data.status !== 'unknown') {
        await kv.set(`job:${jobId}:progress`, JSON.stringify(data), 'EX', 86400)
      }
    } catch { /* python not ready yet — keep trying */ }
  }
  const id = setInterval(tick, 500)
  void tick()
  return () => { stopped = true; clearInterval(id) }
}

async function processJob(job: MemJob<DownloadJob>) {
  const d = job.data

  const { watchJob } = await import('../socket.js')
  watchJob(d.jobId)

  await kv.set(
    `job:${d.jobId}:progress`,
    JSON.stringify({ status: 'starting', progress: 0 }),
    'EX', 86400,
  ).catch(() => {})

  const callPython = (proxy: string | null) =>
    axios.post(`${PYTHON_URL}/download`, {
      url:              d.url,
      job_id:           d.jobId,
      media_type:       d.mediaType,
      format:           d.format,
      quality:          d.quality  ?? 'best',
      format_id:        d.formatId ?? null,
      max_items:        d.maxItems  ?? null,
      start_index:      d.startIndex ?? 1,
      subtitles:        d.subtitles  ?? false,
      embed_thumbnail:  d.embedThumbnail ?? false,
      embed_metadata:   d.embedMetadata  ?? true,
      cookies:          d.cookies  ?? null,
      proxy,
      capture:          d.capture  ?? false,
      capture_seconds:  d.captureSeconds ?? null,
      start_time:           d.startTime           ?? null,
      end_time:             d.endTime             ?? null,
      subtitle_langs:       d.subtitleLangs        ?? null,
      sponsor_block:        d.sponsorBlock         ?? false,
      split_chapters:       d.splitChapters        ?? false,
      normalize_audio:      d.normalizeAudio       ?? false,
      write_thumbnail:      d.writeThumbnail       ?? false,
      output_template:      d.outputTemplate       ?? null,
      speed_limit:          d.speedLimit           ?? null,
      concurrent_fragments: d.concurrentFragments  ?? 16,
    }, { timeout: 0 })

  // Surface the python-service's own error text (not axios's generic "status code 403").
  const detailed = (err: any) =>
    new Error(String(err?.response?.data?.detail ?? err?.message ?? 'download failed'))

  const stopBridge = bridgeProgress(d.jobId)
  let result
  try {
    try {
      result = await callPython(d.proxy ?? null)
    } catch (err: any) {
      // One-shot proxy retry when the failure looks like an IP block.
      const msg = String(err?.response?.data?.detail ?? err?.message ?? '')
      const eligible = !!d.userId && !d.proxy && BLOCK_RE.test(msg)
      const proxyUrl = eligible ? await resolveProxy('auto', d.userId!).catch(() => undefined) : undefined
      if (!proxyUrl) throw detailed(err)
      await kv.set(
        `job:${d.jobId}:progress`,
        JSON.stringify({ status: 'starting', progress: 0, note: 'blocked — retrying via proxy' }),
        'EX', 86400,
      ).catch(() => {})
      try {
        result = await callPython(proxyUrl)
      } catch (err2: any) {
        throw detailed(err2)
      }
    }
  } finally {
    stopBridge()
  }

  const files: string[] = result.data?.files ?? []
  const { emitJobDone } = await import('../socket.js')
  emitJobDone(d.jobId, { files })
  await kv.set(
    `job:${d.jobId}:progress`,
    JSON.stringify({ status: 'completed', progress: 100, files }),
    'EX', 86400,
  ).catch(() => {})

  if (d.webhookUrl) {
    axios.post(d.webhookUrl, {
      jobId: d.jobId, status: 'completed',
      url: d.url, title: d.title ?? null, files,
    }, { timeout: 10_000 }).catch(() => {})
  }
}

export function startWorker() {
  downloadQueue.setProcessor(processJob as (job: MemJob) => Promise<any>)

  downloadQueue.on('failed', async (job: MemJob<DownloadJob>, err: Error) => {
    if (!job) return
    const progress = JSON.stringify({ status: 'failed', progress: 0, error: err.message.slice(0, 300) })
    kv.set(`job:${job.data.jobId}:progress`, progress, 'EX', 86400).catch(() => {})

    const { emitJobFailed } = await import('../socket.js')
    emitJobFailed(job.data.jobId, err.message.slice(0, 300))

    if (job.data.webhookUrl) {
      axios.post(job.data.webhookUrl, {
        jobId: job.data.jobId, status: 'failed',
        url: job.data.url, title: job.data.title ?? null,
        error: err.message.slice(0, 300),
      }, { timeout: 10_000 }).catch(() => {})
    }
    console.error(`[worker] job ${job.id} failed: ${err.message}`)
  })

  console.log(`[worker] started (in-memory queue, concurrency=${process.env.WORKER_CONCURRENCY ?? 3})`)
}
