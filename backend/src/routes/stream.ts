import { Router } from 'express'
import axios from 'axios'
import { randomUUID } from 'crypto'
import { requireAuth } from '../middleware/requireAuth.js'
import { verifyTurnstile } from '../middleware/verifyTurnstile.js'
import { resolveProxy } from './proxy.js'
import { resolveCookies } from './cookies.js'

/**
 * Streaming pass-through: resolve a URL and pipe the media straight from the
 * source (or an on-the-fly ffmpeg remux) to the client. NOTHING is written to
 * the staging directory — no job, no queue, no cleanup. Works for a single
 * progressive file, a direct file/image, an HLS/DASH stream that needs muxing.
 * Playlists/torrents are rejected (use /api/download for those).
 */
const router = Router()
const PYTHON = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'

interface Pending { url: string; format?: string; quality?: string; cookies?: string; proxy?: string; at: number }
const tokens = new Map<string, Pending>()
const TTL_MS = 60 * 60 * 1000
function sweep() { const c = Date.now() - TTL_MS; for (const [k, v] of tokens) if (v.at < c) tokens.delete(k) }

router.use(requireAuth)

// ── Create a stream link ─────────────────────────────────────────────────────
router.post('/', verifyTurnstile, async (req, res) => {
  const body = req.body as { url?: string; format?: string; quality?: string; cookies?: string; proxy?: string }
  if (!body.url) { res.status(400).json({ error: 'url is required' }); return }
  sweep()
  const userId = req.authUser!.id
  const cookies = body.cookies?.trim() || await resolveCookies(body.url, userId)
  const proxy = await resolveProxy(body.proxy, userId)

  // Validate up front so a caller (the bot) can fall back to the download queue
  // *before* it hands the user a link that would fail on tap. The GET re-resolves
  // fresh — this is just a gate, we don't keep the (expiring) resolved URLs.
  try {
    const { data } = await axios.post(`${PYTHON}/stream-resolve`, {
      url: body.url, format: body.format, quality: body.quality, cookies, proxy,
    }, { timeout: 45_000 })
    if (data.mode === 'unsupported') { res.status(422).json({ error: data.reason }); return }
  } catch (e: any) {
    res.status(422).json({ error: e.response?.data?.detail ?? `not streamable: ${e.message}` }); return
  }

  const token = randomUUID()
  tokens.set(token, { url: body.url, format: body.format, quality: body.quality, cookies, proxy, at: Date.now() })
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '') ||
    `${req.protocol}://${req.get('host')}`
  res.json({ token, url: `${base}/api/stream/${token}` })
})

// A stream link is opened by a browser/downloader — errors should be readable,
// not raw JSON.
function fail(res: import('express').Response, code: number, msg: string) {
  res.status(code).type('html').send(
    `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width">` +
    `<title>Stream unavailable</title>` +
    `<body style="font:16px/1.5 system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#0d1117;color:#c9d1d9">` +
    `<div style="max-width:420px;padding:24px;text-align:center">` +
    `<div style="font-size:32px">⚠️</div><p>${msg.replace(/</g, '&lt;')}</p>` +
    `<p style="color:#8b949e;font-size:14px">Analyze the link again to get a fresh one.</p></div>`,
  )
}

// ── Serve the stream ─────────────────────────────────────────────────────────
router.get('/:token', async (req, res) => {
  const p = tokens.get(req.params.token)
  if (!p) { fail(res, 404, 'This stream link expired.'); return }

  let plan: any
  try {
    plan = (await axios.post(`${PYTHON}/stream-resolve`, {
      url: p.url, format: p.format, quality: p.quality, cookies: p.cookies, proxy: p.proxy,
    }, { timeout: 60_000 })).data
  } catch (e: any) {
    fail(res, 502, `Couldn't resolve this media: ${e.response?.data?.detail ?? e.message}`); return
  }

  if (plan.mode === 'unsupported') { fail(res, 422, plan.reason); return }

  // ── Direct pass-through of a single URL, with range support ──────────────
  if (plan.mode === 'proxy') {
    const range = req.headers.range
    let upstream
    try {
      upstream = await axios.get(plan.url, {
        responseType: 'stream',
        timeout: 0,
        maxRedirects: 5,
        headers: { ...(plan.headers ?? {}), ...(range ? { Range: range } : {}), 'Accept-Encoding': 'identity' },
        validateStatus: () => true,
      })
    } catch (e: any) {
      fail(res, 502, `source fetch failed: ${e.message}`); return
    }
    if (upstream.status >= 400) { res.status(upstream.status).end(); upstream.data.destroy(); return }

    res.status(upstream.status)
    for (const h of ['content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
      if (upstream.headers[h]) res.setHeader(h, upstream.headers[h])
    }
    res.setHeader('Content-Type', plan.mime || upstream.headers['content-type'] || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(plan.filename || 'download')}`)
    res.setHeader('Cache-Control', 'no-store')
    upstream.data.pipe(res)
    const stop = () => upstream.data.destroy()
    req.on('close', stop); res.on('close', stop)
    upstream.data.on('error', () => { try { res.destroy() } catch { /* */ } })
    return
  }

  // ── ffmpeg remux, streamed from the python service ──────────────────────
  if (plan.mode === 'mux') {
    let muxed
    try {
      muxed = await axios.get(`${PYTHON}/stream-mux/${plan.mux_id}`, { responseType: 'stream', timeout: 0 })
    } catch (e: any) {
      fail(res, 502, `mux failed: ${e.message}`); return
    }
    res.status(200)
    res.setHeader('Content-Type', String(muxed.headers['content-type'] || 'video/mp4'))
    if (muxed.headers['content-disposition']) res.setHeader('Content-Disposition', String(muxed.headers['content-disposition']))
    res.setHeader('Cache-Control', 'no-store')
    muxed.data.pipe(res)
    const stop = () => muxed.data.destroy()
    req.on('close', stop); res.on('close', stop)
    muxed.data.on('error', () => { try { res.destroy() } catch { /* */ } })
    return
  }

  fail(res, 500, 'unknown stream mode')
})

export default router
