import { Router } from 'express'
import axios from 'axios'
import https from 'node:https'

// Secure server-side proxy for The Movie Database (TMDB) v3 API.
// The API key / access token never reaches the browser. The generic GET passthrough
// at the bottom means the UI can call ANY TMDB read endpoint (search, discover,
// trending, movie/tv/person/collection/company/keyword/network/find/genre/
// watch-providers/configuration/certifications/reviews/credits/images/videos…).
const router = Router()
const BASE = 'https://api.themoviedb.org/3'
const V4_TOKEN = process.env.TMDB_ACCESS_TOKEN ?? ''   // v4 "Read Access Token" (preferred)
const V3_KEY   = process.env.TMDB_API_KEY ?? ''        // v3 api key (fallback)
const configured = !!(V4_TOKEN || V3_KEY)

// Keep-alive agent forced to IPv4. The intermittent "Client network socket
// disconnected before secure TLS connection was established" comes from (a) opening
// a fresh TLS handshake per request and (b) the container occasionally getting an
// unreachable IPv6 address for api.themoviedb.org. Pooling connections + family:4
// (IPv4 only) eliminates the resets at the source.
const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 15_000,
  maxSockets: 64,
  family: 4,
  timeout: 20_000,
})

const tmdb = axios.create({
  baseURL: BASE,
  timeout: 20_000,
  httpsAgent: agent,
  headers: V4_TOKEN ? { Authorization: `Bearer ${V4_TOKEN}` } : {},
})

// Cache (TMDB data is highly cacheable). 30-min fresh window; stale entries kept
// as a fallback so a rate-limit/network blip still serves data instead of erroring.
const cache = new Map<string, { at: number; data: any }>()
const TTL = 30 * 60_000

// ── Rate-limit protection ─────────────────────────────────────────────────────
// 1) Global throttle: min gap between outbound calls (~28/sec, well under TMDB's
//    ~50/sec) so bursts (Load-more, Explorer) can never trip a block.
// 2) In-flight coalescing: identical concurrent requests share one upstream call.
const MIN_GAP_MS = 35
let _nextSlot = 0
const _inflight = new Map<string, Promise<any>>()
async function _throttle() {
  const now = Date.now()
  const slot = Math.max(now, _nextSlot)
  _nextSlot = slot + MIN_GAP_MS
  const wait = slot - now
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}
async function _fetch(tmdbPath: string, params: any, key: string): Promise<any> {
  const existing = _inflight.get(key)
  if (existing) return existing
  const p = (async () => {
    let lastErr: any
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await _throttle()
        const { data } = await tmdb.get(tmdbPath, { params })
        cache.set(key, { at: Date.now(), data })
        if (cache.size > 5000) {
          // evict oldest ~1000 entries
          const keys = [...cache.keys()].slice(0, 1000)
          keys.forEach((k) => cache.delete(k))
        }
        return data
      } catch (e: any) {
        lastErr = e
        if (e.response && e.response.status !== 429) break  // real error (but retry 429)
        await new Promise((r) => setTimeout(r, e.response?.status === 429 ? 1500 : 300 * (attempt + 1)))
      }
    }
    throw lastErr
  })()
  _inflight.set(key, p)
  try { return await p } finally { _inflight.delete(key) }
}

async function pass(req: any, res: any, tmdbPath: string) {
  if (!configured) {
    res.status(503).json({ error: 'TMDB not configured. Set TMDB_ACCESS_TOKEN (v4) or TMDB_API_KEY (v3).' })
    return
  }
  const params: Record<string, any> = { ...req.query }
  if (!V4_TOKEN) params.api_key = V3_KEY
  const key = `${tmdbPath}?${new URLSearchParams(params as any).toString()}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) { res.json(hit.data); return }
  try {
    res.json(await _fetch(tmdbPath, params, key))
  } catch (e: any) {
    // Serve stale cache if we have it — better than a hard error on a rate blip.
    if (hit) { res.json(hit.data); return }
    const status = e?.response?.status ?? 502
    res.status(status).json({ error: e?.response?.data?.status_message ?? e?.message ?? 'TMDB request failed' })
  }
}

// ── Account / auth (v3 user session) ──────────────────────────────────────────
// Account read+write endpoints need the v3 api key + a per-user session_id
// (the v4 read token is app-level and can't see a user's watchlist/ratings).
const needV3 = (res: any) => { if (!V3_KEY) { res.status(503).json({ error: 'Account features need TMDB_API_KEY (v3).' }); return false } return true }
async function v3(method: string, path: string, opts: { params?: any; data?: any } = {}) {
  const params = { api_key: V3_KEY, ...(opts.params ?? {}) }
  let lastErr: any
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await tmdb.request({ method, url: path, params, data: opts.data,
        headers: { 'Content-Type': 'application/json' } })
      return data
    } catch (e: any) {
      lastErr = e
      if (e.response) throw e        // real HTTP error — don't retry
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
    }
  }
  throw lastErr
}
const fail = (res: any, e: any) =>
  res.status(e.response?.status ?? 502).json({ error: e.response?.data?.status_message ?? e.message })

// Step 1 — mint a request token + the URL the user approves on TMDB.
router.get('/auth/request-token', async (req, res) => {
  if (!needV3(res)) return
  try {
    const d = await v3('get', '/authentication/token/new')
    const redirect = String(req.query.redirect_to ?? '')
    res.json({ request_token: d.request_token,
      approve_url: `https://www.themoviedb.org/authenticate/${d.request_token}${redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ''}` })
  } catch (e) { fail(res, e) }
})
// Step 2 — exchange an approved request token for a session.
router.post('/auth/session', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('post', '/authentication/session/new', { data: { request_token: req.body.request_token } })) }
  catch (e) { fail(res, e) }
})
router.delete('/auth/session', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('delete', '/authentication/session', { data: { session_id: req.body.session_id } })) }
  catch (e) { fail(res, e) }
})
router.get('/auth/guest', async (_req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('get', '/authentication/guest_session/new')) } catch (e) { fail(res, e) }
})

