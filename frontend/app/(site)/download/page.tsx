import type { Metadata } from 'next'
import { Suspense } from 'react'
import DownloadTool from '@/components/download/DownloadTool'

export const metadata: Metadata = {
  title: 'Download Tool — Paste Any URL | MediaDL',
  description: 'Paste any video or image URL to download. Supports single videos, playlists, profiles, bulk images, and HLS streams from 1000+ sites.',
}

export default function DownloadPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-16 text-center text-[var(--text-3)]">Loading…</div>}>
      <DownloadTool />
    </Suspense>
  )
}
