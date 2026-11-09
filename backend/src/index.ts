import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { randomUUID } from 'crypto'
import analyzeRouter  from './routes/analyze.js'
import downloadRouter from './routes/download.js'
import streamRouter   from './routes/stream.js'
import jobsRouter     from './routes/jobs.js'
import filesRouter    from './routes/files.js'
import contentRouter  from './routes/content.js'
import { createServer } from 'node:http'
import { startWorker } from './workers/downloadWorker.js'
import { initSocket } from './socket.js'
import usersRouter   from './routes/users.js'
import proxyRouter   from './routes/proxy.js'
import cookiesRouter from './routes/cookies.js'
import statusRouter  from './routes/status.js'
import { trackActivity } from './activity.js'

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
  contentSecurityPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true },
}))

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',').map(o => o.trim()).filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / server-to-server (no origin header)
    if (!origin) return cb(null, true)
    // In dev allow all; in prod check allowlist
    if (process.env.NODE_ENV !== 'production') return cb(null, true)
    // The MediaDL browser extension (Chrome/Edge/Brave/Opera, Firefox, Safari).
    // Only extensions the user installed can send these origins.
    if (/^(chrome|moz|safari-web)-extension:\/\/[\w.-]+$/.test(origin)) return cb(null, true)
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: ${origin} not allowed`))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Request-Id', 'Authorization', 'X-User-Id', 'cf-turnstile-response', 'X-Internal-Key'],
  credentials: true,
  maxAge: 86400,
}))

// ── Perf ──────────────────────────────────────────────────────────────────────
app.use(compression({ level: 6 }))
app.use(express.json({ limit: '256kb' }))

// ── Rate limiting (per-IP — generous, this is a local single-user build) ──────
const stdLimit = rateLimit({
  windowMs: 60_000,
  max: 2000,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Rate limit exceeded — please wait a moment.' },
  skip: (req) => req.path.includes('/progress') || req.path.includes('/health'),
})
const analysisLimit = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Analysis rate limit exceeded — please wait a moment.' },
})
app.use('/api', stdLimit)
app.use('/api', trackActivity)
app.use('/api/analyze', analysisLimit)

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/analyze',  analyzeRouter)
app.use('/api/download', downloadRouter)
app.use('/api/stream',   streamRouter)
app.use('/api/jobs',     jobsRouter)
app.use('/api/files',    filesRouter)
app.use('/api/content',  contentRouter)
app.use('/api/users',        usersRouter)
app.use('/api/proxy',        proxyRouter)
app.use('/api/cookies',      cookiesRouter)
app.use('/api/status',       statusRouter)

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

// Deep health — python-service only (no redis/mysql in local mode)
app.get('/health/deep', async (_req, res) => {
  const checks: Record<string, string> = { store: 'ok' }
  try {
    const { default: axios } = await import('axios')
    const PY = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'
    const { data } = await axios.get(`${PY}/health/deep`, { timeout: 8000 })
    checks.python = data.status
  } catch (e: any) { checks.python = `down: ${e.message}` }
  const healthy = checks.python === 'ok'
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

// ── HTTP server (wraps Express so Socket.io can share the same port) ──────────
const httpServer = createServer(app)
initSocket(httpServer)

const server = httpServer.listen(PORT, () => {
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
