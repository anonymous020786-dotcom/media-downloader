import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { requireAuth } from '../middleware/requireAuth.js'

/**
 * Proxy / VPN manager (local build — saved proxies live in memory).
 * --------------------------------------------------------------------------
 * The download pipeline already accepts a `proxy` URL on every job. This router
 * lets a user manage a pool of proxy / VPN exit endpoints: built-in presets
 * (from the PROXY_POOL env var), their own saved proxies (in-memory), live
 * testing (exit IP + country via the python-service), and rotation.
 *
 * Supported schemes: http(s)://  socks4://  socks5://  socks5h://
 */

const router = Router()
const PYTHON = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'

router.use(requireAuth)

const SCHEME_RE = /^(https?|socks4|socks5h?):\/\//i

interface SavedProxy {
  id: string
  user_id: string
  label: string
  url: string
  country: string | null
  last_ok: 0 | 1 | null
  last_ip: string | null
  last_tested: string | null
  is_default: 0 | 1
  created_at: string
}

// user id → their saved proxies. Resets on backend restart.
const store = new Map<string, SavedProxy[]>()
const listFor = (userId: string) => store.get(userId) ?? (store.set(userId, []), store.get(userId)!)

/** Hide credentials when echoing a proxy URL back to the client. */
function maskUrl(url: string): string {
  return url.replace(/\/\/([^:/@]+):([^@]+)@/, '//$1:****@')
}

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
  if (SCHEME_RE.test(v)) return v
  if (v === 'auto' || v === 'rotate') return pickProxy(userId)
  if (v.startsWith('preset:')) return loadPresets().find((p) => p.id === v)?.url
  return listFor(userId).find((p) => p.id === v)?.url
}

function pickProxy(userId: string): string | undefined {
  const saved = listFor(userId)
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
router.get('/', (req, res) => {
  const userId = req.authUser!.id
  const saved = listFor(userId).map(({ url, user_id, ...rest }) => rest)
  const presets = loadPresets().map((p) => ({ id: p.id, label: p.label, url: maskUrl(p.url), preset: true }))
  res.json({ presets, saved })
})

// ── Test a proxy (raw URL, preset id, or saved id) ────────────────────────────
router.post('/test', async (req, res) => {
  try {
    const userId = req.authUser!.id
    const ref = (req.body?.proxy ?? '').toString()
    const url = await resolveProxy(ref, userId)
    if (!url) { res.status(400).json({ ok: false, error: 'Unknown or empty proxy' }); return }

    const { data } = await axios.post(`${PYTHON}/proxy/test`, { proxy: url }, { timeout: 60_000 })

    if (!ref.startsWith('preset:') && !SCHEME_RE.test(ref)) {
      const row = listFor(userId).find((p) => p.id === ref)
      if (row) {
        row.last_ok = data.ok ? 1 : 0
        row.last_ip = data.ip ?? null
        row.country = data.country ?? null
        row.last_tested = new Date().toISOString()
      }
    }
    res.json(data)
  } catch (e: any) {
    res.status(502).json({ ok: false, error: e.response?.data?.error ?? e.message })
  }
})

// ── Save a custom proxy ───────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const userId = req.authUser!.id
  const label = (req.body?.label ?? '').toString().trim().slice(0, 120) || 'My proxy'
  const url   = (req.body?.url ?? '').toString().trim()
  if (!SCHEME_RE.test(url)) {
    res.status(400).json({ error: 'url must start with http://, https://, socks4:// or socks5://' }); return
  }
  const id = uuidv4()
  listFor(userId).push({
    id, user_id: userId, label, url,
    country: null, last_ok: null, last_ip: null, last_tested: null,
    is_default: 0, created_at: new Date().toISOString(),
  })
  res.json({ id, label, url: maskUrl(url) })
})

// ── Set / clear the default (rotation) proxy ──────────────────────────────────
router.patch('/:id/default', (req, res) => {
  const userId = req.authUser!.id
  const saved = listFor(userId)
  saved.forEach((p) => { p.is_default = p.id === req.params.id ? 1 : 0 })
  res.json({ success: true })
})

// ── Delete a saved proxy ──────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const userId = req.authUser!.id
  store.set(userId, listFor(userId).filter((p) => p.id !== req.params.id))
  res.json({ success: true })
})

export default router
