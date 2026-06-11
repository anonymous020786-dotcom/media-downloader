import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, Number(req.query.page  ?? 1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)))
    const offset = (page - 1) * limit
    const userId = req.header('X-User-Id') ?? null

    const whereClause = userId ? 'WHERE user_id = ?' : ''
    const params: any[] = userId ? [userId, limit, offset] : [limit, offset]

    const rows = await query<{
      id: number; job_id: string | null; user_id: string | null
      url: string; media_type: string; format: string; quality: string | null
      status: string; title: string | null; files: string | null
      created_at: string
    }>(
      `SELECT id, job_id, user_id, url, media_type, format, quality,
              status, title, files, created_at
       FROM download_stats ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      params
    )

    const countRows = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM download_stats ${whereClause}`,
      userId ? [userId] : []
    )
    const total = countRows[0]?.total ?? 0

    res.json({
      items: rows.map((r) => ({
        ...r,
        files: r.files ? JSON.parse(r.files) : [],
      })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
