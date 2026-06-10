import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { downloadQueue, redisConnection } from '../workers/downloadWorker.js'
import { query } from '../db.js'
import type { DownloadJob, MediaType } from '../types.js'

const router = Router()
const PYTHON = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'

async function recordStat(job: DownloadJob, userId?: string) {
  try {
    await query(
      'INSERT INTO download_stats (user_id,url,media_type,format,quality,status) VALUES (?,?,?,?,?,?)',
      [userId ?? null, job.url.slice(0, 2000), job.mediaType, job.format, job.quality ?? null, 'queued']
    )
  } catch { /* stats are non-critical */ }
}

async function enqueue(job: DownloadJob, delaySeconds?: number) {
  await redisConnection.set(
    `job:${job.jobId}:progress`,
    JSON.stringify({ status: 'queued', progress: 0 }),
    'EX', 86400
  )
  const opts: any = { jobId: job.jobId }
  if (delaySeconds && delaySeconds > 0) opts.delay = delaySeconds * 1000
  // Priority: 1=high, 5=normal (default), 10=low
  if (job.priority && job.priority !== 5) opts.priority = job.priority
  await downloadQueue.add('download', job, opts)
}

const CRON: Record<string, string> = {
  hourly: '0 * * * *',
  daily:  '0 9 * * *',
  weekly: '0 9 * * 1',
}

router.post('/', async (req, res) => {
  const body = req.body as Partial<DownloadJob> & { delaySeconds?: number; repeatEvery?: string }
  const { url, mediaType } = body

  if (!url || !mediaType) {
    res.status(400).json({ error: 'url and mediaType are required' }); return
  }

  const jobId = uuidv4()
  const job: DownloadJob = {
    url, jobId, mediaType,
    format:         body.format         ?? 'mp4',
    quality:        body.quality         ?? 'best',
    title:          body.title,
    thumbnail:      body.thumbnail,
    addedAt:        Date.now(),
    priority:       body.priority        ?? 5,
    maxItems:       body.maxItems,
    startIndex:     body.startIndex      ?? 1,
    subtitles:      body.subtitles       ?? false,
    embedThumbnail: body.embedThumbnail  ?? false,
    embedMetadata:  body.embedMetadata   ?? true,
    cookies:        body.cookies,
    proxy:          body.proxy,
    capture:        body.capture         ?? false,
    captureSeconds: body.captureSeconds,
    startTime:          body.startTime,
    endTime:            body.endTime,
    subtitleLangs:      body.subtitleLangs,
    sponsorBlock:       body.sponsorBlock       ?? false,
    splitChapters:      body.splitChapters      ?? false,
    normalizeAudio:     body.normalizeAudio     ?? false,
    writeThumbnail:     body.writeThumbnail     ?? false,
    outputTemplate:     body.outputTemplate,
    speedLimit:         body.speedLimit,
    concurrentFragments: body.concurrentFragments ?? 16,
  }

  // Recurring (cron) schedule
  const pattern = body.repeatEvery ? CRON[body.repeatEvery] : undefined
  if (pattern) {
    await downloadQueue.add('download', job, { repeat: { pattern } })
    void recordStat(job, req.header('X-User-Id') || undefined)
    res.json({ jobId, recurring: body.repeatEvery })
    return
  }

  await enqueue(job, body.delaySeconds)
  void recordStat(job, req.header('X-User-Id') || undefined)
  res.json({ jobId, scheduled: !!(body.delaySeconds && body.delaySeconds > 0) })
})

