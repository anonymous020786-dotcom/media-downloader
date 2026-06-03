import Link from 'next/link'
import { Star, ExternalLink } from 'lucide-react'
import { img, titleOf, yearOf, type TmdbItem } from '@/lib/tmdb'
import MovieCard from './MovieCard'

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--text-3)] py-6">{children}</p>
}

export function PosterGrid({ items, media }: { items: TmdbItem[]; media?: 'movie'|'tv'|'person' }) {
  if (!items?.length) return <Empty>Nothing here.</Empty>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((it, i) => <MovieCard key={`${it.id}-${i}`} item={media ? { ...it, media_type: media } : it} />)}
    </div>
  )
}

export function CastGrid({ cast }: { cast: any[] }) {
  if (!cast?.length) return <Empty>No cast listed.</Empty>
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
      {cast.map((c, i) => (
        <Link key={`${c.id}-${i}`} href={`/movies/person/${c.id}`} className="group block text-center">
          <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] mb-1.5">
            {c.profile_path
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={img(c.profile_path, 'w185')} alt={c.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              : <div className="w-full h-full" />}
          </div>
          <p className="text-xs font-semibold text-[var(--text)] truncate">{c.name}</p>
          <p className="text-[10px] text-[var(--text-3)] truncate">{c.character || c.job || c.roles?.[0]?.character || c.jobs?.[0]?.job || ''}</p>
        </Link>
      ))}
    </div>
  )
}

export function CrewList({ crew }: { crew: any[] }) {
  if (!crew?.length) return null
  // group by department
  const byDept: Record<string, any[]> = {}
  crew.forEach((c) => { (byDept[c.department] ??= []).push(c) })
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
      {Object.entries(byDept).map(([dept, people]) => (
        <div key={dept}>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">{dept}</p>
          <ul className="space-y-1">
            {people.slice(0, 10).map((p, i) => (
              <li key={`${p.id}-${i}`} className="text-sm text-[var(--text-2)]">
                <Link href={`/movies/person/${p.id}`} className="hover:text-[var(--brand)]">{p.name}</Link>
                <span className="text-[var(--text-3)]"> — {p.job || p.jobs?.map((j: any) => j.job).join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function ImageGallery({ images }: { images: any }) {
  const all = [...(images?.backdrops ?? []), ...(images?.posters ?? []), ...(images?.stills ?? []), ...(images?.profiles ?? []), ...(images?.logos ?? [])]
  if (!all.length) return <Empty>No images.</Empty>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {all.slice(0, 48).map((im, i) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <a key={i} href={img(im.file_path, 'original')} target="_blank" rel="noopener noreferrer" className="block">
          <img src={img(im.file_path, 'w500')} alt="" loading="lazy" className="w-full rounded-lg border border-[var(--border)] hover:border-[var(--brand)] transition-colors" />
        </a>
      ))}
    </div>
  )
}

export function ReviewList({ reviews }: { reviews: any[] }) {
  if (!reviews?.length) return <Empty>No reviews yet.</Empty>
  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-[var(--text)]">{r.author}</span>
            {r.author_details?.rating != null && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-bold"><Star size={11} className="fill-amber-400" />{r.author_details.rating}/10</span>
            )}
            <span className="text-[11px] text-[var(--text-3)] ml-auto">{(r.created_at || '').slice(0, 10)}</span>
          </div>
          <p className="text-sm text-[var(--text-2)] leading-relaxed line-clamp-[12] whitespace-pre-line">{r.content}</p>
          {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--brand)] mt-2 hover:underline">Read full review <ExternalLink size={11} /></a>}
        </div>
      ))}
    </div>
  )
}

export function Chips({ items, hrefBase, labelKey = 'name' }: { items: any[]; hrefBase?: string; labelKey?: string }) {
  if (!items?.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => hrefBase
        ? <Link key={it.id} href={`${hrefBase}/${it.id}`} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand)] hover:text-[var(--text)] transition-colors">{it[labelKey]}</Link>
        : <span key={it.id ?? it[labelKey]} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-2)]">{it[labelKey]}</span>)}
    </div>
  )
}

export function KeyValue({ rows }: { rows: [string, React.ReactNode][] }) {
  const r = rows.filter(([, v]) => v != null && v !== '' && v !== 0)
  if (!r.length) return null
  return (
    <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
      {r.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
          <dt className="text-sm text-[var(--text-3)]">{k}</dt>
          <dd className="text-sm text-[var(--text)] font-medium text-right">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// Social / external links from a TMDB external_ids object.
export function ExternalLinks({ ids, imdbKind = 'title' }: { ids: any; imdbKind?: 'title'|'name' }) {
  if (!ids) return null
  const links: { label: string; href: string }[] = []
  if (ids.imdb_id)      links.push({ label: 'IMDb',      href: `https://www.imdb.com/${imdbKind}/${ids.imdb_id}` })
  if (ids.facebook_id)  links.push({ label: 'Facebook',  href: `https://facebook.com/${ids.facebook_id}` })
  if (ids.instagram_id) links.push({ label: 'Instagram', href: `https://instagram.com/${ids.instagram_id}` })
  if (ids.twitter_id)   links.push({ label: 'X / Twitter', href: `https://x.com/${ids.twitter_id}` })
  if (ids.tiktok_id)    links.push({ label: 'TikTok',    href: `https://tiktok.com/@${ids.tiktok_id}` })
  if (ids.youtube_id)   links.push({ label: 'YouTube',   href: `https://youtube.com/${ids.youtube_id}` })
  if (ids.wikidata_id)  links.push({ label: 'Wikidata',  href: `https://www.wikidata.org/wiki/${ids.wikidata_id}` })
  if (!links.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand)] hover:text-[var(--text)] transition-colors">
          {l.label} <ExternalLink size={11} />
        </a>
      ))}
    </div>
  )
}

// Expandable biography / overview block (client-side toggle).
export function Bio({ text }: { text?: string }) {
  if (!text) return <Empty>No biography available.</Empty>
  return <p className="text-[var(--text-2)] leading-relaxed text-[15px] whitespace-pre-line">{text}</p>
}

export { titleOf, yearOf }
