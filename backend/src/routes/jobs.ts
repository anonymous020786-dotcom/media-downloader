import { Router } from 'express'
import { downloadQueue, redisConnection } from '../workers/downloadWorker.js'
import type { JobProgress, JobView } from '../types.js'

const router = Router()

// ── SSE progress stream ───────────────────────────────────────────────────────
router.get('/:id/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')  // disable nginx/proxy buffering
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  const { id } = req.params
  let closed = false

  const send = (data: JobProgress) => {
    if (closed) return
    try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch { close() }
  }

  const close = () => {
    if (closed) return
    closed = true
    clearInterval(ticker)
    clearInterval(heartbeat)
    try { res.end() } catch {}
  }

  // Progress poll every 350 ms
  const ticker = setInterval(async () => {
    try {
      const raw = await redisConnection.get(`job:${id}:progress`)
      if (!raw) return
      const data: JobProgress = JSON.parse(raw)
      send(data)
      if (data.status === 'completed' || data.status === 'failed') close()
    } catch { close() }
  }, 350)

  // Heartbeat every 25 s — prevents proxy/load-balancer timeouts
  const heartbeat = setInterval(() => {
    if (closed) return
    try { res.write(': ping\n\n') } catch { close() }
  }, 25_000)

  req.on('close', close)
  req.on('error', close)
})

// ── List all jobs ─────────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const jobs = await downloadQueue.getJobs([
      'waiting','active','completed','failed','delayed','prioritized',
    ])
    const views: JobView[] = await Promise.all(
      jobs.map(async (job) => {
        const raw = await redisConnection.get(`job:${job.data.jobId}:progress`)
        const progress: JobProgress = raw
          ? JSON.parse(raw)
          : { status: 'queued', progress: 0 }
        return { ...job.data, bullId: job.id ?? '', progress }
      })
    )
    views.sort((a, b) => b.addedAt - a.addedAt)
    res.json(views)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      downloadQueue.getWaitingCount(),
      downloadQueue.getActiveCount(),
      downloadQueue.getCompletedCount(),
      downloadQueue.getFailedCount(),
    ])
    res.json({ waiting, active, completed, failed, total: waiting+active+completed+failed })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const job = await downloadQueue.getJob(req.params.id)
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }
    await redisConnection.del(`job:${job.data.jobId}:progress`)
    await job.remove()
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Retry ─────────────────────────────────────────────────────────────────────
router.post('/:id/retry', async (req, res) => {
  try {
    const job = await downloadQueue.getJob(req.params.id)
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }
    await redisConnection.set(
      `job:${job.data.jobId}:progress`,
      JSON.stringify({ status: 'queued', progress: 0 }),
      'EX', 86400
    )
    await job.retry()
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Clear ─────────────────────────────────────────────────────────────────────
router.delete('/', async (req, res) => {
  const type = req.query.type as string
  try {
    if (type === 'completed') await downloadQueue.clean(0, 1000, 'completed')
    else if (type === 'failed') await downloadQueue.clean(0, 1000, 'failed')
    else {
      await downloadQueue.clean(0, 1000, 'completed')
      await downloadQueue.clean(0, 1000, 'failed')
    }
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
