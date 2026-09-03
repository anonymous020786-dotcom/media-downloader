import { Router } from 'express'
import { requireAuth, LOCAL_USER } from '../middleware/requireAuth.js'

// Local build: no auth, no user DB. There is one implicit local user.
const router = Router()

const PROFILE = {
  ...LOCAL_USER,
  name: 'Local User',
  avatar_url: null,
  username: 'local',
  language: 'en',
  profile_complete: 1,
  mfa_enabled: 0,
  totp_enabled: 0,
  preferred_mfa_method: 'email',
  created_at: new Date().toISOString(),
  last_sign_in: new Date().toISOString(),
}

router.get('/check-username', (_req, res) => res.json({ available: true, username: 'local' }))

router.get('/me', requireAuth, (_req, res) => res.json(PROFILE))

router.patch('/me', requireAuth, (_req, res) => res.json({ success: true }))

router.get('/', requireAuth, (_req, res) => res.json([PROFILE]))

router.patch('/:id/role', requireAuth, (_req, res) =>
  res.status(400).json({ error: 'Roles are not configurable in local mode' }))

export default router
