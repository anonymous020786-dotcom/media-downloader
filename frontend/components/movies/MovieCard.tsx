import Link from 'next/link'
import { Star, Film, Tv, User } from 'lucide-react'
import { img, titleOf, yearOf, type TmdbItem } from '@/lib/tmdb'

export default function MovieCard({ item }: { item: TmdbItem }) {
  const media = item.media_type ?? (item.first_air_date || item.name ? 'tv' : 'movie')
  if (media === 'person') {
    return (
      <Link href={`/movies/person/${item.id}`} className="group block">
        <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)]">
          {item.profile_path
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={img(item.profile_path, 'w300')} alt={titleOf(item)} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            : <div className="w-full h-full flex items-center justify-center text-[var(--text-3)]"><User size={28} /></div>}
        </div>
        <p className="mt-2 text-sm font-semibold text-[var(--text)] truncate">{titleOf(item)}</p>
        <p className="text-[11px] text-[var(--text-3)] truncate">{item.known_for_department || 'Person'}</p>
      </Link>
    )
  }
  const year = yearOf(item)
  return (
    <Link href={`/movies/${media}/${item.id}`} className="group block">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)]">
        {item.poster_path
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={img(item.poster_path, 'w300')} alt={titleOf(item)} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          : <div className="w-full h-full flex items-center justify-center text-[var(--text-3)]">{media === 'tv' ? <Tv size={28} /> : <Film size={28} />}</div>}
        {!!item.vote_average && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 text-[10px] font-bold text-amber-400">
            <Star size={9} className="fill-amber-400" />{item.vote_average.toFixed(1)}
          </span>
        )}
        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 text-[9px] font-bold uppercase text-white">{media}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-[var(--text)] truncate">{titleOf(item)}</p>
      <p className="text-[11px] text-[var(--text-3)]">{year || '—'}</p>
    </Link>
  )
}
