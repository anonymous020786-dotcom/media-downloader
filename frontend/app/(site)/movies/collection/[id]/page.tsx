import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { tmdbCollection, img } from '@/lib/tmdb'
import DetailTabs from '@/components/movies/DetailTabs'
import { PosterGrid, ImageGallery } from '@/components/movies/parts'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const c = await tmdbCollection(id).catch(() => null)
  return { title: c ? `${c.name}` : 'Collection', alternates: { canonical: `/movies/collection/${id}` } }
}

export default async function CollectionPage({ params }: Params) {
  const { id } = await params
  const c = await tmdbCollection(id).catch(() => null)
  if (!c) return <div className="max-w-2xl mx-auto px-4 py-24 text-center text-[var(--text-2)]">Collection not found.</div>
  const parts = (c.parts ?? []).sort((a: any, b: any) => (a.release_date || '').localeCompare(b.release_date || ''))
  const tabs = [
    { label: 'Movies', count: parts.length, node: <PosterGrid items={parts} media="movie" /> },
    { label: 'Images', node: c.images ? <ImageGallery images={c.images} /> : null },
  ]
  return (
    <div>
      <div className="relative">
        {c.backdrop_path && /* eslint-disable-next-line @next/next/no-img-element */
          <img src={img(c.backdrop_path,'original')} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
        <div className="relative max-w-5xl mx-auto px-4 py-12">
          <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-6"><ArrowLeft size={14}/>Movies</Link>
          <h1 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-3">{c.name}</h1>
          <p className="text-[var(--text-2)] max-w-3xl leading-relaxed">{c.overview}</p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 pb-16 pt-4"><DetailTabs tabs={tabs} /></div>
    </div>
  )
}
