import type { Metadata } from 'next'
import Link from 'next/link'
import { Clapperboard, Boxes } from 'lucide-react'
import MovieBrowser from '@/components/movies/MovieBrowser'
import { ENDPOINT_COUNT } from '@/lib/tmdb-catalog'

export const metadata: Metadata = {
  title: 'Movies & TV — Discover, Search & Trailers',
  description: 'Browse trending, popular, and top-rated movies and TV shows powered by TMDB. Search any title or person, explore by genre, watch trailers, and download them with MediaDL.',
  alternates: { canonical: '/movies' },
}

export default function MoviesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-2)] mb-4">
          <Clapperboard size={12} className="text-[var(--brand)]" /> Movie & TV Database
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text)] mb-4">
          Discover <span className="gradient-text">Movies & TV</span>
        </h1>
        <p className="text-lg text-[var(--text-2)] max-w-2xl mx-auto">
          Trending, popular, and top-rated titles powered by TMDB. Search anything, explore by genre, and dive into full details, cast, and trailers.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          <Link href="/movies/account" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] hover:border-[var(--brand)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors">My Account</Link>
          <Link href="/movies/people" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] hover:border-[var(--brand)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Popular People</Link>
          <Link href="/movies/reference" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] hover:border-[var(--brand)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Reference Data</Link>
          <Link href="/movies/explorer" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] hover:border-[var(--brand)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
            <Boxes size={15} className="text-[var(--brand)]" /> API Explorer · {ENDPOINT_COUNT} endpoints
          </Link>
        </div>
      </div>
      <MovieBrowser />
    </div>
  )
}
