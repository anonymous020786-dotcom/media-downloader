import { Router } from 'express'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { requireAuth, optionalAuth } from '../middleware/requireAuth.js'
import { query } from '../db.js'
import { uploadToS3, getPresignedDownloadUrl } from '../services/s3.js'

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

// Storage overview — admin only (anonymous/non-admin get an empty view, not a 401/403)
router.get('/', optionalAuth, async (req, res) => {
  const role = req.authUser?.role
  if (role !== 'admin' && role !== 'super_admin') {
    res.json({ jobs: [], total_bytes: 0, total_jobs: 0 }); return
  }
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

// Delete a job's files — must own the job or be admin
router.delete('/:jobId', requireAuth, async (req, res) => {
  const jobId = req.params.jobId as string
  if (!UUID_RE.test(jobId)) { res.status(400).json({ error: 'Invalid job ID' }); return }
  const user = req.authUser!
  const isAdmin = user.role === 'admin' || user.role === 'super_admin'
  if (!isAdmin) {
    const rows = await query<{ user_id: string | null }>('SELECT user_id FROM download_stats WHERE job_id = ? LIMIT 1', [jobId])
    if (rows[0]?.user_id && rows[0].user_id !== user.id) {
      res.status(403).json({ error: 'Forbidden' }); return
    }
  }
  try {
    await axios.delete(`${PYTHON}/storage/${jobId}`, { timeout: 10_000 })
    res.json({ success: true })
  } catch (e: any) { res.status(502).json({ error: e.message }) }
})

// POST /api/storage/upload-to-s3/:jobId
router.post('/upload-to-s3/:jobId', requireAuth, async (req, res) => {
  const jobId = req.params.jobId as string
  if (!UUID_RE.test(jobId)) { res.status(400).json({ error: 'Invalid job ID' }); return }

  const user = req.authUser!
  const isAdmin = user.role === 'admin' || user.role === 'super_admin'

  const jobs = await query<{ user_id: string | null; title: string | null }>(
    'SELECT user_id, title FROM download_stats WHERE job_id = ? LIMIT 1', [jobId]
  )
  if (!jobs.length) { res.status(404).json({ error: 'Job not found' }); return }
  if (!isAdmin && jobs[0].user_id && jobs[0].user_id !== user.id) {
    res.status(403).json({ error: 'Forbidden' }); return
  }

  const downloadDir = path.join('/downloads', jobId)
  let files: string[] = []
  try { files = fs.readdirSync(downloadDir) } catch { /* no files */ }

  if (!files.length) { res.status(404).json({ error: 'No files found for this job' }); return }

  try {
    const bucket = process.env.AWS_S3_DOWNLOADS_BUCKET ?? process.env.AWS_S3_BUCKET ?? ''
    const urls: string[] = []
    for (const file of files) {
      const filePath    = path.join(downloadDir, file)
      const buffer      = fs.readFileSync(filePath)
      const ext         = path.extname(file)
      const contentType = ext === '.mp4' ? 'video/mp4' : ext === '.mp3' ? 'audio/mpeg' : 'application/octet-stream'
      const key         = `downloads/${jobId}/${file}`
      const url         = await uploadToS3(buffer, key, contentType, bucket)
      urls.push(url)
    }
    const firstUrl = urls[0]
    await query('UPDATE download_stats SET s3_url = ? WHERE job_id = ?', [firstUrl, jobId])
    res.json({ url: firstUrl, urls })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/storage/s3-link/:jobId
router.get('/s3-link/:jobId', requireAuth, async (req, res) => {
  const jobId = req.params.jobId as string
  if (!UUID_RE.test(jobId)) { res.status(400).json({ error: 'Invalid job ID' }); return }

  const user    = req.authUser!
  const isAdmin = user.role === 'admin' || user.role === 'super_admin'

  const rows = await query<{ user_id: string | null; s3_url: string | null }>(
    'SELECT user_id, s3_url FROM download_stats WHERE job_id = ? LIMIT 1', [jobId]
  )
  if (!rows.length) { res.status(404).json({ error: 'Job not found' }); return }
  if (!isAdmin && rows[0].user_id && rows[0].user_id !== user.id) {
    res.status(403).json({ error: 'Forbidden' }); return
  }
  if (!rows[0].s3_url) { res.status(404).json({ error: 'No S3 URL for this job' }); return }

  try {
    // Extract key from URL
    const s3Url = rows[0].s3_url
    const urlObj = new URL(s3Url)
    const key    = urlObj.pathname.slice(1) // remove leading /
    const url    = await getPresignedDownloadUrl(key, 3600)
    res.json({ url, expiresIn: 3600 })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
