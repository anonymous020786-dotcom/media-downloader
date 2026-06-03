import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { tmdbNetwork, tmdbNetworkImages, tmdbNetworkShows, img } from '@/lib/tmdb'
import { KeyValue } from '@/components/movies/parts'
import PaginatedGrid from '@/components/movies/PaginatedGrid'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const c = await tmdbNetwork(id).catch(() => null)
  return { title: c ? `${c.name} — TV Shows` : 'Network', alternates: { canonical: `/movies/network/${id}` } }
}

export default async function NetworkPage({ params }: Params) {
  const { id } = await params
  const [c, logos, shows] = await Promise.all([
    tmdbNetwork(id).catch(() => null),
    tmdbNetworkImages(id).catch(() => null),
    tmdbNetworkShows(id).catch(() => ({ results: [] } as any)),
  ])
  if (!c) return <div className="max-w-2xl mx-auto px-4 py-24 text-center text-[var(--text-2)]">Network not found.</div>
  const logo = logos?.logos?.[0]?.file_path
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-6"><ArrowLeft size={14}/>Movies</Link>
      <div className="flex items-center gap-4 mb-6">
        {logo && <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center p-3 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img(logo,'w300')} alt={c.name} className="max-w-full max-h-full object-contain" /></div>}
        <div>
          <h1 className="text-3xl font-black text-[var(--text)]">{c.name}</h1>
          {c.headquarters && <p className="text-sm text-[var(--text-3)]">{c.headquarters}</p>}
        </div>
      </div>
      <KeyValue rows={[
        ['Country', c.origin_country],
        ['Homepage', c.homepage ? <a href={c.homepage} target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] hover:underline inline-flex items-center gap-1">Visit <ExternalLink size={11}/></a> : null],
      ]} />
      <h2 className="text-xl font-black text-[var(--text)] mt-10 mb-4">TV Shows</h2>
      <PaginatedGrid endpoint="/discover/tv" params={{ with_networks: id, sort_by: 'popularity.desc' }} media="tv"
        initial={shows.results ?? []} initialPages={shows.total_pages ?? 1} initialTotal={shows.total_results} />
    </div>
  )
}
