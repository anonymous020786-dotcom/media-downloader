import { Router } from 'express'
import axios from 'axios'
import { getDiskInfo } from './storage.js'

/**
 * Public system-status endpoint.
 * --------------------------------------------------------------------------
 * Aggregates service health (redis / mysql / python), disk usage and the
 * supported-site count into a single unauthenticated payload that powers the
 * public /status page. No secrets are exposed — only up/down + coarse metrics.
 */

const router = Router()
const PYTHON = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'

router.get('/', async (_req, res) => {
  const checks: Record<string, 'ok' | 'down'> = {}

  // Redis
  try { const { redisConnection } = await import('../workers/downloadWorker.js'); await redisConnection.ping(); checks.redis = 'ok' }
  catch { checks.redis = 'down' }
  // MySQL
  try { const { query } = await import('../db.js'); await query('SELECT 1'); checks.mysql = 'ok' }
  catch { checks.mysql = 'down' }
  // Python download service
  let engines: Record<string, string | null> = {}
  try {
    const { data } = await axios.get(`${PYTHON}/health/deep`, { timeout: 8_000 })
    checks.python = data?.status === 'ok' ? 'ok' : 'down'
    if (data?.versions) engines = data.versions
  } catch { checks.python = 'down' }

  // Disk + supported sites (best-effort — never fail the whole response)
  const disk = await getDiskInfo().catch(() => null)
  let sites: any = null
  try { const { data } = await axios.get(`${PYTHON}/engines/sites`, { timeout: 8_000 }); sites = data } catch { /* optional */ }

  const allOk = Object.values(checks).every((v) => v === 'ok')
  res.set('Cache-Control', 'public, max-age=15')
  res.json({
    status: allOk ? 'operational' : (checks.python === 'down' || checks.mysql === 'down') ? 'major_outage' : 'degraded',
    updated_at: new Date().toISOString(),
    checks,
    engines,
    disk: disk ? { percent_used: disk.percent_used, free: disk.free, total: disk.total } : null,
    sites: sites ? { named_extractors: sites.named_extractors, by_engine: sites.by_engine } : null,
  })
})

export default router
