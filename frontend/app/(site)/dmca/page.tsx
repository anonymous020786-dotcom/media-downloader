import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LegalLayout from '@/components/legal/LegalLayout'
import { LEGAL_DOCS } from '@/lib/legal'

const doc = LEGAL_DOCS['dmca']

export const metadata: Metadata = {
  title: doc ? doc.title + ' | MediaDL' : 'Legal',
  description: doc?.intro?.slice(0, 160),
  alternates: { canonical: '/dmca' },
}

export default function Page() {
  if (!doc) notFound()
  return <LegalLayout title={doc.title} updated={doc.updated} intro={doc.intro} sections={doc.sections} />
}