// ── Manage recurring schedules ────────────────────────────────────────────────
router.get('/schedules', async (_req, res) => {
  try {
    const repeatables = await downloadQueue.getRepeatableJobs()
    res.json(repeatables.map((r) => ({ key: r.key, name: r.name, pattern: r.pattern, next: r.next })))
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

router.delete('/schedules/:key', async (req, res) => {
  try {
    await downloadQueue.removeRepeatableByKey(decodeURIComponent(req.params.key))
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Batch: queue multiple URLs in one request ─────────────────────────────────
router.post('/batch', async (req, res) => {
  const { items, ...sharedOpts } = req.body as {
    items: Array<{ url: string; title?: string; thumbnail?: string; mediaType?: MediaType; format?: string }>
    mediaType?: MediaType; format?: string; quality?: string; priority?: number
    subtitles?: boolean; embedThumbnail?: boolean; embedMetadata?: boolean
    cookies?: string; proxy?: string; sponsorBlock?: boolean; normalizeAudio?: boolean
    speedLimit?: string; concurrentFragments?: number; maxItems?: number
    delaySeconds?: number
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items array is required' }); return
  }
  if (items.length > 50) {
    res.status(400).json({ error: 'Maximum 50 items per batch' }); return
  }

  const jobs: Array<{ jobId: string; url: string; title?: string }> = []
  for (const item of items) {
    if (!item.url) continue
    const jobId = uuidv4()
    const job: DownloadJob = {
      url:            item.url,
      jobId,
      mediaType:      item.mediaType ?? sharedOpts.mediaType ?? 'video',
      format:         item.format    ?? sharedOpts.format    ?? 'mp4',
      quality:        sharedOpts.quality         ?? 'best',
      title:          item.title,
      thumbnail:      item.thumbnail,
      addedAt:        Date.now(),
      priority:       sharedOpts.priority        ?? 5,
      maxItems:       sharedOpts.maxItems,
      startIndex:     1,
      subtitles:      sharedOpts.subtitles       ?? false,
      embedThumbnail: sharedOpts.embedThumbnail  ?? false,
      embedMetadata:  sharedOpts.embedMetadata   ?? true,
      cookies:        sharedOpts.cookies,
      proxy:          sharedOpts.proxy,
      sponsorBlock:   sharedOpts.sponsorBlock    ?? false,
      normalizeAudio: sharedOpts.normalizeAudio  ?? false,
      speedLimit:     sharedOpts.speedLimit,
      concurrentFragments: sharedOpts.concurrentFragments ?? 16,
    }
    await enqueue(job, sharedOpts.delaySeconds)
    void recordStat(job, req.header('X-User-Id') || undefined)
    jobs.push({ jobId, url: item.url, title: item.title })
  }

  res.json({ count: jobs.length, jobs })
})

// ── Convert: re-encode an already-downloaded file ────────────────────────────
router.post('/convert', async (req, res) => {
  const body = req.body as {
    job_id: string; filename: string; output_format: string
    new_job_id?: string; video_codec?: string; resolution?: string; crf?: number; fps?: number
    audio_codec?: string; audio_bitrate?: string; extract_audio?: boolean
    gif_fps?: number; gif_scale?: number; start_time?: string; end_time?: string
  }
  if (!body.job_id || !body.filename || !body.output_format) {
    res.status(400).json({ error: 'job_id, filename and output_format are required' }); return
  }
  try {
    const { data } = await axios.post(`${PYTHON}/convert`, body, { timeout: 0 })
    res.json(data)
  } catch (e: any) {
    const msg = e.response?.data?.detail ?? e.message
    res.status(502).json({ error: msg })
  }
})

// ── RSS/M3U feed parser ───────────────────────────────────────────────────────
router.post('/feed', async (req, res) => {
  const { url } = req.body as { url?: string }
  if (!url) { res.status(400).json({ error: 'url is required' }); return }
  try {
    const { data } = await axios.post(`${PYTHON}/rss`, { url }, { timeout: 35_000 })
    res.json(data)
  } catch (e: any) {
    const msg = e.response?.data?.detail ?? e.message
    res.status(502).json({ error: msg })
  }
})

// ── Merge: combine separate audio + video files ───────────────────────────────
router.post('/merge', async (req, res) => {
  const body = req.body as { job_id: string; video_file: string; audio_file: string; output_format?: string; output_filename?: string }
  if (!body.job_id || !body.video_file || !body.audio_file) {
    res.status(400).json({ error: 'job_id, video_file and audio_file are required' }); return
  }
  try {
    const { data } = await axios.post(`${PYTHON}/merge`, body, { timeout: 0 })
    res.json(data)
  } catch (e: any) {
    res.status(502).json({ error: e.response?.data?.detail ?? e.message })
  }
})

// ── Auto: analyze + queue from just a URL (used by the browser extension) ──────
router.post('/auto', async (req, res) => {
  const { url, delaySeconds } = req.body as { url?: string; delaySeconds?: number }
  if (!url) { res.status(400).json({ error: 'url is required' }); return }
  try {
    let mediaType: MediaType = 'video'
    let title: string | undefined
    let thumbnail: string | undefined
    let format = 'mp4'
    try {
      const { data } = await axios.post(`${PYTHON}/analyze`, { url }, { timeout: 35_000 })
      mediaType = (data.type ?? 'video') as MediaType
      title = data.title ?? data.filename
      thumbnail = data.thumbnail
      format = mediaType === 'image' || mediaType === 'page' ? 'original'
             : mediaType === 'file' || mediaType === 'torrent' ? 'original' : 'mp4'
    } catch { /* fall back to video defaults */ }

    const jobId = uuidv4()
    const job: DownloadJob = {
      url, jobId, mediaType, format,
      quality: 'best', title, thumbnail, addedAt: Date.now(),
      startIndex: 1, embedMetadata: true,
    }
    await enqueue(job, delaySeconds)
    res.json({ jobId, mediaType })
  } catch (e: any) {
    res.status(502).json({ error: e.message })
  }
})

export default router
