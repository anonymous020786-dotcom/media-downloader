import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { query } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

/**
 * Proxy / VPN manager.
 * --------------------------------------------------------------------------
 * The download pipeline already accepts a `proxy` URL on every job. This router
 * lets a user manage a pool of proxy / VPN exit endpoints: built-in presets
 * (from the PROXY_POOL env var), their own saved proxies (DB), live testing
 * (exit IP + country via the python-service), and rotation (`pick`).
 *
 * Supported schemes: http(s)://  socks4://  socks5://  socks5h://
 * (optionally with user:pass@). These are forwarded verbatim to yt-dlp,
 * aria2, ffmpeg, gallery-dl, httpx and Playwright.
 */

const router = Router()
const PYTHON = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'

router.use(requireAuth)

const SCHEME_RE = /^(https?|socks4|socks5h?):\/\//i

/** Hide credentials when echoing a proxy URL back to the client. */
function maskUrl(url: string): string {
  return url.replace(/\/\/([^:/@]+):([^@]+)@/, '//$1:****@')
}

/**
 * Built-in presets, configured via env:
 *   PROXY_POOL="Germany|http://user:pass@de.example:8080;US East|socks5://us.example:1080"
 * Each entry is "Label|url", entries separated by ";".
 */
function loadPresets(): { id: string; label: string; url: string; preset: true }[] {
  const raw = (process.env.PROXY_POOL ?? '').trim()
  if (!raw) return []
  return raw.split(';').map((chunk) => chunk.trim()).filter(Boolean).map((chunk, i) => {
    const sep = chunk.indexOf('|')
    const label = sep > -1 ? chunk.slice(0, sep).trim() : `Preset ${i + 1}`
    const url = (sep > -1 ? chunk.slice(sep + 1) : chunk).trim()
    return { id: `preset:${i}`, label, url, preset: true as const }
  }).filter((p) => SCHEME_RE.test(p.url))
}

/** Resolve a proxy reference (preset id, saved id, or raw URL) to a real URL. */
export async function resolveProxy(ref: string | undefined, userId: string): Promise<string | undefined> {
  if (!ref) return undefined
  const v = ref.trim()
  if (!v || v === 'none' || v === 'direct') return undefined
  if (SCHEME_RE.test(v)) return v                              // already a raw URL
  if (v === 'auto' || v === 'rotate') {                        // rotation
    const url = await pickProxy(userId)
    return url
  }
  if (v.startsWith('preset:')) {
    return loadPresets().find((p) => p.id === v)?.url
  }
  // otherwise treat as a saved-proxy id
  const rows = await query<{ url: string }>('SELECT url FROM user_proxies WHERE id=? AND user_id=?', [v, userId])
  return rows[0]?.url
}

/** Pick a proxy for rotation: prefer the user's default, else a known-good one, else any preset. */
async function pickProxy(userId: string): Promise<string | undefined> {
  const saved = await query<{ url: string; is_default: number; last_ok: number | null }>(
    'SELECT url, is_default, last_ok FROM user_proxies WHERE user_id=?', [userId])
  const def = saved.find((s) => s.is_default)
  if (def) return def.url
  const good = saved.filter((s) => s.last_ok === 1)
  const pool = good.length ? good : saved
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)].url
  const presets = loadPresets()
  if (presets.length) return presets[Math.floor(Math.random() * presets.length)].url
  return undefined
}

// ── List everything available to this user ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const userId = req.authUser!.id
    const saved = await query(
      `SELECT id, label, country, last_ok, last_ip, last_tested, is_default
         FROM user_proxies WHERE user_id=? ORDER BY is_default DESC, created_at DESC`, [userId])
    const presets = loadPresets().map((p) => ({ id: p.id, label: p.label, url: maskUrl(p.url), preset: true }))
    res.json({ presets, saved })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Test a proxy (raw URL, preset id, or saved id) ────────────────────────────
router.post('/test', async (req, res) => {
  try {
    const userId = req.authUser!.id
    const ref = (req.body?.proxy ?? '').toString()
    const url = await resolveProxy(ref, userId)
    if (!url) { res.status(400).json({ ok: false, error: 'Unknown or empty proxy' }); return }

    const { data } = await axios.post(`${PYTHON}/proxy/test`, { proxy: url }, { timeout: 60_000 })

    // Persist the result if it maps to a saved proxy.
    if (!ref.startsWith('preset:') && !SCHEME_RE.test(ref)) {
      await query(
        'UPDATE user_proxies SET last_ok=?, last_ip=?, country=?, last_tested=NOW() WHERE id=? AND user_id=?',
        [data.ok ? 1 : 0, data.ip ?? null, data.country ?? null, ref, userId]
      ).catch(() => {})
    }
    res.json(data)
  } catch (e: any) {
    res.status(502).json({ ok: false, error: e.response?.data?.error ?? e.message })
  }
})

// ── Save a custom proxy ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const userId = req.authUser!.id
    const label = (req.body?.label ?? '').toString().trim().slice(0, 120) || 'My proxy'
    const url   = (req.body?.url ?? '').toString().trim()
    if (!SCHEME_RE.test(url)) {
      res.status(400).json({ error: 'url must start with http://, https://, socks4:// or socks5://' }); return
    }
    const id = uuidv4()
    await query('INSERT INTO user_proxies (id, user_id, label, url) VALUES (?,?,?,?)', [id, userId, label, url])
    res.json({ id, label, url: maskUrl(url) })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Set / clear the default (rotation) proxy ──────────────────────────────────
router.patch('/:id/default', async (req, res) => {
  try {
    const userId = req.authUser!.id
    await query('UPDATE user_proxies SET is_default=0 WHERE user_id=?', [userId])
    await query('UPDATE user_proxies SET is_default=1 WHERE id=? AND user_id=?', [req.params.id, userId])
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Delete a saved proxy ──────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.authUser!.id
    await query('DELETE FROM user_proxies WHERE id=? AND user_id=?', [req.params.id, userId])
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

export default router
