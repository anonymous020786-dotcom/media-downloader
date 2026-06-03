import type { Metadata } from 'next'
import Link from 'next/link'
import { Star, Calendar, Clock, ArrowLeft, ExternalLink, DollarSign } from 'lucide-react'
import { tmdbDetail, img } from '@/lib/tmdb'
import TrailerActions from '@/components/movies/TrailerActions'
import TitleActions from '@/components/movies/TitleActions'
import ShareButton from '@/components/movies/ShareButton'
import HeroTrailer from '@/components/movies/HeroTrailer'
import DetailTabs from '@/components/movies/DetailTabs'
import PaginatedGrid from '@/components/movies/PaginatedGrid'
import { CastGrid, CrewList, ImageGallery, ReviewList, PosterGrid, Chips, KeyValue, ExternalLinks } from '@/components/movies/parts'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ type: string; id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { type, id } = await params
  if (type !== 'movie' && type !== 'tv') return { title: 'Title' }
  const d = await tmdbDetail(type, id).catch(() => null)
  if (!d) return { title: 'Title' }
  const t = d.title || d.name
  return {
    title: `${t} — Details, Cast & Trailers`,
    description: d.overview?.slice(0, 160),
    alternates: { canonical: `/movies/${type}/${id}` },
    openGraph: { title: t, description: d.overview?.slice(0, 160), images: d.backdrop_path ? [img(d.backdrop_path, 'w780')] : undefined },
  }
}

const mins = (n?: number) => { if (!n) return ''; const h = Math.floor(n/60), m = n%60; return h ? `${h}h ${m}m` : `${m}m` }
const money = (n?: number) => n ? `$${n.toLocaleString()}` : ''

