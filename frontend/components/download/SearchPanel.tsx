'use client'
import { useState } from 'react'
import { Search, Download, Loader2, Globe, FileText, ImageIcon, Film, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { searchWeb, queueDownload, type SearchResult } from '@/lib/api'
import type { Job } from '@/lib/types'

type Kind = 'web' | 'file' | 'image' | 'video'

const KINDS: { key: Kind; label: string; icon: React.ReactNode }[] = [
  { key: 'web',   label: 'Web',    icon: <Globe size={13} /> },
  { key: 'file',  label: 'Files',  icon: <FileText size={13} /> },
  { key: 'image', label: 'Images', icon: <ImageIcon size={13} /> },
  { key: 'video', label: 'Videos', icon: <Film size={13} /> },
]

const FILE_TYPES = ['pdf','zip','mp3','mp4','doc','docx','xls','xlsx','ppt','pptx','epub','apk','csv','txt']

interface Props {
  onQueued: (jobId: string, job: Omit<Job, 'progress' | 'bullId'>) => void
}

export default function SearchPanel({ onQueued }: Props) {
  const [kind, setKind]       = useState<Kind>('web')
  const [filetype, setFiletype] = useState('pdf')
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [more, setMore]       = useState(false)
  const [error, setError]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(false)

  async function fetchPage(nextPage: number, reset: boolean) {
    const q = query.trim()
    if (!q) return
    reset ? setLoading(true) : setMore(true)
    setError('')
    if (reset) setResults([])
    try {
      const r = await searchWeb(q, kind, kind === 'file' ? filetype : undefined, nextPage)
      setResults((prev) => {
        const merged = reset ? r.results : [...prev, ...r.results]
        const seen = new Set<string>()
        return merged.filter((x) => x.url && !seen.has(x.url) && seen.add(x.url))
      })
      setPage(nextPage)
      setHasMore(r.has_more)
      if (reset && r.results.length === 0) setError('No results — try different keywords.')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false); setMore(false) }
  }

  const run = () => fetchPage(1, true)
  const loadMore = () => fetchPage(page + 1, false)

  async function download(r: SearchResult) {
    try {
      const mediaType = kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'file'
      const fmt = mediaType === 'image' ? 'original' : mediaType === 'video' ? 'mp4' : 'original'
      const { jobId } = await queueDownload({
        url: r.url, mediaType, format: fmt,
        quality: mediaType === 'video' ? 'best' : undefined,
        title: r.title,
      })
      onQueued(jobId, {
        jobId, url: r.url, mediaType: mediaType as any, format: fmt,
        quality: mediaType === 'video' ? 'best' : undefined,
        title: r.title, thumbnail: r.thumbnail, addedAt: Date.now(),
      })
      toast.success('Added to queue', { description: r.title || r.url })
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      {/* Kind tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-fit">
        {KINDS.map((k) => (
          <button key={k.key} onClick={() => { setKind(k.key); setResults([]); setHasMore(false); setPage(1) }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              kind === k.key ? 'bg-[var(--bg-hover)] text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
            {k.icon} {k.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder={kind === 'file' ? `Search the web for ${filetype.toUpperCase()} files…` : `Search the web for ${kind}…`}
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl pl-10 pr-4 py-3.5 text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none transition-colors"
          />
        </div>
        {kind === 'file' && (
          <select value={filetype} onChange={(e) => setFiletype(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl px-3 py-3.5 text-sm text-[var(--text)] outline-none">
            {FILE_TYPES.map((t) => <option key={t} value={t}>.{t}</option>)}
          </select>
        )}
        <button onClick={run} disabled={!query.trim() || loading}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Search
        </button>
      </div>

      <p className="text-[10px] text-[var(--text-3)]">
        Powered by DuckDuckGo — no API key, no tracking. Results open the source; click Download to fetch the file through MediaDL.
      </p>

      {error && <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">{error}</div>}

      {/* Results */}
      {kind === 'image' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {results.map((r, i) => (
            <div key={i} className="group relative rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.thumbnail || r.url} alt={r.title} className="w-full h-full object-cover" loading="lazy" />
              <button onClick={() => download(r)}
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-all">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"><Download size={13} /> Download</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors">
              {r.thumbnail && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={r.thumbnail} alt="" className="w-16 h-12 object-cover rounded-lg shrink-0" loading="lazy" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text)] truncate">{r.title || r.url}</p>
                <p className="text-[11px] text-[var(--text-3)] truncate">{r.snippet || r.url}</p>
              </div>
              <a href={r.source || r.url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 p-2 rounded-lg text-[var(--text-3)] hover:text-[var(--text)]" title="Open source">
                <ExternalLink size={14} />
              </a>
              <button onClick={() => download(r)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors">
                <Download size={13} /> Download
              </button>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-[10px] text-[var(--text-3)]">{results.length} results</p>
          {hasMore ? (
            <button onClick={loadMore} disabled={more}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--brand)] text-sm font-medium text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-40 transition-colors">
              {more ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {more ? 'Loading…' : 'Load more results'}
            </button>
          ) : (
            <p className="text-[10px] text-[var(--text-3)]">— end of results —</p>
          )}
        </div>
      )}
    </div>
  )
}
