import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { requireAdmin, requireSuperAdmin } from '../middleware/requireAdmin.js'

const router = Router()

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/

// GET /api/users/check-username?username=X — no auth
router.get('/check-username', async (req, res) => {
  const username = (req.query.username as string ?? '').trim()
  if (!USERNAME_RE.test(username)) {
    res.json({ available: false, username, error: 'Username must be 3-30 alphanumeric/underscore characters' }); return
  }
  const rows = await query<{ id: string }>('SELECT id FROM users WHERE username = ? LIMIT 1', [username])
  res.json({ available: rows.length === 0, username })
})

// Current user's own profile — any authenticated user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const rows = await query<any>(
      `SELECT id, email, name, avatar_url, role,
        username, phone, phone_verified, dob, gender,
        country, state_region, city, postal_code, address_line1, address_line2,
        bio, website, twitter_handle, instagram_handle, youtube_channel,
        linkedin_profile, github_username, microsoft_handle,
        occupation, company, industry, language,
        newsletter_subscribed, profile_complete, s3_avatar_key,
        backup_email, backup_email_verified, totp_enabled, mfa_enabled, preferred_mfa_method,
        last_sign_in, created_at
       FROM users WHERE id = ?`,
      [req.authUser!.id]
    )
    if (!rows.length) { res.status(404).json({ error: 'User not found' }); return }
    res.json(rows[0])
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// Update own profile
router.patch('/me', requireAuth, async (req, res) => {
  const userId = req.authUser!.id
  const body   = req.body as Record<string, any>

  const ALLOWED = [
    'name', 'avatar_url', 'username', 'phone', 'dob', 'gender',
    'country', 'state_region', 'city', 'postal_code', 'address_line1', 'address_line2',
    'bio', 'website', 'twitter_handle', 'instagram_handle', 'youtube_channel',
    'linkedin_profile', 'github_username', 'microsoft_handle',
    'occupation', 'company', 'industry', 'language', 'newsletter_subscribed', 'profile_complete',
  ]

  // Validate username if provided
  if (body.username !== undefined) {
    const u = String(body.username).trim()
    if (u && !USERNAME_RE.test(u)) {
      res.status(400).json({ error: 'Username must be 3-30 alphanumeric/underscore characters' }); return
    }
    if (u) {
      const conflict = await query<{ id: string }>(
        'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1', [u, userId]
      )
      if (conflict.length) {
        res.status(409).json({ error: 'Username already taken' }); return
      }
    }
  }

  const setClauses: string[] = []
  const params: any[]        = []

  for (const field of ALLOWED) {
    if (field in body) {
      setClauses.push(`${field} = ?`)
      params.push(body[field] ?? null)
    }
  }

  if (!setClauses.length) {
    res.status(400).json({ error: 'No updatable fields provided' }); return
  }

  try {
    params.push(userId)
    await query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`, params)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// List all users — admin+
router.get('/', requireAdmin, async (_req, res) => {
  try {
    const rows = await query<{
      id: string; email: string; name: string | null
      avatar_url: string | null; role: string; last_sign_in: string | null; created_at: string
    }>('SELECT id, email, name, avatar_url, role, last_sign_in, created_at FROM users ORDER BY created_at DESC LIMIT 500')
    res.json(rows)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// Change a user's role — super_admin only; cannot promote to super_admin
router.patch('/:id/role', requireSuperAdmin, async (req, res) => {
  const { role } = req.body as { role?: string }
  if (role !== 'user' && role !== 'admin') {
    res.status(400).json({ error: 'role must be "user" or "admin"' }); return
  }
  const { id } = req.params
  // Prevent self-demotion
  if (id === req.authUser!.id) {
    res.status(400).json({ error: 'Cannot change your own role' }); return
  }
  // Prevent touching other super_admins
  const rows = await query<{ role: string }>('SELECT role FROM users WHERE id = ?', [id])
  if (!rows.length) { res.status(404).json({ error: 'User not found' }); return }
  if (rows[0].role === 'super_admin') {
    res.status(403).json({ error: 'Cannot change a super_admin\'s role' }); return
  }
  await query('UPDATE users SET role = ? WHERE id = ?', [role, id])
  res.json({ success: true })
})

export default router
