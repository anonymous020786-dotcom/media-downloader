import { Router } from 'express'
import axios from 'axios'
import { requireAuth } from '../middleware/requireAuth.js'

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

export default router
