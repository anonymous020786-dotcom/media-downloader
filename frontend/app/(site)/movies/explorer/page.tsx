import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Boxes } from 'lucide-react'
import TmdbExplorer from '@/components/movies/TmdbExplorer'
import { ENDPOINT_COUNT } from '@/lib/tmdb-catalog'

export const metadata: Metadata = {
  title: 'TMDB API Explorer — Every Endpoint',
  description: 'Browse and run every TMDB read endpoint with live, rendered results — search, discover, trending, movies, TV, seasons, episodes, people, collections, companies, networks, keywords, watch providers, configuration and more.',
  alternates: { canonical: '/movies/explorer' },
}

export default function ExplorerPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-6"><ArrowLeft size={14}/>Movies</Link>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-2)] mb-3">
          <Boxes size={12} className="text-[var(--brand)]" /> {ENDPOINT_COUNT} endpoints · live
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-2">TMDB API Explorer</h1>
        <p className="text-[var(--text-2)] max-w-2xl">Every TMDB read endpoint, callable with real inputs and rendered results — poster grids, cast, image galleries, trailers, or raw JSON. Powered by the secure server-side proxy.</p>
      </div>
      <TmdbExplorer />
    </div>
  )
}
