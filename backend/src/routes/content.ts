import { Router } from 'express'
import axios from 'axios'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { query } from '../db.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { sendEmail, isEmailConfigured, tplNewMessage, tplReply, tplAutoReply } from '../services/email.js'

const router = Router()
const PYTHON = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'

// Every /admin/* route requires a cryptographically-verified Supabase admin session.
router.use('/admin', requireAdmin)

// ── Media uploads (for embedding images/files in blog posts) ──────────────────
export const UPLOAD_DIR = path.join(process.env.DOWNLOAD_DIR ?? '/downloads', 'uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })
const ALLOWED_UPLOAD = new Set([
  'image/jpeg','image/png','image/gif','image/webp','image/avif','image/svg+xml',
  'video/mp4','video/webm','audio/mpeg','audio/mp4',
  'application/pdf','text/plain','application/zip',
])
const upload = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, UPLOAD_DIR),
    filename: (_r, file, cb) => {
      const ext = path.extname(file.originalname).replace(/[^a-z0-9.]/gi, '').slice(0, 12) || ''
      cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`)
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_r, file, cb) =>
    ALLOWED_UPLOAD.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error(`Unsupported file type: ${file.mimetype}`)),
})

router.post('/admin/upload', upload.single('file'), (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return }
  res.json({
    url: `/api/uploads/${req.file.filename}`,
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype,
  })
})

// ── Download engines ──────────────────────────────────────────────────────────
router.get('/admin/engines', async (_req, res) => {
  try {
    const { data } = await axios.get(`${PYTHON}/engines`, { timeout: 15_000 })
    res.json(data)
  } catch (e: any) { res.status(502).json({ error: e.message }) }
})

let _sitesCache: { data: any; at: number } | null = null
router.get('/sites', async (_req, res) => {
  try {
    if (_sitesCache && Date.now() - _sitesCache.at < 3_600_000) return res.json(_sitesCache.data)
    const { data } = await axios.get(`${PYTHON}/engines/sites`, { timeout: 20_000 })
    _sitesCache = { data, at: Date.now() }
    res.json(data)
  } catch (e: any) { res.status(502).json({ error: e.message }) }
})

router.post('/admin/engines/update', async (_req, res) => {
  try {
    const { data } = await axios.post(`${PYTHON}/engines/update`, {}, { timeout: 620_000 })
    res.json(data)
  } catch (e: any) { res.status(502).json({ error: e.message }) }
})

// ── Blog ──────────────────────────────────────────────────────────────────────
router.get('/blog', async (req, res) => {
  try {
    const q        = String(req.query.q ?? '').trim()
    const category = String(req.query.category ?? '').trim()
    const tag      = String(req.query.tag ?? '').trim()
    const sort     = String(req.query.sort ?? 'newest')
    const page     = Math.max(1, parseInt(String(req.query.page ?? '1')) || 1)
    const limit    = Math.min(60, Math.max(1, parseInt(String(req.query.limit ?? '24')) || 24))
    const offset   = (page - 1) * limit

    const where: string[] = ['published=1']
    const params: any[] = []
    if (q)        { where.push('(title LIKE ? OR excerpt LIKE ? OR content LIKE ?)'); params.push(`%${q}%`,`%${q}%`,`%${q}%`) }
    if (category) { where.push('category = ?'); params.push(category) }
    if (tag)      { where.push('tags LIKE ?'); params.push(`%${tag}%`) }
    const whereSql = `WHERE ${where.join(' AND ')}`
    const orderSql = sort === 'oldest' ? 'published_at ASC'
                   : sort === 'az'     ? 'title ASC'
                   : sort === 'reads'  ? 'read_minutes DESC, published_at DESC'
                   :                      'published_at DESC'

    const [{ total }] = await query<any>(`SELECT COUNT(*) AS total FROM blog_posts ${whereSql}`, params)
    const posts = await query(
      `SELECT id,title,slug,excerpt,author,cover_image,tags,category,read_minutes,published_at
       FROM blog_posts ${whereSql} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}`,
      params
    )
    const cats = await query<any>(
      'SELECT category, COUNT(*) AS count FROM blog_posts WHERE published=1 GROUP BY category ORDER BY count DESC'
    )
    res.json({ posts, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), categories: cats })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

router.get('/blog/:slug', async (req, res) => {
  try {
    const [post] = await query('SELECT * FROM blog_posts WHERE slug=? AND published=1', [req.params.slug])
    if (!post) { res.status(404).json({ error: 'Not found' }); return }
    res.json(post)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── FAQ ───────────────────────────────────────────────────────────────────────
router.get('/faq', async (_req, res) => {
  try {
    const items = await query('SELECT * FROM faq_items ORDER BY category, sort_order, id')
    res.json(items)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Testimonials ──────────────────────────────────────────────────────────────
router.get('/testimonials', async (_req, res) => {
  try {
    const t = await query('SELECT * FROM testimonials ORDER BY id')
    res.json(t)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  try {
    const [totalRow] = await query<any>("SELECT value FROM site_settings WHERE key_name='total_downloads'")
    const [sitesRow] = await query<any>("SELECT value FROM site_settings WHERE key_name='total_sites'")
    const [dlRow]    = await query<any>('SELECT COUNT(*) AS cnt FROM download_stats')
    res.json({
      total_downloads: dlRow?.cnt ?? totalRow?.value ?? '50,000,000+',
      total_sites:     sitesRow?.value ?? '1000+',
    })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Site settings (public) ───────────────────────────────────────────────────
router.get('/settings', async (_req, res) => {
  try {
    const rows = await query<any>(
      "SELECT key_name, value FROM site_settings WHERE key_name IN ('site_name','site_tagline','support_email','twitter_url','github_url','discord_url','youtube_url')"
    )
    const settings: Record<string, string> = {}
    rows.forEach((r) => { settings[r.key_name] = r.value })
    res.json(settings)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Contact form ──────────────────────────────────────────────────────────────
router.post('/contact', async (req, res) => {
  const { name, email, subject, message } = req.body as Record<string, string>
  if (!name || !email || !message) {
    res.status(400).json({ error: 'name, email and message are required' }); return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Invalid email address' }); return
  }
  try {
    const result = await query<any>(
      'INSERT INTO contact_messages (name,email,subject,message) VALUES (?,?,?,?)',
      [name.slice(0,150), email.slice(0,200), (subject||'').slice(0,300), message.slice(0,5000)]
    )
    const msgId = (result as any).insertId

    // Notify admin
    const adminEmail = process.env.SMTP_ADMIN_TO || process.env.SMTP_USER
    if (adminEmail && isEmailConfigured()) {
      sendEmail({
        to:      adminEmail,
        subject: `[MediaDL] New message from ${name}${subject ? `: ${subject}` : ''}`,
        html:    tplNewMessage({ name, email, subject, message }),
      }).catch(() => {}) // fire-and-forget
    }

    // Auto-reply to sender
    if (isEmailConfigured()) {
      sendEmail({
        to:      email,
        subject: `We received your message — MediaDL Support`,
        html:    tplAutoReply({ name }),
        replyTo: process.env.SMTP_ADMIN_TO || process.env.SMTP_USER,
      }).catch(() => {})
    }

    res.json({ success: true, id: msgId, message: "Message sent. We'll reply within 24 hours." })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Per-user download history ─────────────────────────────────────────────────
router.get('/history', async (req, res) => {
  const userId = req.header('X-User-Id')
  if (!userId) { res.json([]); return }
  try {
    const rows = await query(
      'SELECT id, url, media_type, format, quality, status, created_at FROM download_stats WHERE user_id=? ORDER BY created_at DESC LIMIT 200',
      [userId]
    )
    res.json(rows)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

router.delete('/history', async (req, res) => {
  const userId = req.header('X-User-Id')
  if (!userId) { res.status(401).json({ error: 'Sign in required' }); return }
  try {
    await query('DELETE FROM download_stats WHERE user_id=?', [userId])
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

router.post('/track', async (req, res) => {
  const { url, media_type, format, quality, status } = req.body
  try {
    await query(
      'INSERT INTO download_stats (url,media_type,format,quality,status) VALUES (?,?,?,?,?)',
      [url?.slice(0,2000), media_type, format, quality, status || 'queued']
    )
    res.json({ success: true })
  } catch { res.json({ success: false }) }
})

// ── Admin: list messages (with unread count) ──────────────────────────────────
router.get('/admin/messages', async (req, res) => {
  try {
    const status = req.query.status as string | undefined
    const where  = status ? 'WHERE status = ?' : ''
    const params = status ? [status] : []
    const msgs   = await query(`SELECT * FROM contact_messages ${where} ORDER BY created_at DESC LIMIT 200`, params)
    const [{ unread }] = await query<any>("SELECT COUNT(*) AS unread FROM contact_messages WHERE status='unread'")
    res.json({ messages: msgs, unread: unread ?? 0 })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Admin: mark message read/unread ──────────────────────────────────────────
router.patch('/admin/messages/:id', async (req, res) => {
  const { status, admin_note } = req.body as { status?: string; admin_note?: string }
  try {
    const sets: string[] = []
    const vals: any[]    = []
    if (status) {
      sets.push('status=?')
      vals.push(status)
      if (status === 'read') { sets.push('read_at=COALESCE(read_at,NOW())'); }
    }
    if (admin_note !== undefined) { sets.push('admin_note=?'); vals.push(admin_note.slice(0,2000)) }
    if (sets.length === 0) { res.status(400).json({ error: 'Nothing to update' }); return }
    vals.push(req.params.id)
    await query(`UPDATE contact_messages SET ${sets.join(',')} WHERE id=?`, vals)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Admin: reply to message via email ────────────────────────────────────────
router.post('/admin/messages/:id/reply', async (req, res) => {
  const { replyText } = req.body as { replyText: string }
  if (!replyText?.trim()) { res.status(400).json({ error: 'replyText is required' }); return }
  if (!isEmailConfigured()) { res.status(503).json({ error: 'Email not configured. Add SMTP_USER + SMTP_PASS to .env' }); return }

  try {
    const [msg] = await query<any>('SELECT * FROM contact_messages WHERE id=?', [req.params.id])
    if (!msg) { res.status(404).json({ error: 'Message not found' }); return }

    const adminId = (req as any).adminUserId ?? 'admin'
    const result  = await sendEmail({
      to:      msg.email,
      subject: `Re: ${msg.subject || 'Your message to MediaDL Support'}`,
      html:    tplReply({ name: msg.name, originalMessage: msg.message, replyText }),
      replyTo: process.env.SMTP_ADMIN_TO || process.env.SMTP_USER,
    })

    if (!result.ok) { res.status(502).json({ error: result.error }); return }

    await query(
      'UPDATE contact_messages SET status=?, replied_at=NOW(), replied_by=? WHERE id=?',
      ['replied', adminId, req.params.id]
    )
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Admin: delete message ────────────────────────────────────────────────────
router.delete('/admin/messages/:id', async (req, res) => {
  try {
    await query('DELETE FROM contact_messages WHERE id=?', [req.params.id])
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Admin: email config status ───────────────────────────────────────────────
router.get('/admin/email-config', (_req, res) => {
  res.json({
    configured: isEmailConfigured(),
    provider:   process.env.SMTP_PROVIDER ?? 'custom',
    from:       process.env.SMTP_FROM || process.env.SMTP_USER || '',
    admin_to:   process.env.SMTP_ADMIN_TO || process.env.SMTP_USER || '',
    // never expose password
  })
})

// ── Admin: test email ────────────────────────────────────────────────────────
router.post('/admin/email-test', async (req, res) => {
  const { to } = req.body as { to?: string }
  const recipient = (to || process.env.SMTP_ADMIN_TO || process.env.SMTP_USER || '').trim()
  if (!recipient) { res.status(400).json({ error: 'No recipient. Pass { to: "email" } or set SMTP_ADMIN_TO' }); return }
  const result = await sendEmail({
    to:      recipient,
    subject: 'MediaDL — Email Test',
    html:    '<p style="font-family:sans-serif">✅ Email is working! Your MediaDL admin email notifications are configured correctly.</p>',
  })
  if (result.ok) res.json({ success: true })
  else res.status(502).json({ error: result.error })
})

// ── Admin: download stats ─────────────────────────────────────────────────────
router.get('/admin/downloads', async (_req, res) => {
  try {
    const [total]  = await query<any>('SELECT COUNT(*) AS cnt FROM download_stats')
    const [today]  = await query<any>('SELECT COUNT(*) AS cnt FROM download_stats WHERE DATE(created_at)=CURDATE()')
    const byType   = await query<any>('SELECT media_type, COUNT(*) AS cnt FROM download_stats GROUP BY media_type')
    const byFormat = await query<any>('SELECT format, COUNT(*) AS cnt FROM download_stats GROUP BY format ORDER BY cnt DESC LIMIT 10')
    const recent   = await query<any>('SELECT * FROM download_stats ORDER BY created_at DESC LIMIT 50')
    res.json({ total: total?.cnt, today: today?.cnt, by_type: byType, by_format: byFormat, recent })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Admin: analytics ─────────────────────────────────────────────────────────
router.get('/admin/analytics', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(String(req.query.days ?? '30')) || 30))

    const [dlTotal]    = await query<any>('SELECT COUNT(*) AS cnt FROM download_stats')
    const [dlToday]    = await query<any>('SELECT COUNT(*) AS cnt FROM download_stats WHERE DATE(created_at)=CURDATE()')
    const [dlWeek]     = await query<any>('SELECT COUNT(*) AS cnt FROM download_stats WHERE created_at >= NOW() - INTERVAL 7 DAY')
    const [dlMonth]    = await query<any>('SELECT COUNT(*) AS cnt FROM download_stats WHERE created_at >= NOW() - INTERVAL 30 DAY')
    const [dlSuccess]  = await query<any>("SELECT COUNT(*) AS cnt FROM download_stats WHERE status='completed'")
    const [dlFailed]   = await query<any>("SELECT COUNT(*) AS cnt FROM download_stats WHERE status='failed'")

    // Downloads per day (last N days)
    const dlByDay = await query<any>(`
      SELECT DATE(created_at) AS day, COUNT(*) AS cnt,
             SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS ok,
             SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS fail
      FROM download_stats
      WHERE created_at >= NOW() - INTERVAL ${days} DAY
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `)

    // Downloads per hour today
    const dlByHour = await query<any>(`
      SELECT HOUR(created_at) AS hour, COUNT(*) AS cnt
      FROM download_stats
      WHERE DATE(created_at)=CURDATE()
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC
    `)

    // Top domains
    const topDomains = await query<any>(`
      SELECT
        REGEXP_SUBSTR(url, '[a-z0-9\\.\\-]+\\.[a-z]{2,}', 1, 1, 'ic') AS domain,
        COUNT(*) AS cnt
      FROM download_stats
      WHERE url IS NOT NULL AND url != '' AND created_at >= NOW() - INTERVAL ${days} DAY
      GROUP BY domain
      ORDER BY cnt DESC
      LIMIT 10
    `)

    // Media type breakdown
    const byType = await query<any>('SELECT media_type, COUNT(*) AS cnt FROM download_stats GROUP BY media_type ORDER BY cnt DESC')

    // Format breakdown
    const byFormat = await query<any>('SELECT format, COUNT(*) AS cnt FROM download_stats GROUP BY format ORDER BY cnt DESC LIMIT 10')

    // Quality breakdown
    const byQuality = await query<any>('SELECT quality, COUNT(*) AS cnt FROM download_stats WHERE quality IS NOT NULL GROUP BY quality ORDER BY cnt DESC LIMIT 10')

    // Messages stats
    const [msgTotal]   = await query<any>('SELECT COUNT(*) AS cnt FROM contact_messages')
    const [msgUnread]  = await query<any>("SELECT COUNT(*) AS cnt FROM contact_messages WHERE status='unread'")
    const [msgReplied] = await query<any>("SELECT COUNT(*) AS cnt FROM contact_messages WHERE status='replied'")

    // Messages per day (last 30 days)
    const msgByDay = await query<any>(`
      SELECT DATE(created_at) AS day, COUNT(*) AS cnt
      FROM contact_messages
      WHERE created_at >= NOW() - INTERVAL 30 DAY
      GROUP BY DATE(created_at) ORDER BY day ASC
    `)

    // Blog stats
    const [blogTotal]     = await query<any>('SELECT COUNT(*) AS cnt FROM blog_posts')
    const [blogPublished] = await query<any>('SELECT COUNT(*) AS cnt FROM blog_posts WHERE published=1')

    // Registered user count estimate (from download_stats unique user_ids)
    const [uniqueUsers] = await query<any>('SELECT COUNT(DISTINCT user_id) AS cnt FROM download_stats WHERE user_id IS NOT NULL')

    res.json({
      summary: {
        dl_total:    dlTotal?.cnt ?? 0,
        dl_today:    dlToday?.cnt ?? 0,
        dl_week:     dlWeek?.cnt ?? 0,
        dl_month:    dlMonth?.cnt ?? 0,
        dl_success:  dlSuccess?.cnt ?? 0,
        dl_failed:   dlFailed?.cnt ?? 0,
        success_rate: dlTotal?.cnt > 0 ? Math.round((dlSuccess?.cnt / dlTotal?.cnt) * 100) : 0,
        msg_total:   msgTotal?.cnt ?? 0,
        msg_unread:  msgUnread?.cnt ?? 0,
        msg_replied: msgReplied?.cnt ?? 0,
        blog_total:  blogTotal?.cnt ?? 0,
        blog_published: blogPublished?.cnt ?? 0,
        unique_users: uniqueUsers?.cnt ?? 0,
      },
      dl_by_day:    dlByDay,
      dl_by_hour:   dlByHour,
      top_domains:  topDomains,
      by_type:      byType,
      by_format:    byFormat,
      by_quality:   byQuality,
      msg_by_day:   msgByDay,
    })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Admin: CRUD blog ──────────────────────────────────────────────────────────
router.post('/admin/blog', async (req, res) => {
  const { title, slug, excerpt, content, author, cover_image, tags, category } = req.body
  try {
    const words  = String(content ?? '').split(/\s+/).filter(Boolean).length
    const result = await query<any>(
      'INSERT INTO blog_posts (title,slug,excerpt,content,author,cover_image,tags,category,read_minutes) VALUES (?,?,?,?,?,?,?,?,?)',
      [title, slug, excerpt, content, author || 'Admin', cover_image, tags, category || 'General', Math.max(3, Math.round(words/200))]
    )
    res.json({ success: true, id: (result as any).insertId })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

router.put('/admin/blog/:id', async (req, res) => {
  const { title, slug, excerpt, content, author, cover_image, tags, category, published } = req.body
  try {
    const words = String(content ?? '').split(/\s+/).filter(Boolean).length
    await query(
      'UPDATE blog_posts SET title=?,slug=?,excerpt=?,content=?,author=?,cover_image=?,tags=?,category=?,read_minutes=?,published=? WHERE id=?',
      [title, slug, excerpt, content, author, cover_image, tags, category || 'General', Math.max(3, Math.round(words/200)), published ? 1 : 0, req.params.id]
    )
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

router.delete('/admin/blog/:id', async (req, res) => {
  try {
    await query('DELETE FROM blog_posts WHERE id=?', [req.params.id])
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Admin: settings CRUD ──────────────────────────────────────────────────────
router.get('/admin/settings', async (_req, res) => {
  try {
    const rows = await query<any>('SELECT key_name, value, updated_at FROM site_settings ORDER BY key_name')
    res.json(rows)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

router.put('/admin/settings', async (req, res) => {
  const updates = req.body as Record<string, string>
  if (!updates || typeof updates !== 'object') { res.status(400).json({ error: 'Invalid body' }); return }
  try {
    for (const [key, value] of Object.entries(updates)) {
      await query(
        'INSERT INTO site_settings (key_name,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',
        [key.slice(0, 100), String(value).slice(0, 2000)]
      )
    }
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Admin: FAQ CRUD ───────────────────────────────────────────────────────────
router.post('/admin/faq', async (req, res) => {
  const { question, answer, category, sort_order } = req.body
  try {
    const r = await query<any>(
      'INSERT INTO faq_items (question,answer,category,sort_order) VALUES (?,?,?,?)',
      [question, answer, category || 'General', sort_order || 0]
    )
    res.json({ success: true, id: (r as any).insertId })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

router.put('/admin/faq/:id', async (req, res) => {
  const { question, answer, category, sort_order } = req.body
  try {
    await query('UPDATE faq_items SET question=?,answer=?,category=?,sort_order=? WHERE id=?',
      [question, answer, category, sort_order, req.params.id])
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

router.delete('/admin/faq/:id', async (req, res) => {
  try {
    await query('DELETE FROM faq_items WHERE id=?', [req.params.id])
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

export default router
