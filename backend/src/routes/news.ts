import { Router } from 'express'
import Parser from 'rss-parser'
import { FEED_CATALOG, ALL_FEEDS, FEED_COUNT, CATEGORY_COUNT, FEATURED_SLUGS, gnewsSearch } from '../data/feeds.js'

// API-free news aggregator on public RSS/Atom feeds (Google News, Reddit, premium
// outlets). No API key. Hardened: outbound concurrency cap, UA rotation, per-feed
// cache + stale fallback, HTML sanitization, validated inputs.
const router = Router()

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
  'Mozilla/5.0 (compatible; MediaDL-News/1.0; +https://mediadl.app)',
]
const ua = () => UAS[Math.floor(Math.random() * UAS.length)]
const parser: any = new Parser({
  timeout: 12_000,
  customFields: { item: [['media:content', 'mediaContent', { keepArray: true }], ['media:thumbnail', 'mediaThumb'], ['content:encoded', 'contentEncoded']] },
})

// Strip HTML to safe plain text (prevents stored-XSS from feed content shown on-site).
const stripHtml = (s = '') => s.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()

interface Item { title: string; link: string; date: string; snippet: string; content: string; source: string; category: string; image?: string }
const feedCache = new Map<string, { at: number; items: Item[] }>()
const FEED_TTL = 10 * 60_000

// Outbound concurrency limiter — never hammer (reliability + non-blockable).
let _active = 0
const _queue: (() => void)[] = []
const MAX_CONCURRENT = 8
async function gate<T>(fn: () => Promise<T>): Promise<T> {
  if (_active >= MAX_CONCURRENT) await new Promise<void>((r) => _queue.push(r))
  _active++
  try { return await fn() } finally { _active--; _queue.shift()?.() }
}

function imageOf(it: any): string | undefined {
  if (it.enclosure?.url && /image|^$/i.test(it.enclosure.type || '')) return it.enclosure.url
  if (Array.isArray(it.mediaContent)) { const m = it.mediaContent.find((c: any) => c?.$?.url); if (m) return m.$.url }
  if (it.mediaThumb?.$?.url) return it.mediaThumb.$.url
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(it.contentEncoded || it.content || '')
  return m ? m[1] : undefined
}

async function loadFeed(f: { url: string; name: string; category: string }): Promise<Item[]> {
  const hit = feedCache.get(f.url)
  if (hit && Date.now() - hit.at < FEED_TTL) return hit.items
  try {
    const parsed = await gate(() => parser.parseURL(f.url)) as { items?: any[] }
    const items: Item[] = (parsed.items ?? []).slice(0, 100).map((it: any) => ({
      title: (it.title ?? '').trim(),
      link: it.link ?? it.guid ?? '',
      date: it.isoDate ?? it.pubDate ?? '',
      snippet: stripHtml(it.contentSnippet ?? it.summary ?? it.content ?? '').slice(0, 300),
      content: stripHtml(it.contentEncoded ?? it.content ?? it.summary ?? '').slice(0, 5000),
      source: f.name,
      category: f.category,
      image: imageOf(it),
    })).filter((i: Item) => i.title && i.link)
    feedCache.set(f.url, { at: Date.now(), items })
    return items
  } catch {
    return hit?.items ?? []  // serve stale on failure
  }
}

router.get('/categories', (_req, res) => {
  res.json({
    total_feeds: FEED_COUNT, total_categories: CATEGORY_COUNT,
    categories: FEED_CATALOG.map((c) => ({ category: c.category, slug: c.slug, feeds: c.feeds.length })),
  })
})

router.get('/', async (req, res) => {
  const slug = String(req.query.category ?? '').trim().slice(0, 60)
  const topic = String(req.query.topic ?? '').trim().slice(0, 120)   // infinite on-the-fly search
  const q = String(req.query.q ?? '').trim().toLowerCase().slice(0, 80)
  const source = String(req.query.source ?? '').trim().slice(0, 80)
  const page = Math.max(1, parseInt(String(req.query.page ?? '1')) || 1)
  const limit = Math.min(60, Math.max(1, parseInt(String(req.query.limit ?? '24')) || 24))

  let feeds: { category: string; slug: string; name: string; url: string }[]
  if (topic) {
    // Any topic → a Google News feed built on demand (effectively infinite).
    feeds = [{ category: topic, slug: 'topic', name: `Google News: ${topic}`, url: gnewsSearch(topic) }]
  } else if (slug && slug !== 'all') {
    feeds = ALL_FEEDS.filter((f) => f.slug === slug)
    if (!feeds.length) feeds = [{ category: slug, slug: 'topic', name: `Google News: ${slug}`, url: gnewsSearch(slug) }]
  } else {
    // Homepage / all → only the featured set (never fetch 1000+ feeds at once).
    feeds = ALL_FEEDS.filter((f) => FEATURED_SLUGS.includes(f.slug))
  }
  if (source) feeds = feeds.filter((f) => f.name === source)

  try {
    const results = await Promise.all(feeds.map(loadFeed))
    let items = results.flat()
    if (q) items = items.filter((i) => i.title.toLowerCase().includes(q) || i.snippet.toLowerCase().includes(q))
    const seen = new Set<string>()
    items = items.filter((i) => i.link && !seen.has(i.link) && seen.add(i.link))
    items.sort((a, b) => +new Date(b.date || 0) - +new Date(a.date || 0))
    const total = items.length
    const start = (page - 1) * limit
    res.json({
      category: topic || slug || 'featured', q, source,
      total, page, limit, pages: Math.max(1, Math.ceil(total / limit)),
      sources: [...new Set(feeds.map((f) => f.name))],
      items: items.slice(start, start + limit),
    })
  } catch (e: any) {
    res.status(502).json({ error: e.message })
  }
})

export default router
