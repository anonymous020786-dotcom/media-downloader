import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { tmdbList, img } from '@/lib/tmdb'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Popular People — Actors & Directors',
  description: 'Browse the most popular actors, directors, and crew on TMDB.',
  alternates: { canonical: '/movies/people' },
}

export default async function PopularPeoplePage() {
  const data = await (tmdbList as any)('person', 'popular').catch(() => ({ results: [] }))
  const people: any[] = data.results ?? []
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-6"><ArrowLeft size={14}/>Movies</Link>
      <h1 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-8">Popular People</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
        {people.map((p) => (
          <Link key={p.id} href={`/movies/person/${p.id}`} className="group block text-center">
            <div className="aspect-square rounded-full overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] mb-2 w-full">
              {p.profile_path
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={img(p.profile_path,'w300')} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                : <div className="w-full h-full" />}
            </div>
            <p className="text-sm font-semibold text-[var(--text)] truncate">{p.name}</p>
            <p className="text-[11px] text-[var(--text-3)] truncate">{(p.known_for ?? []).slice(0,2).map((k: any) => k.title || k.name).join(', ')}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
