'use client'
import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronUp, Globe2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { SITE_CATEGORIES } from '@/lib/sites'

const PREVIEW_COUNT = 12

export default function SitesExplorer() {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return SITE_CATEGORIES
    return SITE_CATEGORIES
      .map((c) => ({ ...c, sites: c.sites.filter((s) => s.toLowerCase().includes(q)) }))
      .filter((c) => c.sites.length > 0)
  }, [q])

  const totalMatches = filtered.reduce((n, c) => n + c.sites.length, 0)

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-md mx-auto">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 1,000+ sites — e.g. YouTube, TikTok, HLS…"
          className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none transition-colors"
        />
      </div>

      {q && (
        <p className="text-center text-sm text-[var(--text-3)]">
          {totalMatches} match{totalMatches !== 1 ? 'es' : ''} for “{query}”
        </p>
      )}

      {/* Categories */}
      <div className="space-y-5">
        {filtered.map((cat) => {
          const isOpen = expanded[cat.name] || !!q
          const visible = isOpen ? cat.sites : cat.sites.slice(0, PREVIEW_COUNT)
          const hidden = cat.sites.length - PREVIEW_COUNT
          return (
            <div key={cat.name} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border)]">
                <Globe2 size={15} className="text-[var(--brand)]" />
                <h2 className="font-bold text-[var(--text)] text-sm">{cat.name}</h2>
                <span className="text-[11px] text-[var(--text-3)] ml-1">{cat.sites.length}</span>
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {visible.map((s) => (
                  <span key={s}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-hover)] text-[var(--text-2)] border border-[var(--border)]">
                    {s}
                  </span>
                ))}
              </div>
              {!q && hidden > 0 && (
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [cat.name]: !e[cat.name] }))}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--bg-hover)] border-t border-[var(--border)] transition-colors">
                  {isOpen ? <>Show less <ChevronUp size={13} /></> : <>Show {hidden} more <ChevronDown size={13} /></>}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--text-3)]">
          <p className="text-sm">No site matches “{query}” in our list —</p>
          <p className="text-sm mt-1">but try it anyway! Our headless-browser engine can grab media from almost any page.</p>
        </div>
      )}

      {/* Note + CTA */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900/30 to-violet-900/20 border border-indigo-800/30 text-center">
        <p className="text-[var(--text-2)] text-sm leading-relaxed mb-4">
          Don't see your site? It very likely still works. MediaDL falls back to a
          real headless browser that renders the page and captures the media stream —
          including hidden URLs that only appear in the network tab.
        </p>
        <Link href="/download"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-bold text-sm rounded-xl transition-colors">
          Try any URL now <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  )
}
