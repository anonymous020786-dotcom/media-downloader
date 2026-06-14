'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthContext'
import {
  History, RefreshCw, Trash2, Film, ImageIcon, FileDown, Globe, List,
  LogIn, Download, Search, X, FileText, TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { fetchHistory, clearHistory, type HistoryRow } from '@/lib/api'

const TYPE_FILTERS = [
  { key: 'all',     label: 'All'    },
  { key: 'video',   label: 'Video'  },
  { key: 'image',   label: 'Image'  },
  { key: 'page',    label: 'Page'   },
  { key: 'file',    label: 'File'   },
] as const

function TypeIcon({ t }: { t: string }) {
  if (t === 'video' || t === 'playlist' || t === 'profile') return <Film size={13} className="text-blue-400 shrink-0" />
  if (t === 'image') return <ImageIcon size={13} className="text-cyan-400 shrink-0" />
  if (t === 'file' || t === 'torrent') return <FileDown size={13} className="text-amber-400 shrink-0" />
  if (t === 'page') return <Globe size={13} className="text-slate-400 shrink-0" />
  return <List size={13} className="text-violet-400 shrink-0" />
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000 && d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: now.getFullYear() !== d.getFullYear() ? 'numeric' : undefined })
}

function groupByDate(rows: HistoryRow[]) {
  const groups = new Map<string, HistoryRow[]>()
  for (const r of rows) {
    const key = formatDate(r.created_at)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  return Array.from(groups.entries())
}

function exportCSV(rows: HistoryRow[]) {
  const header = ['Date', 'URL', 'Type', 'Format']
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        new Date(r.created_at).toISOString(),
        `"${r.url.replace(/"/g, '""')}"`,
        r.media_type,
        r.format,
      ].join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `mediadl-history-${Date.now()}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function HistoryPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const [rows,    setRows]    = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const load = async () => {
    setLoading(true)
    try { setRows(await fetchHistory()) } catch {} finally { setLoading(false) }
  }
  useEffect(() => { if (isLoaded && isSignedIn) load(); else if (isLoaded) setLoading(false) }, [isLoaded, isSignedIn])

  const clear = async () => {
    if (!confirm('Clear your entire download history?')) return
    try { await clearHistory(); setRows([]); toast.success('History cleared') } catch (e: any) { toast.error(e.message) }
  }

  const filtered = useMemo(() => {
    let r = rows
    if (typeFilter !== 'all') {
      r = r.filter((x) => {
        if (typeFilter === 'video') return ['video','playlist','profile'].includes(x.media_type)
        return x.media_type === typeFilter
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((x) => x.url.toLowerCase().includes(q))
    }
    return r
  }, [rows, typeFilter, search])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  // Quick stats
  const statsToday = useMemo(() => {
    const today = new Date().toDateString()
    return rows.filter((r) => new Date(r.created_at).toDateString() === today).length
  }, [rows])
  const statsVideos = useMemo(() => rows.filter((r) => ['video','playlist','profile'].includes(r.media_type)).length, [rows])
  const statsImages = useMemo(() => rows.filter((r) => r.media_type === 'image').length, [rows])

  if (isLoaded && !isSignedIn) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <History size={40} strokeWidth={1.2} className="mx-auto mb-4 text-[var(--text-3)]" />
        <h1 className="text-2xl font-black text-[var(--text)] mb-2">Sign in to see your history</h1>
        <p className="text-[var(--text-2)] mb-6">Your download history is private to your account.</p>
        <Link href="/sign-in" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white font-semibold text-sm">
          <LogIn size={15}/> Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)] flex items-center gap-2">
            <History size={26} className="text-[var(--brand)]"/> Download History
          </h1>
          <p className="text-sm text-[var(--text-3)] mt-1">{rows.length} download{rows.length !== 1 ? 's' : ''} on your account</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={load} title="Refresh" className={`p-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors ${loading ? 'animate-spin' : ''}`}>
            <RefreshCw size={15}/>
          </button>
          {rows.length > 0 && (
            <button
              onClick={() => exportCSV(rows)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-emerald-400 text-sm transition-colors"
              title="Export as CSV"
            >
              <FileText size={13}/> Export CSV
            </button>
          )}
          {rows.length > 0 && (
            <button onClick={clear} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-red-400 text-sm transition-colors">
              <Trash2 size={13}/> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',   value: rows.length,   color: 'text-[var(--text)]' },
            { label: 'Today',   value: statsToday,    color: 'text-indigo-400' },
            { label: 'Videos',  value: statsVideos,   color: 'text-blue-400' },
            { label: 'Images',  value: statsImages,   color: 'text-cyan-400' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
              <span className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</span>
              <span className="text-[11px] text-[var(--text-3)] mt-0.5">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search + filter */}
      {rows.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search URLs…"
              className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl pl-9 pr-8 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text-2)]">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === f.key
                    ? 'bg-[var(--bg-hover)] text-[var(--text)]'
                    : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <div className="text-center py-20 text-[var(--text-3)]">
          <Download size={40} strokeWidth={1.2} className="mx-auto mb-3" />
          <p className="text-sm mb-2">No downloads yet</p>
          <Link href="/download" className="text-sm text-[var(--brand)] underline">Start your first download</Link>
        </div>
      )}

      {/* No results after filter */}
      {!loading && rows.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--text-3)]">
          <Search size={32} strokeWidth={1.2} className="mx-auto mb-2" />
          <p className="text-sm">No results for <strong className="text-[var(--text-2)]">"{search}"</strong></p>
          <button onClick={() => { setSearch(''); setTypeFilter('all') }} className="mt-2 text-xs text-[var(--brand)] underline">
            Clear filters
          </button>
        </div>
      )}

      {/* Grouped results */}
      {grouped.length > 0 && (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold text-[var(--text-3)] uppercase tracking-widest">{date}</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-[10px] text-[var(--text-3)]">{items.length}</span>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)] overflow-hidden">
                {items.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors group">
                    <TypeIcon t={r.media_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text)] truncate" title={r.url}>{r.url}</p>
                      <p className="text-[11px] text-[var(--text-3)]">
                        {new Date(r.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[var(--bg-hover)] text-[var(--text-2)] shrink-0">
                      {r.format}
                    </span>
                    <Link
                      href={`/download?url=${encodeURIComponent(r.url)}`}
                      className="shrink-0 p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--brand)] opacity-0 group-hover:opacity-100 transition-all"
                      title="Download again"
                    >
                      <Download size={14}/>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-center text-xs text-[var(--text-3)]">
          Showing {filtered.length} of {rows.length} downloads
          {(search || typeFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setTypeFilter('all') }} className="ml-2 text-[var(--brand)] underline">
              clear filters
            </button>
          )}
        </p>
      )}
    </div>
  )
}