export default async function TitlePage({ params }: Params) {
  const { type, id } = await params
  if (type !== 'movie' && type !== 'tv') return <div className="max-w-2xl mx-auto px-4 py-24 text-center text-[var(--text-2)]">Unknown type.</div>
  const d = await tmdbDetail(type, id).catch(() => null)
  if (!d) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-black text-[var(--text)] mb-3">Title Not Found</h1>
        <Link href="/movies" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white font-semibold text-sm"><ArrowLeft size={14}/>Back to Movies</Link>
      </div>
    )
  }

  const isTv = type === 'tv'
  const title = d.title || d.name
  const year = (d.release_date || d.first_air_date || '').slice(0, 4)
  const runtime = d.runtime || d.episode_run_time?.[0]
  const credits = d.credits || d.aggregate_credits || {}
  const cast: any[] = credits.cast ?? []
  const crew: any[] = credits.crew ?? []
  const videos = d.videos?.results ?? []
  const yt = videos.filter((v: any) => v.site === 'YouTube')
  const bestTrailer = yt.find((v: any) => v.type === 'Trailer' && v.official)
    || yt.find((v: any) => v.type === 'Trailer') || yt[0]
  const similar = d.similar?.results ?? []
  const recs = d.recommendations?.results ?? []
  const reviews = d.reviews?.results ?? []
  const providersAll = d['watch/providers']?.results?.US
  const flatrate = providersAll?.flatrate ?? []
  const imdb = d.external_ids?.imdb_id
  const keywords = d.keywords?.keywords ?? d.keywords?.results ?? []
  const seasons = (d.seasons ?? []).filter((s: any) => s.season_number > 0 || (d.seasons?.length === 1))
  const collection = d.belongs_to_collection
  const altTitles = (d.alternative_titles?.titles ?? d.alternative_titles?.results ?? []).slice(0, 20)
  const releaseDates = d.release_dates?.results ?? []   // movie, per country
  const contentRatings = d.content_ratings?.results ?? [] // tv, per country
  const RELEASE_TYPE = ['', 'Premiere', 'Theatrical (limited)', 'Theatrical', 'Digital', 'Physical', 'TV']
  const certifications = isTv
    ? (d.content_ratings?.results ?? []).find((c: any) => c.iso_3166_1 === 'US')?.rating
    : (d.release_dates?.results ?? []).find((c: any) => c.iso_3166_1 === 'US')?.release_dates?.find((r: any) => r.certification)?.certification

  const tabs = [
    { label: 'Overview', node: (
      <div className="space-y-8">
        <p className="text-[var(--text-2)] leading-relaxed text-[15px]">{d.overview || 'No overview available.'}</p>
        {cast.length > 0 && <div><h3 className="text-lg font-bold text-[var(--text)] mb-4">Top Cast</h3><CastGrid cast={cast.slice(0, 12)} /></div>}
        <KeyValue rows={[
          ['Status', d.status],
          ['Original language', (d.original_language || '').toUpperCase()],
          [isTv ? 'First air date' : 'Release date', d.release_date || d.first_air_date],
          isTv ? ['Last air date', d.last_air_date] : ['Runtime', mins(runtime)],
          isTv ? ['Seasons', d.number_of_seasons] : ['Budget', money(d.budget)],
          isTv ? ['Episodes', d.number_of_episodes] : ['Revenue', money(d.revenue)],
          ['Certification', certifications],
          ['Networks', (d.networks ?? []).map((n: any) => n.name).join(', ')],
          ['Production', (d.production_companies ?? []).slice(0,3).map((c: any) => c.name).join(', ')],
        ]} />
      </div>
    )},
    { label: 'Cast & Crew', count: cast.length + crew.length, node: cast.length || crew.length ? (
      <div><CastGrid cast={cast} /><CrewList crew={crew} /></div>
    ) : null },
    { label: 'Media', count: videos.length, node: (videos.length || (d.images?.backdrops?.length)) ? (
      <div className="space-y-8">
        {videos.length > 0 && <div><h3 className="text-lg font-bold text-[var(--text)] mb-4">Trailers & Videos</h3><TrailerActions videos={videos} title={title} /></div>}
        <div><h3 className="text-lg font-bold text-[var(--text)] mb-4">Images</h3><ImageGallery images={d.images} /></div>
      </div>
    ) : null },
    isTv && seasons.length ? { label: 'Seasons', count: seasons.length, node: (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {seasons.map((s: any) => (
          <Link key={s.id} href={`/movies/tv/${id}/season/${s.season_number}`} className="group block">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)]">
              {s.poster_path && /* eslint-disable-next-line @next/next/no-img-element */
                <img src={img(s.poster_path, 'w300')} alt={s.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />}
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--text)] truncate">{s.name}</p>
            <p className="text-[11px] text-[var(--text-3)]">{s.episode_count} eps · {(s.air_date||'').slice(0,4)}</p>
          </Link>
        ))}
      </div>
    )} : null,
    { label: 'Recommended', count: d.recommendations?.total_results, node: recs.length ? (
      <PaginatedGrid endpoint={`/${type}/${id}/recommendations`} media={type as any}
        initial={recs} initialPages={d.recommendations?.total_pages ?? 1} initialTotal={d.recommendations?.total_results} />
    ) : null },
    { label: 'Similar', count: d.similar?.total_results, node: similar.length ? (
      <PaginatedGrid endpoint={`/${type}/${id}/similar`} media={type as any}
        initial={similar} initialPages={d.similar?.total_pages ?? 1} initialTotal={d.similar?.total_results} />
    ) : null },
    { label: 'Reviews', count: reviews.length, node: reviews.length ? <ReviewList reviews={reviews} /> : null },
    !isTv && releaseDates.length ? { label: 'Releases', count: releaseDates.length, node: (
      <div className="space-y-5">
        {[...releaseDates].sort((a: any, b: any) => a.iso_3166_1.localeCompare(b.iso_3166_1)).map((c: any) => (
          <div key={c.iso_3166_1}>
            <h3 className="text-sm font-bold text-[var(--text)] mb-2">{c.iso_3166_1}</h3>
            <div className="space-y-1">
              {c.release_dates.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm text-[var(--text-2)] border-b border-[var(--border)] pb-1">
                  <span className="w-28 text-[var(--text-3)]">{(r.release_date || '').slice(0, 10)}</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[11px] font-semibold">{RELEASE_TYPE[r.type] || 'Release'}</span>
                  {r.certification && <span className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[11px] font-bold">{r.certification}</span>}
                  {r.note && <span className="text-[11px] text-[var(--text-3)] truncate">{r.note}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )} : null,
    isTv && contentRatings.length ? { label: 'Ratings', count: contentRatings.length, node: (
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
        {[...contentRatings].sort((a: any, b: any) => a.iso_3166_1.localeCompare(b.iso_3166_1)).map((c: any) => (
          <div key={c.iso_3166_1} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
            <span className="text-sm font-semibold text-[var(--text)]">{c.iso_3166_1}</span>
            <span className="px-2 py-0.5 rounded bg-[var(--bg-hover)] text-xs font-bold text-[var(--text)]">{c.rating || '—'}</span>
          </div>
        ))}
      </div>
    )} : null,
    altTitles.length ? { label: 'Alt. Titles', count: altTitles.length, node: (
      <div className="space-y-1.5">
        {altTitles.map((t: any, i: number) => (
          <div key={i} className="flex items-center gap-3 text-sm border-b border-[var(--border)] pb-1.5">
            <span className="w-10 text-xs font-bold text-[var(--text-3)]">{t.iso_3166_1}</span>
            <span className="text-[var(--text)] font-medium">{t.title}</span>
            {t.type && <span className="text-[11px] text-[var(--text-3)]">({t.type})</span>}
          </div>
        ))}
      </div>
    )} : null,
    { label: 'Details', node: (
      <div className="space-y-8">
        {collection && (
          <Link href={`/movies/collection/${collection.id}`} className="flex items-center gap-4 p-4 rounded-2xl border border-[var(--border)] hover:border-[var(--brand)] transition-colors group relative overflow-hidden">
            {collection.backdrop_path && /* eslint-disable-next-line @next/next/no-img-element */
              <img src={img(collection.backdrop_path, 'w780')} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
            <div className="relative">
              <p className="text-xs text-[var(--text-3)] uppercase tracking-wide font-bold">Part of a collection</p>
              <p className="text-lg font-black text-[var(--text)] group-hover:text-[var(--brand)]">{collection.name}</p>
            </div>
          </Link>
        )}
        {d.external_ids && <div><h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">Links</h3><ExternalLinks ids={d.external_ids} imdbKind="title" /></div>}
        {keywords.length > 0 && <div><h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">Keywords</h3><Chips items={keywords} hrefBase="/movies/keyword" /></div>}
        {isTv && (d.created_by ?? []).length > 0 && <div><h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">Created By</h3><Chips items={d.created_by} hrefBase="/movies/person" /></div>}
        {(d.production_companies ?? []).length > 0 && <div><h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">Production Companies</h3><Chips items={d.production_companies} hrefBase="/movies/company" /></div>}
        {isTv && (d.networks ?? []).length > 0 && <div><h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">Networks</h3><Chips items={d.networks} hrefBase="/movies/network" /></div>}
        {flatrate.length > 0 && (
          <div><h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">Streaming (US)</h3>
            <div className="flex flex-wrap gap-2">{flatrate.map((p: any) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={p.provider_id} src={img(p.logo_path,'w92')} alt={p.provider_name} title={p.provider_name} className="w-10 h-10 rounded-lg border border-[var(--border)]" />
            ))}</div>
          </div>
        )}
        <KeyValue rows={[
          ['Original title', d.original_title || d.original_name],
          ['Homepage', d.homepage ? <a href={d.homepage} target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] hover:underline inline-flex items-center gap-1">Visit <ExternalLink size={11}/></a> : null],
          ['IMDb', imdb ? <a href={`https://www.imdb.com/title/${imdb}`} target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] hover:underline inline-flex items-center gap-1">{imdb} <ExternalLink size={11}/></a> : null],
          ['Popularity', d.popularity?.toFixed(0)],
          ['Vote count', d.vote_count?.toLocaleString()],
          ['Spoken languages', (d.spoken_languages ?? []).map((l: any) => l.english_name).join(', ')],
          ['Countries', (d.production_countries ?? []).map((c: any) => c.name).join(', ')],
        ]} />
      </div>
    )},
  ]

  return (
    <div>
      <div className="relative">
        {d.backdrop_path && /* eslint-disable-next-line @next/next/no-img-element */
          <img src={img(d.backdrop_path,'original')} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
        <div className="relative max-w-5xl mx-auto px-4 py-12">
          <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-6"><ArrowLeft size={14}/>All titles</Link>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-40 shrink-0 mx-auto sm:mx-0">
              {d.poster_path
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={img(d.poster_path,'w500')} alt={title} className="w-full rounded-2xl border border-[var(--border)]" />
                : <div className="aspect-[2/3] rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]" />}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-2">{title} {year && <span className="text-[var(--text-3)] font-bold">({year})</span>}</h1>
              {d.tagline && <p className="text-[var(--text-3)] italic mb-3">{d.tagline}</p>}
              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-2)] mb-4">
                {!!d.vote_average && <span className="inline-flex items-center gap-1 text-amber-400 font-bold"><Star size={14} className="fill-amber-400"/>{d.vote_average.toFixed(1)}</span>}
                {certifications && <span className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[11px] font-bold">{certifications}</span>}
                {(d.release_date || d.first_air_date) && <span className="inline-flex items-center gap-1"><Calendar size={13}/>{d.release_date || d.first_air_date}</span>}
                {runtime ? <span className="inline-flex items-center gap-1"><Clock size={13}/>{mins(runtime)}</span> : null}
                {!!d.revenue && <span className="inline-flex items-center gap-1"><DollarSign size={13}/>{money(d.revenue)}</span>}
              </div>
              <Chips items={d.genres ?? []} />
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <HeroTrailer videoKey={bestTrailer?.key} />
                <ShareButton title={`${title}${year ? ` (${year})` : ''}`} text={d.overview?.slice(0, 140)} />
              </div>
              <div className="mt-3"><TitleActions media={type as 'movie'|'tv'} id={d.id} /></div>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 pb-16 pt-4">
        <DetailTabs tabs={tabs} />
      </div>
    </div>
  )
}
