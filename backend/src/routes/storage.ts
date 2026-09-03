import { Router } from 'express'
import axios from 'axios'
import { requireAuth, optionalAuth } from '../middleware/requireAuth.js'

const router  = Router()
const PYTHON  = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Minimum free disk space (MB) required to accept a new download. Below this the
// backend first auto-prunes old jobs, then refuses with 507 if still too low.
const MIN_FREE_DISK_MB = Number(process.env.MIN_FREE_DISK_MB ?? 1024)

export interface DiskInfo {
  total: number; used: number; free: number; percent_used: number; downloads_bytes: number
}

/** Fetch disk usage from the python-service. Returns null if unavailable (fail-open). */
export async function getDiskInfo(): Promise<DiskInfo | null> {
  try {
    const { data } = await axios.get<DiskInfo>(`${PYTHON}/storage/disk`, { timeout: 8_000 })
    return data
  } catch { return null }
}

/**
 * Guard run before queuing a download. When free space is below the threshold it
 * triggers a TTL cleanup and re-checks. Returns an error message to surface to the
 * client, or null when there's enough room (or disk state is unknown — fail-open so
 * a transient python-service hiccup never blocks downloads).
 */
export async function ensureDiskSpace(): Promise<string | null> {
  const minFree = MIN_FREE_DISK_MB * 1_048_576
  let info = await getDiskInfo()
  if (!info || !info.total) return null            // unknown → don't block
  if (info.free >= minFree) return null            // plenty of room

  // Low on space — try pruning expired job dirs, then re-check.
  try { await axios.post(`${PYTHON}/storage/cleanup`, {}, { timeout: 30_000 }) } catch { /* best effort */ }
  info = await getDiskInfo()
  if (!info || info.free >= minFree) return null

  const freeMb = Math.round(info.free / 1_048_576)
  return `Server storage is full (${freeMb} MB free, ${MIN_FREE_DISK_MB} MB required). `
       + `Old downloads are auto-removed after a few days — please try again later or delete some files.`
}

// Storage overview
router.get('/', optionalAuth, async (_req, res) => {
  try {
    const { data } = await axios.get(`${PYTHON}/storage`, { timeout: 10_000 })
    res.json(data)
  } catch (e: any) { res.status(502).json({ error: e.message }) }
})

// Disk usage — any signed-in user (drives the storage badge / pre-download check)
router.get('/disk', optionalAuth, async (_req, res) => {
  const info = await getDiskInfo()
  if (!info) { res.status(502).json({ error: 'disk info unavailable' }); return }
  res.json(info)
})

// Delete a job's files
router.delete('/:jobId', requireAuth, async (req, res) => {
  const jobId = req.params.jobId as string
  if (!UUID_RE.test(jobId)) { res.status(400).json({ error: 'Invalid job ID' }); return }
  try {
    await axios.delete(`${PYTHON}/storage/${jobId}`, { timeout: 10_000 })
    res.json({ success: true })
  } catch (e: any) { res.status(502).json({ error: e.message }) }
})

export default router
