import type { MetadataRoute } from 'next'
import { getAllPlatformSlugs } from '@/lib/platforms'
import { LEGAL_SLUGS } from '@/lib/legal'

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
    entry('/schedules',       0.75, 'daily', now),
  ]

  // ── Tier 5: Company / info pages (0.65–0.7) ──────────────────────────────
  const company: MetadataRoute.Sitemap = [
    entry('/about',    0.7,  'monthly', now),
    entry('/services', 0.7,  'monthly', now),
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

  return [
    ...tier1,
    ...tier2,
    ...tier3,
    ...company,
    ...utility,
    ...platforms,
    ...legal,
  ]
}
