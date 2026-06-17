import { Router } from 'express'
import axios from 'axios'
import { getDiskInfo } from './storage.js'
import { query } from '../db.js'

/** Read the admin-set incident banner (if any) from site_settings. */
async function getIncident(): Promise<{ active: boolean; message: string; severity: string } | null> {
  try {
    const rows = await query<{ key_name: string; value: string }>(
      "SELECT key_name, value FROM site_settings WHERE key_name IN ('status_incident_active','status_incident_message','status_incident_severity')"
    )
    const m: Record<string, string> = {}
    rows.forEach((r) => { m[r.key_name] = r.value })
    if (m.status_incident_active !== '1' || !m.status_incident_message) return null
    const severity = ['info', 'warning', 'critical'].includes(m.status_incident_severity) ? m.status_incident_severity : 'warning'
    return { active: true, message: m.status_incident_message.slice(0, 500), severity }
  } catch { return null }
}

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

  const incident = await getIncident()

  const allOk = Object.values(checks).every((v) => v === 'ok')
  res.set('Cache-Control', 'public, max-age=15')
  res.json({
    status: allOk ? 'operational' : (checks.python === 'down' || checks.mysql === 'down') ? 'major_outage' : 'degraded',
    updated_at: new Date().toISOString(),
    incident,
    checks,
    engines,
    disk: disk ? { percent_used: disk.percent_used, free: disk.free, total: disk.total } : null,
    sites: sites ? { named_extractors: sites.named_extractors, by_engine: sites.by_engine } : null,
  })
})

export default router
