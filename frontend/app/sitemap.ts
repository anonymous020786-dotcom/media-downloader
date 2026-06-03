import type { MetadataRoute } from 'next'
import { getAllPlatformSlugs } from '@/lib/platforms'
import { LEGAL_SLUGS } from '@/lib/legal'
import { fetchBlogList } from '@/lib/api'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mediadl.app'

// Generate at request time (and revalidate hourly) so all DB-backed blog posts
// are included even though the backend isn't reachable during the build.
export const dynamic = 'force-dynamic'
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticPaths = ['', '/download', '/movies', '/news', '/people', '/about', '/services', '/pricing', '/blog', '/faq', '/contact', '/supported-sites', '/sitemap-page']
  const platformPaths = getAllPlatformSlugs().map((s) => `/${s}`)
  const legalPaths = LEGAL_SLUGS.map((s) => `/${s}`)

  // All blog posts (paged out of the API) — big SEO surface for the 1,000 articles
  const blogPaths: string[] = []
  try {
    const first = await fetchBlogList({ page: 1, limit: 60 })
    for (let pg = 1; pg <= Math.min(first.pages, 40); pg++) {
      const data = pg === 1 ? first : await fetchBlogList({ page: pg, limit: 60 })
      data.posts.forEach((p) => blogPaths.push(`/blog/${p.slug}`))
    }
  } catch { /* sitemap still valid without blog URLs */ }

  const base = [...staticPaths, ...platformPaths, ...legalPaths].map((p) => ({
    url: `${SITE}${p}`,
    lastModified: now,
    changeFrequency: (p === '' || p === '/download' ? 'daily' : 'weekly') as 'daily' | 'weekly',
    priority: p === '' ? 1 : p === '/download' ? 0.9 : p.includes('downloader') ? 0.8 : 0.5,
  }))
  const blog = blogPaths.map((p) => ({
    url: `${SITE}${p}`, lastModified: now,
    changeFrequency: 'monthly' as const, priority: 0.6,
  }))
  return [...base, ...blog]
}
