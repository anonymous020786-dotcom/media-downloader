import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Tag } from 'lucide-react'
import { tmdbKeyword, tmdbKeywordMovies } from '@/lib/tmdb'
import PaginatedGrid from '@/components/movies/PaginatedGrid'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const k = await tmdbKeyword(id).catch(() => null)
  return { title: k ? `“${k.name}” Movies` : 'Keyword', alternates: { canonical: `/movies/keyword/${id}` } }
}

export default async function KeywordPage({ params }: Params) {
  const { id } = await params
  const [k, movies] = await Promise.all([
    tmdbKeyword(id).catch(() => null),
    tmdbKeywordMovies(id).catch(() => ({ results: [], total_results: 0 } as any)),
  ])
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-6"><ArrowLeft size={14}/>Movies</Link>
      <h1 className="text-3xl font-black text-[var(--text)] mb-2 flex items-center gap-2"><Tag size={24} className="text-[var(--brand)]" />{k?.name ?? 'Keyword'}</h1>
      <p className="text-sm text-[var(--text-3)] mb-8">{movies.total_results?.toLocaleString() ?? 0} movies tagged with this keyword</p>
      <PaginatedGrid endpoint={`/keyword/${id}/movies`} media="movie"
        initial={movies.results ?? []} initialPages={movies.total_pages ?? 1} initialTotal={movies.total_results} />
    </div>
  )
}