// Account details (id, username, avatar).
router.get('/me', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('get', '/account', { params: { session_id: req.query.session_id } })) } catch (e) { fail(res, e) }
})
// Lists of favorite / watchlist / rated, per media type.
router.get('/me/:listType/:media', async (req, res) => {
  if (!needV3(res)) return
  const { listType, media } = req.params  // favorite|watchlist|rated × movies|tv
  try {
    res.json(await v3('get', `/account/${req.query.account_id}/${listType}/${media}`,
      { params: { session_id: req.query.session_id, sort_by: req.query.sort_by, page: req.query.page } }))
  } catch (e) { fail(res, e) }
})
router.get('/me/lists', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('get', `/account/${req.query.account_id}/lists`, { params: { session_id: req.query.session_id, page: req.query.page } })) } catch (e) { fail(res, e) }
})
// Whether the signed-in user has favorited/watchlisted/rated a title.
router.get('/states/:media/:id', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('get', `/${req.params.media}/${req.params.id}/account_states`, { params: { session_id: req.query.session_id } })) } catch (e) { fail(res, e) }
})
// Mark favorite / add to watchlist.
router.post('/me/favorite', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('post', `/account/${req.query.account_id}/favorite`, { params: { session_id: req.query.session_id }, data: req.body })) } catch (e) { fail(res, e) }
})
router.post('/me/watchlist', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('post', `/account/${req.query.account_id}/watchlist`, { params: { session_id: req.query.session_id }, data: req.body })) } catch (e) { fail(res, e) }
})
// Rate / un-rate a title.
router.post('/rate/:media/:id', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('post', `/${req.params.media}/${req.params.id}/rating`, { params: { session_id: req.query.session_id }, data: { value: req.body.value } })) } catch (e) { fail(res, e) }
})
router.delete('/rate/:media/:id', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('delete', `/${req.params.media}/${req.params.id}/rating`, { params: { session_id: req.query.session_id } })) } catch (e) { fail(res, e) }
})
// Custom lists CRUD.
router.post('/lists', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('post', '/list', { params: { session_id: req.query.session_id }, data: req.body })) } catch (e) { fail(res, e) }
})
router.get('/lists/:id', (req, res) => pass(req, res, `/list/${req.params.id}`))
router.post('/lists/:id/add', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('post', `/list/${req.params.id}/add_item`, { params: { session_id: req.query.session_id }, data: req.body })) } catch (e) { fail(res, e) }
})
router.post('/lists/:id/remove', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('post', `/list/${req.params.id}/remove_item`, { params: { session_id: req.query.session_id }, data: req.body })) } catch (e) { fail(res, e) }
})
router.post('/lists/:id/clear', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('post', `/list/${req.params.id}/clear`, { params: { session_id: req.query.session_id, confirm: 'true' } })) } catch (e) { fail(res, e) }
})
router.delete('/lists/:id', async (req, res) => {
  if (!needV3(res)) return
  try { res.json(await v3('delete', `/list/${req.params.id}`, { params: { session_id: req.query.session_id } })) } catch (e) { fail(res, e) }
})

// Is the integration live? (UI uses this to show a setup hint instead of errors.)
router.get('/status', (_req, res) => res.json({ configured, mode: V4_TOKEN ? 'v4' : V3_KEY ? 'v3' : 'none', account: !!V3_KEY }))

// Convenience endpoints with sensible append_to_response for rich detail pages.
router.get('/movie/:id', (req, res) => pass(req, res, `/movie/${req.params.id}`))
router.get('/tv/:id',    (req, res) => pass(req, res, `/tv/${req.params.id}`))
router.get('/person/:id',(req, res) => pass(req, res, `/person/${req.params.id}`))

// Generic GET passthrough — ANY remaining TMDB read endpoint.
// e.g. /api/tmdb/search/multi, /api/tmdb/trending/all/week, /api/tmdb/discover/movie,
//      /api/tmdb/genre/movie/list, /api/tmdb/configuration, /api/tmdb/find/tt0111161 …
router.get(/^\/(.+)/, (req, res) => pass(req, res, '/' + req.params[0]))

export default router
