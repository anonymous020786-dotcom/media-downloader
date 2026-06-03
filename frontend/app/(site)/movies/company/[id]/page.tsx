import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { tmdbCompany, tmdbCompanyImages, tmdbCompanyMovies, img } from '@/lib/tmdb'
import { KeyValue } from '@/components/movies/parts'
import PaginatedGrid from '@/components/movies/PaginatedGrid'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const c = await tmdbCompany(id).catch(() => null)
  return { title: c ? `${c.name} — Movies` : 'Company', alternates: { canonical: `/movies/company/${id}` } }
}

export default async function CompanyPage({ params }: Params) {
  const { id } = await params
  const [c, logos, movies] = await Promise.all([
    tmdbCompany(id).catch(() => null),
    tmdbCompanyImages(id).catch(() => null),
    tmdbCompanyMovies(id).catch(() => ({ results: [] } as any)),
  ])
  if (!c) return <div className="max-w-2xl mx-auto px-4 py-24 text-center text-[var(--text-2)]">Company not found.</div>
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
      {c.description && <p className="text-[var(--text-2)] leading-relaxed mb-6 max-w-3xl">{c.description}</p>}
      <KeyValue rows={[
        ['Country', c.origin_country],
        ['Homepage', c.homepage ? <a href={c.homepage} target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] hover:underline inline-flex items-center gap-1">Visit <ExternalLink size={11}/></a> : null],
        ['Parent company', c.parent_company?.name],
      ]} />
      <h2 className="text-xl font-black text-[var(--text)] mt-10 mb-4">Movies</h2>
      <PaginatedGrid endpoint="/discover/movie" params={{ with_companies: id, sort_by: 'popularity.desc' }} media="movie"
        initial={movies.results ?? []} initialPages={movies.total_pages ?? 1} initialTotal={movies.total_results} />
    </div>
  )
}
