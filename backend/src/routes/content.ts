import { Router } from 'express'
import axios from 'axios'

/**
 * Public content endpoints (local build — no CMS/DB).
 * Blog, contact and every /admin/* route were removed. What remains is the
 * supported-site count, coarse stats, and static FAQ / testimonials / settings.
 */
const router = Router()
const PYTHON = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'

// ── Supported sites (proxied to python, cached 1h) ───────────────────────────
let _sitesCache: { data: any; at: number } | null = null
router.get('/sites', async (_req, res) => {
  try {
    if (_sitesCache && Date.now() - _sitesCache.at < 3_600_000) return res.json(_sitesCache.data)
    const { data } = await axios.get(`${PYTHON}/engines/sites`, { timeout: 20_000 })
    _sitesCache = { data, at: Date.now() }
    res.json(data)
  } catch (e: any) { res.status(502).json({ error: e.message }) }
})

router.get('/stats', (_req, res) => {
  res.json({ total_downloads: '50,000,000+', total_sites: '14,000+' })
})

router.get('/settings', (_req, res) => {
  res.json({
    site_name: process.env.NEXT_PUBLIC_SITE_NAME ?? 'MediaDL',
    site_tagline: 'Download any video or image from any website',
    support_email: '',
  })
})

// ── Static FAQ / testimonials ────────────────────────────────────────────────
const FAQ = [
  { id: 1, question: 'What websites are supported?', answer: 'Over 14,000 sites via yt-dlp, gallery-dl and streamlink — YouTube, Instagram, TikTok, X/Twitter, Facebook, Reddit, Vimeo, Twitch, SoundCloud and many more.', category: 'General', sort_order: 1 },
  { id: 2, question: 'Can I download entire playlists or profiles?', answer: 'Yes. Use Playlist / Profile mode to grab a whole YouTube playlist, channel or a social profile. You can cap the number of items or fetch everything.', category: 'Features', sort_order: 2 },
  { id: 3, question: 'What formats can I get?', answer: 'MP4, WebM, MKV, MP3, M4A, Opus and more. Pick quality (Best / 1080p / 720p / …) and format after analyzing a URL.', category: 'Features', sort_order: 3 },
  { id: 4, question: 'Can it download HLS / encrypted streams?', answer: 'Yes — FFmpeg handles HLS (m3u8), DASH and AES-128 encrypted streams; the key is fetched automatically.', category: 'Technical', sort_order: 4 },
  { id: 5, question: 'Where do my downloads go?', answer: 'The server assembles the file in a temporary staging area, streams it to your browser, then deletes it. Nothing is kept — "Download ZIP" (grab-all) also purges immediately.', category: 'General', sort_order: 5 },
  { id: 6, question: 'Login-walled content?', answer: 'Paste a Netscape cookies.txt (or a browser Cookie header) in Advanced options, or save it per-site in the Cookie manager so it is re-applied automatically.', category: 'Features', sort_order: 6 },
]
router.get('/faq', (_req, res) => res.json(FAQ))

const TESTIMONIALS = [
  { id: 1, name: 'Alex M.', role: 'Content Creator', avatar: null, content: 'The only downloader that consistently works across every platform I use. Playlist download saves me hours.', rating: 5 },
  { id: 2, name: 'Sarah K.', role: 'Social Media Manager', avatar: null, content: 'I archive content daily. Bulk download and the preview grid are game-changers.', rating: 5 },
  { id: 3, name: 'James R.', role: 'Video Editor', avatar: null, content: 'Quality selection and format conversion work perfectly. Grabbed a 200-video 4K playlist overnight, zero failures.', rating: 5 },
  { id: 4, name: 'Priya S.', role: 'Researcher', avatar: null, content: 'The image scraper pulled 1,400 images from a gallery site in minutes.', rating: 5 },
]
router.get('/testimonials', (_req, res) => res.json(TESTIMONIALS))

export default router
