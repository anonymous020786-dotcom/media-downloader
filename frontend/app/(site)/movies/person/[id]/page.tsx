import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Cake, MapPin, Star } from 'lucide-react'
import { tmdbPerson, img, type TmdbItem } from '@/lib/tmdb'
import MovieCard from '@/components/movies/MovieCard'
import DetailTabs from '@/components/movies/DetailTabs'
import ShareButton from '@/components/movies/ShareButton'
import { PosterGrid, ImageGallery, ExternalLinks, Bio, KeyValue } from '@/components/movies/parts'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const p = await tmdbPerson(id).catch(() => null)
  if (!p) return { title: 'Person' }
  return { title: `${p.name} — Biography & Filmography`, description: p.biography?.slice(0, 160), alternates: { canonical: `/movies/person/${id}` } }
}

const age = (birth?: string, death?: string) => {
  if (!birth) return null
  const end = death ? new Date(death) : new Date()
  const a = Math.floor((end.getTime() - new Date(birth).getTime()) / 31557600000)
  return death ? `${a} (at death)` : `${a}`
}
const GENDER = ['Not specified', 'Female', 'Male', 'Non-binary']

export default async function PersonPage({ params }: Params) {
  const { id } = await params
  const p = await tmdbPerson(id).catch(() => null)
  if (!p) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-black text-[var(--text)] mb-3">Person Not Found</h1>
        <Link href="/movies" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white font-semibold text-sm"><ArrowLeft size={14}/>Back to Movies</Link>
      </div>
    )
  }

  const cast: any[] = p.combined_credits?.cast ?? []
  const crew: any[] = p.combined_credits?.crew ?? []
  const known: TmdbItem[] = [...cast].filter((c) => c.poster_path).sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)).slice(0, 18)
  const byYearDesc = (a: any, b: any) => (b.release_date || b.first_air_date || '').localeCompare(a.release_date || a.first_air_date || '')

  // Acting credits as a year-grouped list
  const acting = [...cast].sort(byYearDesc)
  const crewByDept: Record<string, any[]> = {}
  crew.forEach((c) => { (crewByDept[c.department] ??= []).push(c) })

  const personFacts = (
    <KeyValue rows={[
      ['Known for', p.known_for_department],
      ['Gender', GENDER[p.gender ?? 0]],
      ['Birthday', p.birthday],
      ['Age', age(p.birthday, p.deathday)],
      ['Day of death', p.deathday],
      ['Place of birth', p.place_of_birth],
      ['Also known as', (p.also_known_as ?? []).slice(0, 4).join('; ')],
      ['Credits', cast.length + crew.length],
      ['Popularity', p.popularity?.toFixed(0)],
    ]} />
  )

  const tabs = [
    { label: 'Biography', node: (
      <div className="space-y-6">
        <Bio text={p.biography} />
        <ExternalLinks ids={{ ...p.external_ids, imdb_id: p.imdb_id ?? p.external_ids?.imdb_id }} imdbKind="name" />
        {known.length > 0 && <div><h3 className="text-lg font-bold text-[var(--text)] mb-4 mt-4">Known For</h3><PosterGrid items={known} /></div>}
      </div>
    )},
    { label: 'Acting', count: cast.length, node: cast.length ? (
      <ul className="divide-y divide-[var(--border)]">
        {acting.map((c, i) => (
          <li key={`${c.credit_id}-${i}`} className="flex items-center gap-3 py-2.5">
            <span className="w-12 text-xs font-bold text-[var(--text-3)] text-right">{(c.release_date || c.first_air_date || '—').slice(0, 4)}</span>
            <Link href={`/movies/${c.media_type}/${c.id}`} className="text-sm font-semibold text-[var(--text)] hover:text-[var(--brand)]">{c.title || c.name}</Link>
            <span className="text-xs text-[var(--text-3)] truncate">{c.character ? `as ${c.character}` : ''}</span>
            <span className="ml-auto text-[10px] uppercase font-bold text-[var(--text-3)]">{c.media_type}</span>
          </li>
        ))}
      </ul>
    ) : null },
    { label: 'Crew', count: crew.length, node: crew.length ? (
      <div className="space-y-6">
        {Object.entries(crewByDept).map(([dept, items]) => (
          <div key={dept}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">{dept}</h3>
            <ul className="divide-y divide-[var(--border)]">
              {items.sort(byYearDesc).map((c, i) => (
                <li key={`${c.credit_id}-${i}`} className="flex items-center gap-3 py-2">
                  <span className="w-12 text-xs font-bold text-[var(--text-3)] text-right">{(c.release_date || c.first_air_date || '—').slice(0, 4)}</span>
                  <Link href={`/movies/${c.media_type}/${c.id}`} className="text-sm font-semibold text-[var(--text)] hover:text-[var(--brand)]">{c.title || c.name}</Link>
                  <span className="text-xs text-[var(--text-3)]">{c.job}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ) : null },
    { label: 'Images', count: p.images?.profiles?.length, node: p.images?.profiles?.length ? <ImageGallery images={{ profiles: p.images.profiles }} /> : null },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-6"><ArrowLeft size={14}/>All titles</Link>
      <div className="flex flex-col sm:flex-row gap-8">
        <aside className="w-full sm:w-52 shrink-0">
          {p.profile_path
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={img(p.profile_path, 'w500')} alt={p.name} className="w-full max-w-[220px] mx-auto sm:mx-0 rounded-2xl border border-[var(--border)] mb-5" />
            : <div className="aspect-[2/3] rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] mb-5" />}
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-3 hidden sm:block">Personal Info</h2>
          <div className="hidden sm:block space-y-3 text-sm">
            <Fact icon={<Star size={13}/>} label="Known For" value={p.known_for_department} />
            <Fact label="Gender" value={GENDER[p.gender ?? 0]} />
            <Fact icon={<Cake size={13}/>} label="Birthday" value={p.birthday ? `${p.birthday}${age(p.birthday, p.deathday) ? ` (${age(p.birthday, p.deathday)})` : ''}` : null} />
            {p.deathday && <Fact label="Died" value={p.deathday} />}
            <Fact icon={<MapPin size={13}/>} label="Place of Birth" value={p.place_of_birth} />
            <Fact label="Also Known As" value={(p.also_known_as ?? []).slice(0, 3).join(', ')} />
          </div>
        </aside>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h1 className="text-3xl md:text-4xl font-black text-[var(--text)]">{p.name}</h1>
            <ShareButton title={p.name} text={p.known_for_department} />
          </div>
          <div className="sm:hidden mb-6">{personFacts}</div>
          <DetailTabs tabs={tabs} />
        </div>
      </div>
    </div>
  )
}

function Fact({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: React.ReactNode }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-3)] flex items-center gap-1">{icon}{label}</p>
      <p className="text-[var(--text)]">{value}</p>
    </div>
  )
}
