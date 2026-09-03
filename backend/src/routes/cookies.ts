import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { requireAuth } from '../middleware/requireAuth.js'

/**
 * Per-site cookie store (local build — saved cookies live in memory).
 * --------------------------------------------------------------------------
 * The download pipeline already accepts a `cookies` string on every job. This
 * router lets a user SAVE those cookies once per domain so login-walled content
 * keeps downloading without re-pasting. download.ts calls resolveCookies(url,
 * userId) to auto-attach the matching domain's cookies when the request itself
 * didn't supply any. Resets on backend restart.
 */

const router = Router()
router.use(requireAuth)

interface CookieRow {
  id: string
  domain: string
  label: string | null
  cookies: string
  enabled: boolean
  updated_at: string
}

const store = new Map<string, CookieRow[]>()
const listFor = (userId: string) => store.get(userId) ?? (store.set(userId, []), store.get(userId)!)

/** Normalise a user-entered domain or URL down to a bare hostname. */
export function normalizeDomain(input: string): string {
  let s = (input ?? '').trim().toLowerCase()
  if (!s) return ''
  s = s.replace(/^[a-z]+:\/\//, '')
  s = s.split('/')[0]
  s = s.split('@').pop() as string
  s = s.split(':')[0]
  s = s.replace(/^www\./, '')
  return s.slice(0, 190)
}

/** Find saved cookies for the given URL's host (most specific match wins). */
export async function resolveCookies(url: string | undefined, userId: string): Promise<string | undefined> {
  if (!url) return undefined
  let host = ''
  try { host = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase() }
  catch { return undefined }
  if (!host) return undefined
  const bare = host.replace(/^www\./, '')

  let best: CookieRow | undefined
  for (const r of listFor(userId)) {
    if (!r.enabled) continue
    const d = r.domain.toLowerCase()
    if (bare === d || bare.endsWith(`.${d}`)) {
      if (!best || d.length > best.domain.length) best = r
    }
  }
  return best?.cookies
}

function summarize(cookies: string): { count: number; preview: string } {
  const text = (cookies ?? '').trim()
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  const count = lines.length > 1
    ? lines.length
    : text.split(';').filter((p) => p.includes('=')).length
  return { count: Math.max(count, text ? 1 : 0), preview: text.slice(0, 24) + (text.length > 24 ? '…' : '') }
}

router.get('/', (req, res) => {
  const userId = req.authUser!.id
  res.json(listFor(userId).map((r) => ({
    id: r.id, domain: r.domain, label: r.label, enabled: r.enabled,
    updated_at: r.updated_at, ...summarize(r.cookies),
  })))
})

router.post('/', (req, res) => {
  const userId  = req.authUser!.id
  const domain  = normalizeDomain((req.body?.domain ?? '').toString())
  const cookies = (req.body?.cookies ?? '').toString().trim()
  const label   = (req.body?.label ?? '').toString().trim().slice(0, 120) || null
  if (!domain)  { res.status(400).json({ error: 'domain is required (e.g. example.com)' }); return }
  if (!cookies) { res.status(400).json({ error: 'cookies text is required' }); return }
  if (cookies.length > 1_000_000) { res.status(400).json({ error: 'cookies text too large' }); return }

  const rows = listFor(userId)
  const existing = rows.find((r) => r.domain === domain)
  if (existing) {
    existing.cookies = cookies
    existing.label = label
    existing.enabled = true
    existing.updated_at = new Date().toISOString()
    res.json({ id: existing.id, domain, label, ...summarize(cookies), enabled: true })
  } else {
    const id = uuidv4()
    rows.push({ id, domain, label, cookies, enabled: true, updated_at: new Date().toISOString() })
    res.json({ id, domain, label, ...summarize(cookies), enabled: true })
  }
})

router.patch('/:id', (req, res) => {
  const userId  = req.authUser!.id
  const enabled = !!req.body?.enabled
  const row = listFor(userId).find((r) => r.id === req.params.id)
  if (row) row.enabled = enabled
  res.json({ success: true, enabled })
})

router.delete('/:id', (req, res) => {
  const userId = req.authUser!.id
  store.set(userId, listFor(userId).filter((r) => r.id !== req.params.id))
  res.json({ success: true })
})

export default router
