import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { randomUUID } from 'crypto'
import analyzeRouter  from './routes/analyze.js'
import downloadRouter from './routes/download.js'
import jobsRouter     from './routes/jobs.js'
import filesRouter    from './routes/files.js'
import storageRouter  from './routes/storage.js'
import contentRouter  from './routes/content.js'
import tmdbRouter     from './routes/tmdb.js'
import newsRouter     from './routes/news.js'
import { startWorker } from './workers/downloadWorker.js'

const app  = express()
const PORT = Number(process.env.PORT ?? 4000)
const ENV  = process.env.NODE_ENV ?? 'development'

// ── Request ID (tracing) ──────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Request-Id', randomUUID())
  next()
})

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,   // API — no HTML served
  hsts: { maxAge: 31536000, includeSubDomains: true },
}))
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Request-Id', 'X-User-Id', 'Authorization'],
  maxAge: 86400,
}))

// ── Perf ──────────────────────────────────────────────────────────────────────
app.use(compression({ level: 6 }))
app.use(express.json({ limit: '256kb' }))

// ── Rate limiting (per-user when authenticated, else per-IP) ──────────────────
// Frontend forwards the Clerk user id via X-User-Id; signed-in users get higher quotas.
const keyByUserOrIp = (req: express.Request): string => {
  const uid = req.header('X-User-Id')
  return uid ? `u:${uid}` : `ip:${req.ip}`
}
const isAuthed = (req: express.Request) => !!req.header('X-User-Id')

const stdLimit = rateLimit({
  windowMs: 60_000,
  max: (req) => (isAuthed(req) ? 600 : 150),   // signed-in users: 4× quota
  keyGenerator: keyByUserOrIp,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Rate limit exceeded — please wait a moment or sign in for higher limits.' },
  skip: (req) => req.path.includes('/progress') || req.path.includes('/health'),
})
const analysisLimit = rateLimit({
  windowMs: 60_000,
  max: (req) => (isAuthed(req) ? 200 : 40),
  keyGenerator: keyByUserOrIp,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Analysis rate limit exceeded. Sign in for higher limits.' },
})
app.use('/api', stdLimit)
app.use('/api/analyze', analysisLimit)

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/analyze',  analyzeRouter)
app.use('/api/download', downloadRouter)
app.use('/api/jobs',     jobsRouter)
app.use('/api/files',    filesRouter)
app.use('/api/storage',  storageRouter)
app.use('/api/content',  contentRouter)
app.use('/api/tmdb',     tmdbRouter)
app.use('/api/news',     newsRouter)

// Serve uploaded media (images/files embedded in blog posts)
import { UPLOAD_DIR } from './routes/content.js'
app.use('/api/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }))

// Playlist analysis proxied to Python
app.post('/api/analyze-playlist', async (req, res) => {
  try {
    const { default: axios } = await import('axios')
    const PY = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'
    const { data } = await axios.post(`${PY}/analyze-playlist`, req.body, { timeout: 70_000 })
    res.json(data)
  } catch (e: any) {
    res.status(502).json({ error: e.response?.data?.detail ?? e.message })
  }
})

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', version: '3.0.0', env: ENV, uptime: Math.floor(process.uptime()) })
)

// Deep health — aggregates redis, mysql, python-service
app.get('/health/deep', async (_req, res) => {
  const checks: Record<string, string> = {}
  try { const { redisConnection } = await import('./workers/downloadWorker.js'); await redisConnection.ping(); checks.redis = 'ok' }
  catch (e: any) { checks.redis = `down: ${e.message}` }
  try { const { query } = await import('./db.js'); await query('SELECT 1'); checks.mysql = 'ok' }
  catch (e: any) { checks.mysql = `down: ${e.message}` }
  try {
    const { default: axios } = await import('axios')
    const PY = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'
    const { data } = await axios.get(`${PY}/health/deep`, { timeout: 8000 })
    checks.python = data.status
  } catch (e: any) { checks.python = `down: ${e.message}` }
  const healthy = checks.redis === 'ok' && checks.mysql === 'ok' && checks.python === 'ok'
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks })
})

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const id = (res.getHeader('X-Request-Id') as string) ?? '?'
  console.error(`[error] req=${id}`, err.message)
  res.status(500).json({ error: ENV === 'production' ? 'Internal server error' : err.message })
})

const server = app.listen(PORT, () => {
  console.log(`[server] v3.0.0 (${ENV}) → http://localhost:${PORT}`)
  startWorker()
})

// ── Resilience: never crash the process on an unhandled async error ──────────
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.message : reason)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message)
  // keep serving; a single bad request shouldn't take the API down
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = (sig: string) => {
  console.log(`[server] ${sig} received — shutting down gracefully`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
