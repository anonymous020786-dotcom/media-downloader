import { Router } from 'express'
import { downloadQueue, redisConnection } from '../workers/downloadWorker.js'
import type { JobProgress, JobView } from '../types.js'
import { requireAuth, optionalAuth } from '../middleware/requireAuth.js'

const router = Router()

// ── SSE progress stream — public (just progress data, no files) ───────────────
router.get('/:id/progress', (req, res) => {
  res.setHeader('Content-Type',      'text/event-stream')
  res.setHeader('Cache-Control',     'no-cache, no-store, must-revalidate')
  res.setHeader('Connection',        'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const { id } = req.params
  let closed = false

  const send  = (data: JobProgress) => { if (closed) return; try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch { close() } }
  const close = () => { if (closed) return; closed = true; clearInterval(ticker); clearInterval(heartbeat); try { res.end() } catch {} }

  const ticker = setInterval(async () => {
    try {
      const raw = await redisConnection.get(`job:${id}:progress`)
      if (!raw) return
      const data: JobProgress = JSON.parse(raw)
      send(data)
      if (data.status === 'completed' || data.status === 'failed') close()
    } catch { close() }
  }, 350)

  const heartbeat = setInterval(() => { if (closed) return; try { res.write(': ping\n\n') } catch { close() } }, 25_000)
  req.on('close', close)
  req.on('error', close)
})

// ── List jobs (scoped to authenticated user; admins see all) ──────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.authUser!
    const isAdmin = user.role === 'admin' || user.role === 'super_admin'
    const jobs = await downloadQueue.getJobs(['waiting','active','completed','failed','delayed','prioritized'])

    const scoped = isAdmin ? jobs : jobs.filter(j => j.data.userId === user.id)

    const views: JobView[] = await Promise.all(
      scoped.map(async (job) => {
        const raw = await redisConnection.get(`job:${job.data.jobId}:progress`)
        const progress: JobProgress = raw ? JSON.parse(raw) : { status: 'queued', progress: 0 }
        return { ...job.data, bullId: job.id ?? '', progress }
      })
    )
    views.sort((a, b) => b.addedAt - a.addedAt)
    res.json(views)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Stats — public (aggregate counts only) ────────────────────────────────────
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

// ── Delete a job — must own it ────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.authUser!
    const job  = await downloadQueue.getJob(req.params.id as string)
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }
    const isAdmin = user.role === 'admin' || user.role === 'super_admin'
    if (!isAdmin && job.data.userId !== user.id) {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    await redisConnection.del(`job:${job.data.jobId}:progress`)
    await job.remove()
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Retry — must own it ───────────────────────────────────────────────────────
router.post('/:id/retry', requireAuth, async (req, res) => {
  try {
    const user = req.authUser!
    const job  = await downloadQueue.getJob(req.params.id as string)
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }
    const isAdmin = user.role === 'admin' || user.role === 'super_admin'
    if (!isAdmin && job.data.userId !== user.id) {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    await redisConnection.set(`job:${job.data.jobId}:progress`, JSON.stringify({ status: 'queued', progress: 0 }), 'EX', 86400)
    await job.retry()
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Clear completed/failed — admin only ──────────────────────────────────────
router.delete('/', requireAuth, async (req, res) => {
  const user = req.authUser!
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    res.status(403).json({ error: 'Admin access required' }); return
  }
  const type = req.query.type as string
  try {
    if (type === 'completed') await downloadQueue.clean(0, 1000, 'completed')
    else if (type === 'failed') await downloadQueue.clean(0, 1000, 'failed')
    else { await downloadQueue.clean(0, 1000, 'completed'); await downloadQueue.clean(0, 1000, 'failed') }
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
