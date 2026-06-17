import type { MetadataRoute } from 'next'
import { getAllPlatformSlugs } from '@/lib/platforms'
import { LEGAL_SLUGS } from '@/lib/legal'
import { fetchBlogList } from '@/lib/api'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mediadl.app'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

type Freq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

function entry(
  path: string,
  priority: number,
  changeFrequency: Freq,
  lastModified?: Date,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE}${path}`,
    lastModified: lastModified ?? new Date(),
    changeFrequency,
    priority,
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // ── Tier 1: Core product pages (priority 0.9–1.0) ────────────────────────
  const tier1: MetadataRoute.Sitemap = [
    entry('',          1.0, 'daily',   now),
    entry('/download', 0.95, 'daily',  now),
    entry('/player',   0.9,  'weekly', now),
  ]

  // ── Tier 2: Tools & features (0.85) ──────────────────────────────────────
  const tier2: MetadataRoute.Sitemap = [
    entry('/tools/convert',   0.85, 'weekly', now),
    entry('/screen-capture',  0.85, 'weekly', now),
    entry('/supported-sites', 0.85, 'weekly', now),
    entry('/status',          0.6,  'always', now),
  ]

  // ── Tier 3: Content hubs (0.8) ───────────────────────────────────────────
  const tier3: MetadataRoute.Sitemap = [
    entry('/movies',          0.8, 'daily',  now),
    entry('/news',            0.8, 'daily',  now),
    entry('/people',          0.8, 'weekly', now),
    entry('/schedules',       0.75, 'daily', now),
    entry('/history',         0.7,  'daily', now),
  ]

  // ── Tier 4: Movies sub-pages ──────────────────────────────────────────────
  const moviesStatic: MetadataRoute.Sitemap = [
    entry('/movies/explorer',  0.75, 'weekly', now),
    entry('/movies/people',    0.7,  'weekly', now),
    entry('/movies/reference', 0.65, 'monthly', now),
  ]

  // ── Tier 5: Company / info pages (0.65–0.7) ──────────────────────────────
  const company: MetadataRoute.Sitemap = [
    entry('/about',    0.7,  'monthly', now),
    entry('/services', 0.7,  'monthly', now),
    entry('/pricing',  0.7,  'weekly',  now),
    entry('/blog',     0.7,  'daily',   now),
    entry('/contact',  0.65, 'monthly', now),
    entry('/faq',      0.65, 'monthly', now),
  ]

  // ── Tier 6: Utility pages (0.5) ──────────────────────────────────────────
  const utility: MetadataRoute.Sitemap = [
    entry('/sitemap-page', 0.5, 'monthly', now),
  ]

  // ── Platform downloader pages (0.9) ──────────────────────────────────────
  const platforms: MetadataRoute.Sitemap = getAllPlatformSlugs().map((s) =>
    entry(`/${s}`, 0.9, 'weekly', now),
  )

  // ── Legal pages (0.4) ────────────────────────────────────────────────────
  const legal: MetadataRoute.Sitemap = LEGAL_SLUGS.map((s) =>
    entry(`/${s}`, 0.4, 'yearly', now),
  )

  // ── Blog posts (0.65) — paged from API ───────────────────────────────────
  const blogEntries: MetadataRoute.Sitemap = []
  try {
    const first = await fetchBlogList({ page: 1, limit: 60 })
    const totalPages = Math.min(first.pages, 40)
    const pageResults = await Promise.all(
      Array.from({ length: totalPages }, (_, i) =>
        i === 0 ? Promise.resolve(first) : fetchBlogList({ page: i + 1, limit: 60 }),
      ),
    )
    for (const data of pageResults) {
      for (const post of data.posts) {
        blogEntries.push({
          url: `${SITE}/blog/${post.slug}`,
          lastModified: post.published_at ? new Date(post.published_at) : now,
          changeFrequency: 'monthly',
          priority: 0.65,
        })
      }
    }
  } catch { /* sitemap still valid without blog URLs */ }

  return [
    ...tier1,
    ...tier2,
    ...tier3,
    ...moviesStatic,
    ...company,
    ...utility,
    ...platforms,
    ...legal,
    ...blogEntries,
  ]
}
