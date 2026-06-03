import type { Metadata } from 'next'
import SitesExplorer from '@/components/landing/SitesExplorer'
import LiveSiteCount from '@/components/landing/LiveSiteCount'

export const metadata: Metadata = {
  title: 'Supported Sites — Any Website | MediaDL',
  description: 'MediaDL supports thousands of named site extractors plus a generic fallback that downloads media and files from virtually any website — and any file type, in single or bulk.',
  alternates: { canonical: '/supported-sites' },
}

export default function SupportedSitesPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text)] mb-4">
          <span className="gradient-text">Any</span> Website, <span className="gradient-text">Any</span> File Type
        </h1>
        <p className="text-lg text-[var(--text-2)] max-w-2xl mx-auto">
          MediaDL combines <strong className="text-[var(--text)]">five real engines</strong> — yt-dlp (video
          extractors), gallery-dl (image/gallery/social/board patterns), you-get (Asian sites), streamlink
          (live streams &amp; sports), and a headless-browser engine that grabs media from
          <strong className="text-[var(--text)]"> any page</strong> — even when the real URL is hidden in the network tab.
          Anything else is caught by a generic direct-download fallback that handles <strong className="text-[var(--text)]">any
          file type</strong>, in single or bulk.
        </p>
        <LiveSiteCount />
      </div>
      <SitesExplorer />
    </div>
  )
}
