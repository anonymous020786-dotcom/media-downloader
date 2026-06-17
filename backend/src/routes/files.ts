import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import { optionalAuth } from '../middleware/requireAuth.js'

const router = Router()
const DOWNLOAD_DIR = path.resolve(process.env.DOWNLOAD_DIR ?? './downloads')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
  avi: 'video/x-msvideo', mov: 'video/quicktime', ts: 'video/mp2t',
  flv: 'video/x-flv', wmv: 'video/x-ms-wmv', '3gp': 'video/3gpp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg',
  opus: 'audio/opus', flac: 'audio/flac', wav: 'audio/wav', aac: 'audio/aac',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  svg: 'image/svg+xml', bmp: 'image/bmp', tiff: 'image/tiff',
  vtt: 'text/vtt', srt: 'application/x-subrip',
}

function getMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME[ext] ?? 'application/octet-stream'
}

// File access is by the job's UUID, which acts as an unguessable capability
// (122 bits of randomness). This is required because browsers cannot attach the
// Authorization header to <video src>, <img src>, or download-link navigations —
// so a per-user Bearer check would make a logged-in user unable to even play or
// download their OWN files. Serving by UUID ("anyone with the link") is the
// standard pattern for media and fixes that. The UUID is only ever known to the
// owner and is not enumerable.

// ── List files for a job ──────────────────────────────────────────────────────
router.get('/:jobId', optionalAuth, async (req, res) => {
  const jobId = req.params.jobId as string
  if (!UUID_RE.test(jobId)) { res.status(400).json({ error: 'Invalid job ID' }); return }
  const dir = path.join(DOWNLOAD_DIR, jobId)
  if (!fs.existsSync(dir)) { res.status(404).json({ error: 'Not found' }); return }
  const files = fs.readdirSync(dir)
    .filter((f) => { try { return fs.statSync(path.join(dir, f)).isFile() } catch { return false } })
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name))
      return { name, size: stat.size, mime: getMime(name) }
    })
  res.json(files)
})

// ── ZIP download ──────────────────────────────────────────────────────────────
router.get('/:jobId/zip', optionalAuth, async (req, res) => {
  const jobId = req.params.jobId as string
  if (!UUID_RE.test(jobId)) { res.status(400).json({ error: 'Invalid job ID' }); return }
  const dir = path.join(DOWNLOAD_DIR, jobId)
  if (!dir.startsWith(DOWNLOAD_DIR + path.sep) || !fs.existsSync(dir)) {
    res.status(404).json({ error: 'Not found' }); return
  }
  const hasFiles = fs.readdirSync(dir).some((f) => {
    try { return fs.statSync(path.join(dir, f)).isFile() } catch { return false }
  })
  if (!hasFiles) { res.status(404).json({ error: 'No files to archive' }); return }
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="mediadl-${jobId.slice(0, 8)}.zip"`)
  res.setHeader('Cache-Control', 'no-store')
  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.on('error', (err) => { console.error('[zip]', err.message); try { res.status(500).end() } catch {} })
  archive.pipe(res)
  archive.directory(dir, false)
  archive.finalize()
})

// ── Stream/download a file ────────────────────────────────────────────────────
router.get('/:jobId/:filename', optionalAuth, async (req, res) => {
  const jobId = req.params.jobId as string
  if (!UUID_RE.test(jobId)) { res.status(400).json({ error: 'Invalid job ID' }); return }
  const safe     = path.basename(req.params.filename as string)
  const filePath = path.join(DOWNLOAD_DIR, jobId, safe)
  if (!filePath.startsWith(DOWNLOAD_DIR + path.sep)) {
    res.status(403).json({ error: 'Forbidden' }); return
  }
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found' }); return }
  const stat    = fs.statSync(filePath)
  const size    = stat.size
  const mime    = getMime(safe)
  const isMedia = mime.startsWith('video/') || mime.startsWith('audio/')
  const range = req.headers.range
  if (range && isMedia) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-')
    const start    = parseInt(startStr, 10)
    const end      = endStr ? parseInt(endStr, 10) : size - 1
    const chunkSize = end - start + 1
    res.status(206)
    res.setHeader('Content-Range',  `bytes ${start}-${end}/${size}`)
    res.setHeader('Accept-Ranges',  'bytes')
    res.setHeader('Content-Length', chunkSize)
    res.setHeader('Content-Type',   mime)
    fs.createReadStream(filePath, { start, end }).pipe(res)
    return
  }
  res.setHeader('Content-Type',        mime)
  res.setHeader('Content-Length',      size)
  res.setHeader('Accept-Ranges',       'bytes')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safe)}`)
  res.setHeader('Cache-Control',       'no-store')
  fs.createReadStream(filePath).pipe(res)
})

export default router
