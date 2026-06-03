import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Star, Calendar } from 'lucide-react'
import { tmdbSeason, img } from '@/lib/tmdb'
import TrailerActions from '@/components/movies/TrailerActions'
import DetailTabs from '@/components/movies/DetailTabs'
import { CastGrid, ImageGallery } from '@/components/movies/parts'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; n: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, n } = await params
  const s = await tmdbSeason(id, n).catch(() => null)
  return { title: s ? `${s.name} — Episodes` : 'Season', alternates: { canonical: `/movies/tv/${id}/season/${n}` } }
}

export default async function SeasonPage({ params }: Params) {
  const { id, n } = await params
  const s = await tmdbSeason(id, n).catch(() => null)
  if (!s) return <div className="max-w-2xl mx-auto px-4 py-24 text-center text-[var(--text-2)]">Season not found.</div>
  const episodes: any[] = s.episodes ?? []
  const cast = s.credits?.cast ?? s.aggregate_credits?.cast ?? []
  const videos = s.videos?.results ?? []

  const tabs = [
    { label: 'Episodes', count: episodes.length, node: (
      <div className="space-y-3">
        {episodes.map((e: any) => (
          <Link key={e.id} href={`/movies/tv/${id}/season/${n}/episode/${e.episode_number}`}
            className="flex gap-4 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors">
            <div className="w-40 shrink-0 aspect-video rounded-lg overflow-hidden bg-[var(--bg-hover)]">
              {e.still_path && /* eslint-disable-next-line @next/next/no-img-element */
                <img src={img(e.still_path,'w300')} alt={e.name} loading="lazy" className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-[var(--text-3)]">E{e.episode_number}</span>
                <p className="text-sm font-bold text-[var(--text)] truncate">{e.name}</p>
                {!!e.vote_average && <span className="ml-auto inline-flex items-center gap-1 text-xs text-amber-400 font-bold"><Star size={10} className="fill-amber-400"/>{e.vote_average.toFixed(1)}</span>}
              </div>
              <p className="text-[11px] text-[var(--text-3)] mb-1 flex items-center gap-2"><Calendar size={10}/>{e.air_date} · {e.runtime ? `${e.runtime}m` : ''}</p>
              <p className="text-xs text-[var(--text-2)] line-clamp-2">{e.overview}</p>
            </div>
          </Link>
        ))}
      </div>
    )},
    { label: 'Cast', count: cast.length, node: cast.length ? <CastGrid cast={cast} /> : null },
    { label: 'Videos', count: videos.length, node: videos.length ? <TrailerActions videos={videos} title={s.name} /> : null },
    { label: 'Images', node: s.images ? <ImageGallery images={s.images} /> : null },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Link href={`/movies/tv/${id}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-6"><ArrowLeft size={14}/>Back to series</Link>
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="w-36 shrink-0 mx-auto sm:mx-0">
          {s.poster_path
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={img(s.poster_path,'w500')} alt={s.name} className="w-full rounded-2xl border border-[var(--border)]" />
            : <div className="aspect-[2/3] rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]" />}
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-black text-[var(--text)] mb-2">{s.name}</h1>
          <p className="text-sm text-[var(--text-3)] mb-3">{(s.air_date||'').slice(0,4)} · {episodes.length} episodes</p>
          <p className="text-[var(--text-2)] leading-relaxed">{s.overview}</p>
        </div>
      </div>
      <DetailTabs tabs={tabs} />
    </div>
  )
}
