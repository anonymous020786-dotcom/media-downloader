import { Router } from 'express'
import axios from 'axios'
import { requireAuth } from '../middleware/requireAuth.js'
import { makeStreamUrl } from './stream.js'

const router  = Router()
const PYTHON  = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'

router.post('/', requireAuth, async (req, res) => {
  const { url } = req.body as { url?: string }
  if (!url || typeof url !== 'string') { res.status(400).json({ error: 'url is required' }); return }
  try {
    const { data } = await axios.post(`${PYTHON}/analyze`, { url }, { timeout: 60_000 })
    res.json(data)
  } catch (e: any) {
    const status = e.response?.status
    const detail = e.response?.data?.detail ?? e.message
    // The analyzer returns 4xx for unsupported/invalid URLs — forward that as a
    // clear client error instead of a generic 502 "Bad Gateway".
    if (status && status >= 400 && status < 500) {
      res.status(status).json({ error: typeof detail === 'string' ? detail : 'This URL could not be processed' })
      return
    }
    res.status(502).json({ error: `Could not analyze this URL — it may be unsupported, private, or temporarily unavailable.` })
  }
})

// Resolve actual playable stream URL for the video player
router.post('/stream-url', requireAuth, async (req, res) => {
  const { url } = req.body as { url?: string }
  if (!url || typeof url !== 'string') { res.status(400).json({ error: 'url is required' }); return }
  try {
    const { data } = await axios.post(`${PYTHON}/stream-url`, { url }, { timeout: 60_000 })
    // For direct (non-HLS/DASH) streams, route playback through the referer-aware
    // proxy so CDN-locked sources (adult / OTT / referer-protected) play in the
    // browser instead of 403-ing. HLS/DASH manifests stay direct for hls.js.
    const proto = (data.protocol ?? '').toLowerCase()
    if (data.stream_url && proto !== 'hls' && proto !== 'dash' && !/\.(m3u8|mpd)(\?|$)/i.test(data.stream_url)) {
      data.proxy_url = makeStreamUrl(data.stream_url, url)
    }
    res.json(data)
  } catch (e: any) {
    res.status(e.response?.status ?? 502).json({ error: e.response?.data?.detail ?? e.message })
  }
})

// Preview images from a page (for MediaPreviewGrid)
router.post('/preview-page', requireAuth, async (req, res) => {
  const { url } = req.body as { url?: string }
  if (!url) { res.status(400).json({ error: 'url is required' }); return }
  try {
    const { data } = await axios.post(`${PYTHON}/preview-page`, { url }, { timeout: 60_000 })
    res.json(data)
  } catch (e: any) {
    res.status(502).json({ error: e.response?.data?.detail ?? e.message })
  }
})

// List playlist items (for MediaPreviewGrid)
router.post('/list-playlist', requireAuth, async (req, res) => {
  const { url } = req.body as { url?: string }
  if (!url) { res.status(400).json({ error: 'url is required' }); return }
  try {
    const { data } = await axios.post(`${PYTHON}/list-playlist`, { url }, { timeout: 90_000 })
    res.json(data)
  } catch (e: any) {
    res.status(502).json({ error: e.response?.data?.detail ?? e.message })
  }
})

// Web / file / image / video search via DuckDuckGo
router.post('/search', async (req, res) => {
  const { query } = req.body as { query?: string }
  if (!query) { res.status(400).json({ error: 'query is required' }); return }
  try {
    const { data } = await axios.post(`${PYTHON}/search`, req.body, { timeout: 35_000 })
    res.json(data)
  } catch (e: any) {
    res.status(502).json({ error: e.response?.data?.detail ?? e.message })
  }
})

// Social people / profile discovery across platforms
router.post('/social/search', async (req, res) => {
  const { query } = req.body as { query?: string }
  if (!query) { res.status(400).json({ error: 'query is required' }); return }
  try {
    const { data } = await axios.post(`${PYTHON}/social/search`, req.body, { timeout: 40_000 })
    res.json(data)
  } catch (e: any) {
    res.status(502).json({ error: e.response?.data?.detail ?? e.message })
  }
})

router.get('/social/platforms', async (_req, res) => {
  try {
    const { data } = await axios.get(`${PYTHON}/social/platforms`, { timeout: 10_000 })
    res.json(data)
  } catch (e: any) {
    res.status(502).json({ error: e.response?.data?.detail ?? e.message })
  }
})

export default router
