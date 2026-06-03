import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Library } from 'lucide-react'
import ReferenceBrowser from '@/components/movies/ReferenceBrowser'

export const metadata: Metadata = {
  title: 'TMDB Reference — Genres, Providers, Certifications',
  description: 'Reference data from TMDB: movie & TV genres, watch providers, certifications, and API configuration.',
  alternates: { canonical: '/movies/reference' },
}

export default function ReferencePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-6"><ArrowLeft size={14}/>Movies</Link>
      <h1 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-2 flex items-center gap-2"><Library size={26} className="text-[var(--brand)]" />Reference Data</h1>
      <p className="text-[var(--text-2)] mb-8">Genres, watch providers, certifications, and configuration — straight from TMDB.</p>
      <ReferenceBrowser />
    </div>
  )
}
