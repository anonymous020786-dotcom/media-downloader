import { Router } from 'express'
import crypto from 'crypto'
import axios from 'axios'

/**
 * Media stream proxy.
 * --------------------------------------------------------------------------
 * Many sites (adult CDNs, OTT, geo/referer-locked hosts) reject direct browser
 * playback: the CDN requires a specific Referer / Origin the browser can't send,
 * so <video src> gets a 403. This endpoint fetches the stream server-side with
 * the correct headers and pipes it to the browser (with HTTP Range support so
 * seeking works).
 *
 * To avoid being an open proxy (SSRF / bandwidth abuse), every proxied URL must
 * be SIGNED by the backend (HMAC). Only URLs the backend itself issued — via
 * makeStreamUrl() — are honoured.
 */

const router = Router()
const SECRET = process.env.STREAM_SECRET ?? process.env.SUPABASE_JWT_SECRET ?? 'mediadl-stream'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
}

/** Build a signed, backend-relative proxy URL for a remote media stream. */
export function makeStreamUrl(url: string, referer?: string): string {
  const u = Buffer.from(url, 'utf8').toString('base64url')
  const r = referer ? Buffer.from(referer, 'utf8').toString('base64url') : ''
  const sig = sign(`${u}.${r}`)
  return `/api/stream?u=${u}&r=${r}&sig=${sig}`
}

router.get('/', async (req, res) => {
  const u   = (req.query.u   as string) ?? ''
  const r   = (req.query.r   as string) ?? ''
  const sig = (req.query.sig as string) ?? ''
  if (!u || !sig) { res.status(400).json({ error: 'Missing parameters' }); return }

  // Verify HMAC — reject anything we didn't sign.
  const expected = sign(`${u}.${r}`)
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    res.status(403).json({ error: 'Invalid signature' }); return
  }

  let url: string, referer = ''
  try { url = Buffer.from(u, 'base64url').toString('utf8') } catch { res.status(400).end(); return }
  if (r) { try { referer = Buffer.from(r, 'base64url').toString('utf8') } catch {} }
  if (!/^https?:\/\//i.test(url)) { res.status(400).json({ error: 'Bad URL' }); return }

  const headers: Record<string, string> = { 'User-Agent': UA, 'Accept': '*/*' }
  if (referer) {
    headers['Referer'] = referer
    try { headers['Origin'] = new URL(referer).origin } catch { /* ignore */ }
  }
  if (req.headers.range) headers['Range'] = req.headers.range as string

  try {
    const upstream = await axios.get(url, {
      headers, responseType: 'stream', timeout: 30_000,
      maxRedirects: 5, validateStatus: () => true, decompress: false,
    })
    res.status(upstream.status === 200 && headers['Range'] ? 206 : upstream.status)
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'expires', 'last-modified', 'etag']) {
      const v = upstream.headers[h]
      if (v) res.setHeader(h, v as string)
    }
    if (!upstream.headers['accept-ranges']) res.setHeader('Accept-Ranges', 'bytes')
    upstream.data.on('error', () => { try { res.destroy() } catch {} })
    upstream.data.pipe(res)
  } catch (e: any) {
    if (!res.headersSent) res.status(502).json({ error: e.message })
  }
})

export default router
