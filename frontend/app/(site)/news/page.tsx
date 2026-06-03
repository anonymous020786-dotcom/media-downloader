import type { Metadata } from 'next'
import { Newspaper } from 'lucide-react'
import NewsBrowser from '@/components/news/NewsBrowser'
import { fetchNewsCategories } from '@/lib/news'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const c = await fetchNewsCategories().catch(() => null)
  return {
    title: 'News — Free Open Headlines Across Every Topic',
    description: `Browse live headlines from ${c?.total_feeds ?? 'hundreds of'} free open sources across ${c?.total_categories ?? 'dozens of'} categories — no API key, with search, filters, and pagination.`,
    alternates: { canonical: '/news' },
  }
}

export default async function NewsPage() {
  const c = await fetchNewsCategories().catch(() => null)
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-2)] mb-4">
          <Newspaper size={12} className="text-[var(--brand)]" /> Open News · {c?.total_feeds ?? '100+'} free sources · {c?.total_categories ?? '30+'} categories
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text)] mb-4">
          The <span className="gradient-text">News</span>, From Everywhere
        </h1>
        <p className="text-lg text-[var(--text-2)] max-w-2xl mx-auto">
          Live headlines aggregated from free, open RSS sources — no API key, no paywall. Search, filter by source, and page through every topic.
        </p>
      </div>
      <NewsBrowser />
    </div>
  )
}
