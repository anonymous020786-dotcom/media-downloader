import { Router } from 'express'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { requireAuth } from '../middleware/requireAuth.js'
import { query } from '../db.js'
import { uploadToS3, getPresignedDownloadUrl } from '../services/s3.js'

const router  = Router()
const PYTHON  = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Storage overview — admin only
router.get('/', requireAuth, async (req, res) => {
  if (req.authUser!.role !== 'admin' && req.authUser!.role !== 'super_admin') {
    res.status(403).json({ error: 'Admin access required' }); return
  }
  try {
    const { data } = await axios.get(`${PYTHON}/storage`, { timeout: 10_000 })
    res.json(data)
  } catch (e: any) { res.status(502).json({ error: e.message }) }
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
