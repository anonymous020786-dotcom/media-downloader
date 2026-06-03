'use client'
import { useEffect, useState } from 'react'
import { Infinity as InfinityIcon } from 'lucide-react'
import { fetchSupportedSites, type SupportedSites } from '@/lib/api'

export default function LiveSiteCount() {
  const [s, setS] = useState<SupportedSites | null>(null)
  useEffect(() => { fetchSupportedSites().then(setS).catch(() => {}) }, [])

  return (
    <div className="inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 px-5 py-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
      <span className="text-sm text-[var(--text-2)]">
        <strong className="text-[var(--text)] text-lg">
          {s ? s.named_extractors.toLocaleString() : '5,000'}+
        </strong> named site extractors
      </span>
      {s && (
        <span className="text-xs text-[var(--text-3)]">
          yt-dlp {s.by_engine['yt-dlp']?.toLocaleString()} · gallery-dl {s.by_engine['gallery-dl']?.toLocaleString()}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)]">
        <InfinityIcon size={16} /> + any other site via generic fallback
      </span>
    </div>
  )
}
