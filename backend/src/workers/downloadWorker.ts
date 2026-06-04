import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import axios from 'axios'
import type { DownloadJob } from '../types.js'

const REDIS_URL  = process.env.REDIS_URL          ?? 'redis://localhost:6379'
const PYTHON_URL = process.env.PYTHON_SERVICE_URL  ?? 'http://localhost:8000'
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5)

export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, enableReadyCheck: false,
})

export const downloadQueue = new Queue<DownloadJob>('downloads', {
  connection: redisConnection,
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
      await axios.post(`${PYTHON_URL}/download`, {
        url:              d.url,
        job_id:           d.jobId,
        media_type:       d.mediaType,
        format:           d.format,
        quality:          d.quality  ?? 'best',
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
    },
    {
      connection: new IORedis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false }),
      concurrency: CONCURRENCY,
    }
  )

  worker.on('failed', (job, err) => {
    if (!job) return
    redisConnection.set(
      `job:${job.data.jobId}:progress`,
      JSON.stringify({ status: 'failed', progress: 0, error: err.message.slice(0, 300) }),
      'EX', 86400
    ).catch(() => {})
    console.error(`[worker] job ${job.id} failed: ${err.message}`)
  })

  worker.on('error', (e) => console.error('[worker]', e.message))
  console.log(`[worker] started (concurrency=${CONCURRENCY})`)
  return worker
}
