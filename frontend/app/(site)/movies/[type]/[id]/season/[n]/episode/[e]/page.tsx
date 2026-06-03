import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Star, Calendar } from 'lucide-react'
import { tmdbEpisode, img } from '@/lib/tmdb'
import TrailerActions from '@/components/movies/TrailerActions'
import DetailTabs from '@/components/movies/DetailTabs'
import { CastGrid, CrewList, ImageGallery } from '@/components/movies/parts'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; n: string; e: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, n, e } = await params
  const ep = await tmdbEpisode(id, n, e).catch(() => null)
  return { title: ep ? `${ep.name} — S${n}E${e}` : 'Episode' }
}

export default async function EpisodePage({ params }: Params) {
  const { id, n, e } = await params
  const ep = await tmdbEpisode(id, n, e).catch(() => null)
  if (!ep) return <div className="max-w-2xl mx-auto px-4 py-24 text-center text-[var(--text-2)]">Episode not found.</div>
  const cast = [...(ep.credits?.cast ?? []), ...(ep.guest_stars ?? [])]
  const crew = ep.credits?.crew ?? ep.crew ?? []
  const videos = ep.videos?.results ?? []

  const tabs = [
    { label: 'Cast & Guests', count: cast.length, node: cast.length ? <div><CastGrid cast={cast} /><CrewList crew={crew} /></div> : null },
    { label: 'Videos', count: videos.length, node: videos.length ? <TrailerActions videos={videos} title={ep.name} /> : null },
    { label: 'Images', node: ep.images ? <ImageGallery images={ep.images} /> : null },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Link href={`/movies/tv/${id}/season/${n}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-6"><ArrowLeft size={14}/>Back to season</Link>
      {ep.still_path && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={img(ep.still_path,'original')} alt={ep.name} className="w-full aspect-video object-cover rounded-2xl border border-[var(--border)] mb-6" />
      )}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold text-[var(--text-3)]">S{n} · E{e}</span>
        {!!ep.vote_average && <span className="inline-flex items-center gap-1 text-sm text-amber-400 font-bold"><Star size={12} className="fill-amber-400"/>{ep.vote_average.toFixed(1)}</span>}
      </div>
      <h1 className="text-3xl font-black text-[var(--text)] mb-2">{ep.name}</h1>
      <p className="text-sm text-[var(--text-3)] mb-4 flex items-center gap-2"><Calendar size={12}/>{ep.air_date} · {ep.runtime ? `${ep.runtime}m` : ''}</p>
      <p className="text-[var(--text-2)] leading-relaxed mb-8">{ep.overview}</p>
      <DetailTabs tabs={tabs} />
    </div>
  )
}
