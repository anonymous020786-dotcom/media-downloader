import { Router } from 'express'
import { saveToken, removeToken, isFcmEnabled } from '../services/fcm.js'

const router = Router()

// Any authenticated or anonymous user can register a push token.
// We use X-User-Id header (set by AuthSync on the frontend) as the key.
// Unauthenticated users are stored under their session token hash.

router.post('/register', async (req, res) => {
  const { token } = req.body as { token?: string }
  if (!token) { res.status(400).json({ error: 'token required' }); return }
  // Key: authenticated user id > or a device id passed as X-Device-Id
  const userId = req.header('X-User-Id') || req.header('X-Device-Id') || ''
  if (!userId) { res.status(400).json({ error: 'X-User-Id or X-Device-Id header required' }); return }
  try {
    await saveToken(userId, token.trim())
    res.json({ success: true, enabled: isFcmEnabled() })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

router.delete('/unregister', async (req, res) => {
  const userId = req.header('X-User-Id') || req.header('X-Device-Id') || ''
  if (!userId) { res.status(400).json({ error: 'X-User-Id or X-Device-Id required' }); return }
  try {
    await removeToken(userId)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

router.get('/status', (_req, res) => {
  res.json({ fcm_enabled: isFcmEnabled() })
})

export default router
