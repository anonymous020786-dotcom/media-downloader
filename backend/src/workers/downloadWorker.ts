import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import axios from 'axios'
import type { DownloadJob } from '../types.js'

const REDIS_URL   = process.env.REDIS_URL            ?? 'redis://localhost:6379'
const PYTHON_URL  = process.env.PYTHON_SERVICE_URL    ?? 'http://localhost:8000'
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5)

export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, enableReadyCheck: false,
})

export const downloadQueue = new Queue<DownloadJob, any, string>('downloads', {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 300, age: 60 * 60 * 24 * 7 },
    removeOnFail:     { count: 150, age: 60 * 60 * 24 * 3 },
  },
})

export function startWorker() {
  const worker = new Worker<DownloadJob>(
    'downloads',
    async (job) => {
      const d = job.data

      // ── Notify socket + kafka of job start ──────────────────────────────────
      const { watchJob }        = await import('../socket.js')
      const { kafka: kfk }      = await import('../services/kafka.js')
      watchJob(d.jobId)
      kfk.downloadStarted(d.jobId, d.url).catch(() => {})

      // ── Set initial progress ─────────────────────────────────────────────────
      await redisConnection.set(
        `job:${d.jobId}:progress`,
        JSON.stringify({ status: 'starting', progress: 0 }),
        'EX', 86400
      ).catch(() => {})

      const result = await axios.post(`${PYTHON_URL}/download`, {
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
        proxy:            d.proxy    ?? null,
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

      // ── On success: emit done event + FCM push ───────────────────────────────
      const files: string[] = result.data?.files ?? []
      const { emitJobDone } = await import('../socket.js')
      emitJobDone(d.jobId, { files })
      kfk.downloadCompleted(d.jobId, d.url, files).catch(() => {})

      // ── Persist completed status to download_stats ────────────────────────────
      try {
        const { query } = await import('../db.js')
        await query(
          'UPDATE download_stats SET status=?, files=?, title=? WHERE job_id=?',
          ['completed', JSON.stringify(files), (d.title ?? null), d.jobId]
        )
      } catch { /* non-critical */ }

      // ── Webhook notification ──────────────────────────────────────────────────
      if (d.webhookUrl) {
        axios.post(d.webhookUrl, {
          jobId: d.jobId, status: 'completed',
          url: d.url, title: d.title ?? null, files,
        }, { timeout: 10_000 }).catch(() => {})
      }

      // ── Push notification to user (if signed in and token registered) ────────
      if (d.userId) {
        const { notifyUser } = await import('../services/fcm.js')
        const label = d.title ?? (() => { try { return new URL(d.url).hostname } catch { return 'download' } })()
        notifyUser(
          d.userId,
          'Download complete ✓',
          `${label}${files.length > 1 ? ` · ${files.length} files` : ''}`,
          '/download'
        ).catch(() => {})
      }
    },
    {
      connection: new IORedis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false }) as any,
      concurrency: CONCURRENCY,
    }
  )

  worker.on('failed', async (job, err) => {
    if (!job) return
    const progress = JSON.stringify({ status: 'failed', progress: 0, error: err.message.slice(0, 300) })
    redisConnection.set(`job:${job.data.jobId}:progress`, progress, 'EX', 86400).catch(() => {})

    // Emit via socket + kafka
    const { emitJobFailed } = await import('../socket.js')
    const { kafka: kfk }    = await import('../services/kafka.js')
    emitJobFailed(job.data.jobId, err.message.slice(0, 300))
    kfk.downloadFailed(job.data.jobId, job.data.url, err.message.slice(0, 300)).catch(() => {})

    // Persist failed status + webhook
    try {
      const { query } = await import('../db.js')
      await query('UPDATE download_stats SET status=? WHERE job_id=?',
        ['failed', job.data.jobId])
    } catch { /* non-critical */ }

    if (job.data.webhookUrl) {
      axios.post(job.data.webhookUrl, {
        jobId: job.data.jobId, status: 'failed',
        url: job.data.url, title: job.data.title ?? null,
        error: err.message.slice(0, 300),
      }, { timeout: 10_000 }).catch(() => {})
    }

    console.error(`[worker] job ${job.id} failed: ${err.message}`)
  })

  worker.on('error', (e) => console.error('[worker]', e.message))
  console.log(`[worker] started (concurrency=${CONCURRENCY})`)
  return worker
}
