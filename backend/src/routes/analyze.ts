import { Router } from 'express'
import axios from 'axios'

const router  = Router()
const PYTHON  = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'

router.post('/', async (req, res) => {
  const { url } = req.body as { url?: string }
  if (!url || typeof url !== 'string') { res.status(400).json({ error: 'url is required' }); return }
  try {
    const { data } = await axios.post(`${PYTHON}/analyze`, { url }, { timeout: 35_000 })
    res.json(data)
  } catch (e: any) {
    res.status(502).json({ error: e.response?.data?.detail ?? e.message })
  }
})

// Resolve actual playable stream URL for the video player
router.post('/stream-url', async (req, res) => {
  const { url } = req.body as { url?: string }
  if (!url || typeof url !== 'string') { res.status(400).json({ error: 'url is required' }); return }
  try {
    const { data } = await axios.post(`${PYTHON}/stream-url`, { url }, { timeout: 45_000 })
    res.json(data)
  } catch (e: any) {
    res.status(e.response?.status ?? 502).json({ error: e.response?.data?.detail ?? e.message })
  }
})

// Preview images from a page (for MediaPreviewGrid)
router.post('/preview-page', async (req, res) => {
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
router.post('/list-playlist', async (req, res) => {
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
