import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { requireAuth } from '../middleware/requireAuth.js'
import { query } from '../db.js'
import { uploadToS3, deleteFromS3 } from '../services/s3.js'
import {
  uploadToHostingerApi, deleteFromHostingerApi,
  uploadToHostinger, deleteFromHostinger,
} from '../services/hostinger.js'

const router  = Router()
const storage = multer.memoryStorage()
const upload  = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'))
    } else {
      cb(null, true)
    }
  },
})

const PROVIDER = () => (process.env.STORAGE_PROVIDER ?? 'supabase').toLowerCase()

// POST /api/upload/avatar
router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  const provider = PROVIDER()

  if (provider === 'supabase' || !provider) {
    res.status(400).json({ error: 'Use Supabase Storage client-side', provider: 'supabase' }); return
  }

  if (!req.file) {
    res.status(400).json({ error: 'No file provided' }); return
  }

  const userId = req.authUser!.id
  const ext    = path.extname(req.file.originalname).toLowerCase() || '.jpg'

  try {
    if (provider === 's3') {
      const key = `avatars/${userId}/${Date.now()}${ext}`
      const url = await uploadToS3(req.file.buffer, key, req.file.mimetype)
      await query('UPDATE users SET avatar_url = ?, s3_avatar_key = ? WHERE id = ?', [url, key, userId])
      res.json({ url })
    } else if (provider === 'hostinger' || provider === 'hostinger_api') {
      // PHP-API upload (upload.php on your Hostinger site)
      const filename = `${userId}-${Date.now()}${ext}`
      const url      = await uploadToHostingerApi(req.file.buffer, filename, req.file.mimetype, 'avatars')
      await query('UPDATE users SET avatar_url = ? WHERE id = ?', [url, userId])
      res.json({ url })
    } else if (provider === 'hostinger_ftp') {
      const filename = `${userId}-${Date.now()}${ext}`
      const url      = await uploadToHostinger(req.file.buffer, filename, 'avatars')
      await query('UPDATE users SET avatar_url = ? WHERE id = ?', [url, userId])
      res.json({ url })
    } else {
      res.status(400).json({ error: `Unknown STORAGE_PROVIDER: ${provider}` })
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/upload/avatar
router.delete('/avatar', requireAuth, async (req, res) => {
  const provider = PROVIDER()
  const userId   = req.authUser!.id

  try {
    const rows = await query<{ s3_avatar_key: string | null; avatar_url: string | null }>(
      'SELECT s3_avatar_key, avatar_url FROM users WHERE id = ?', [userId]
    )
    const row = rows[0]

    if (row?.s3_avatar_key) {
      await deleteFromS3(row.s3_avatar_key)
    } else if ((provider === 'hostinger' || provider === 'hostinger_api') && row?.avatar_url) {
      const filename = row.avatar_url.split('/').pop() ?? ''
      if (filename) await deleteFromHostingerApi(filename, 'avatars')
    } else if (provider === 'hostinger_ftp' && row?.avatar_url) {
      const filename = row.avatar_url.split('/').pop() ?? ''
      if (filename) await deleteFromHostinger(filename, 'avatars')
    }

    await query('UPDATE users SET avatar_url = NULL, s3_avatar_key = NULL WHERE id = ?', [userId])
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
