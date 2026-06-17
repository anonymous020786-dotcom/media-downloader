import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

/**
 * Per-site cookie store.
 * --------------------------------------------------------------------------
 * The download pipeline already accepts a `cookies` string on every job (Netscape
 * cookies.txt text, or a raw browser "Cookie:" header). This router lets a user
 * SAVE those cookies once per domain so login-walled / members-only / age-gated
 * content keeps downloading without re-pasting them every time. download.ts calls
 * resolveCookies(url, userId) to auto-attach the matching domain's cookies when
 * the request itself didn't supply any.
 */

const router = Router()
router.use(requireAuth)

/** Normalise a user-entered domain or URL down to a bare hostname (no scheme/www/path). */
export function normalizeDomain(input: string): string {
  let s = (input ?? '').trim().toLowerCase()
  if (!s) return ''
  s = s.replace(/^[a-z]+:\/\//, '')   // strip scheme
  s = s.split('/')[0]                 // strip path
  s = s.split('@').pop() as string    // strip any user:pass@
  s = s.split(':')[0]                 // strip port
  s = s.replace(/^www\./, '')         // strip leading www.
  return s.slice(0, 190)
}

/**
 * Find saved cookies for the given URL's host. Matches the most specific saved
 * domain that the host equals or is a sub-domain of (so "xhamster.com" covers
 * "www.xhamster.com"). Returns the cookie text, or undefined if none.
 */
export async function resolveCookies(url: string | undefined, userId: string): Promise<string | undefined> {
  if (!url) return undefined
  let host = ''
  try { host = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase() }
  catch { return undefined }
  if (!host) return undefined
  const bare = host.replace(/^www\./, '')

  const rows = await query<{ domain: string; cookies: string }>(
    'SELECT domain, cookies FROM user_cookies WHERE user_id=? AND enabled=1', [userId]
  )
  let best: { domain: string; cookies: string } | undefined
  for (const r of rows) {
    const d = r.domain.toLowerCase()
    if (bare === d || bare.endsWith(`.${d}`)) {
      // Prefer the longest (most specific) matching domain.
      if (!best || d.length > best.domain.length) best = r
    }
  }
  return best?.cookies
}

/** Mask the cookie text when echoing it back — never return raw secrets to the client. */
function summarize(cookies: string): { count: number; preview: string } {
  const text = (cookies ?? '').trim()
  // Netscape format = one cookie per non-comment line; header format = name=value; pairs.
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  const count = lines.length > 1
    ? lines.length
    : text.split(';').filter((p) => p.includes('=')).length
  return { count: Math.max(count, text ? 1 : 0), preview: text.slice(0, 24) + (text.length > 24 ? '…' : '') }
}

// ── List saved cookie sets (never returns the raw cookie text) ────────────────
router.get('/', async (req, res) => {
  try {
    const userId = req.authUser!.id
    const rows = await query<{ id: string; domain: string; label: string | null; cookies: string; enabled: number; updated_at: string }>(
      'SELECT id, domain, label, cookies, enabled, updated_at FROM user_cookies WHERE user_id=? ORDER BY domain ASC', [userId]
    )
    res.json(rows.map((r) => ({
      id: r.id, domain: r.domain, label: r.label, enabled: !!r.enabled,
      updated_at: r.updated_at, ...summarize(r.cookies),
    })))
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Save (upsert) cookies for a domain ────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const userId  = req.authUser!.id
    const domain  = normalizeDomain((req.body?.domain ?? '').toString())
    const cookies = (req.body?.cookies ?? '').toString().trim()
    const label   = (req.body?.label ?? '').toString().trim().slice(0, 120) || null
    if (!domain)  { res.status(400).json({ error: 'domain is required (e.g. xhamster.com)' }); return }
    if (!cookies) { res.status(400).json({ error: 'cookies text is required' }); return }
    if (cookies.length > 1_000_000) { res.status(400).json({ error: 'cookies text too large' }); return }

    const existing = await query<{ id: string }>(
      'SELECT id FROM user_cookies WHERE user_id=? AND domain=?', [userId, domain]
    )
    if (existing[0]) {
      await query('UPDATE user_cookies SET cookies=?, label=?, enabled=1 WHERE id=?', [cookies, label, existing[0].id])
      res.json({ id: existing[0].id, domain, label, ...summarize(cookies), enabled: true })
    } else {
      const id = uuidv4()
      await query('INSERT INTO user_cookies (id, user_id, domain, label, cookies) VALUES (?,?,?,?,?)', [id, userId, domain, label, cookies])
      res.json({ id, domain, label, ...summarize(cookies), enabled: true })
    }
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Enable / disable a saved cookie set without deleting it ────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const userId  = req.authUser!.id
    const enabled = req.body?.enabled ? 1 : 0
    await query('UPDATE user_cookies SET enabled=? WHERE id=? AND user_id=?', [enabled, req.params.id, userId])
    res.json({ success: true, enabled: !!enabled })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Delete a saved cookie set ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.authUser!.id
    await query('DELETE FROM user_cookies WHERE id=? AND user_id=?', [req.params.id, userId])
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

export default router
