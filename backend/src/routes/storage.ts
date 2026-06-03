import { Router } from 'express'
import axios from 'axios'

const router  = Router()
const PYTHON  = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

router.get('/', async (_req, res) => {
  try {
    const { data } = await axios.get(`${PYTHON}/storage`, { timeout: 10_000 })
    res.json(data)
  } catch (e: any) { res.status(502).json({ error: e.message }) }
})

router.delete('/:jobId', async (req, res) => {
  const { jobId } = req.params
  if (!UUID_RE.test(jobId)) { res.status(400).json({ error: 'Invalid job ID' }); return }
  try {
    await axios.delete(`${PYTHON}/storage/${jobId}`, { timeout: 10_000 })
    res.json({ success: true })
  } catch (e: any) { res.status(502).json({ error: e.message }) }
})

export default router
