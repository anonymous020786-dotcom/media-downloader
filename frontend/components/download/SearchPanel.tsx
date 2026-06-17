'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Search, Download, Loader2, Globe, FileText, ImageIcon, Film,
  ExternalLink, Magnet, Newspaper, Copy, Check, Rss, Play, Shield, ShieldOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { searchWeb, queueDownload, type SearchResult } from '@/lib/api'
import type { Job } from '@/lib/types'

type Kind = 'web' | 'file' | 'image' | 'video' | 'torrent' | 'news'

const KINDS: { key: Kind; label: string; icon: React.ReactNode }[] = [
  { key: 'web',     label: 'Web',     icon: <Globe     size={13} /> },
  { key: 'file',    label: 'Files',   icon: <FileText  size={13} /> },
  { key: 'image',   label: 'Images',  icon: <ImageIcon size={13} /> },
  { key: 'video',   label: 'Videos',  icon: <Film      size={13} /> },
  { key: 'torrent', label: 'Torrent', icon: <Magnet    size={13} /> },
  { key: 'news',    label: 'News',    icon: <Newspaper size={13} /> },
]

const FILE_TYPES = [
  'pdf','zip','rar','7z','tar','gz',
  'mp3','mp4','mkv','avi','mov','flac','wav','aac','opus','ogg',
  'doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp',
  'epub','mobi','azw3',
  'apk','exe','dmg','iso','img',
  'csv','txt','json','xml','sql',
  'jpg','png','gif','webp','svg','psd','ai','xcf',
  'torrent',
]

interface Props {
  onQueued: (jobId: string, job: Omit<Job, 'progress' | 'bullId'>) => void
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" onClick={copy}
      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
        bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

function SeedBar({ seeds, leechers }: { seeds?: string; leechers?: string }) {
  const s = parseInt(seeds ?? '0') || 0
  const l = parseInt(leechers ?? '0') || 0
  if (!s && !l) return null
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-emerald-400 font-mono">{s} ↑</span>
      <span className="text-red-400 font-mono">{l} ↓</span>
    </div>
  )
}

function timeAgo(d?: string) {
  if (!d) return ''
  const ts = isNaN(Number(d)) ? +new Date(d) : Number(d) * 1000
  const s = (Date.now() - ts) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function SearchPanel({ onQueued }: Props) {
  const [kind,     setKind]     = useState<Kind>('web')
  const [filetype, setFiletype] = useState('pdf')
  const [query,    setQuery]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [more,     setMore]     = useState(false)
  const [error,    setError]    = useState('')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [page,     setPage]     = useState(1)
  const [hasMore,  setHasMore]  = useState(false)
  const [total,    setTotal]    = useState<number | null>(null)
  const [safe,     setSafe]     = useState(false)   // SafeSearch off by default (unfiltered)

  async function fetchPage(nextPage: number, reset: boolean) {
    const q = query.trim()
    if (!q) return
    reset ? setLoading(true) : setMore(true)
    setError('')
    if (reset) { setResults([]); setTotal(null) }
    try {
      const r = await searchWeb(q, kind, kind === 'file' ? filetype : undefined, nextPage, 30, safe)
      setResults((prev) => {
        const merged = reset ? r.results : [...prev, ...r.results]
        const seen = new Set<string>()
        return merged.filter((x) => x.url && !seen.has(x.url) && seen.add(x.url))
      })
      setPage(nextPage)
      setHasMore(r.has_more)
      if (r.total != null) setTotal(r.total)
      if (reset && r.results.length === 0) setError('No results — try different keywords or another search type.')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false); setMore(false) }
  }

  const run      = () => fetchPage(1, true)
  const loadMore = () => fetchPage(page + 1, false)

  // Re-run the current search when SafeSearch is toggled (skip initial mount).
  const safeMounted = useRef(false)
  useEffect(() => {
    if (!safeMounted.current) { safeMounted.current = true; return }
    if (query.trim()) fetchPage(1, true)
  }, [safe]) // eslint-disable-line react-hooks/exhaustive-deps

  async function download(r: SearchResult) {
    try {
      const mediaType = kind === 'image' ? 'image' : kind === 'video' || kind === 'torrent' ? 'video' : 'file'
      const fmt = mediaType === 'image' ? 'original' : mediaType === 'video' ? 'mp4' : 'original'
      const url = r.magnet || r.url
      const { jobId } = await queueDownload({
        url, mediaType, format: fmt,
        quality: mediaType === 'video' ? 'best' : undefined,
        title: r.title,
      })
      onQueued(jobId, {
        jobId, url, mediaType: mediaType as any, format: fmt,
        quality: mediaType === 'video' ? 'best' : undefined,
        title: r.title, thumbnail: r.thumbnail, addedAt: Date.now(),
      })
      toast.success('Added to queue', { description: r.title || url })
    } catch (e: any) { toast.error(e.message) }
  }

  const switchKind = (k: Kind) => { setKind(k); setResults([]); setHasMore(false); setPage(1); setTotal(null) }

  return (
    <div className="space-y-4">
      {/* Kind tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-fit flex-wrap">
        {KINDS.map((k) => (
          <button type="button" key={k.key} onClick={() => switchKind(k.key)}
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
            placeholder={
              kind === 'file'    ? `Search for ${filetype.toUpperCase()} files…`
            : kind === 'torrent' ? 'Search torrents (1337x + Nyaa.si)…'
            : kind === 'news'    ? 'Search news from the web…'
            : kind === 'image'   ? 'Search for images…'
            : kind === 'video'   ? 'Search for videos…'
            : 'Search the web…'
            }
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl pl-10 pr-4 py-3.5 text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none transition-colors"
          />
        </div>
        {kind === 'file' && (
          <select value={filetype} onChange={(e) => setFiletype(e.target.value)}
            title="File type filter" aria-label="File type filter"
            className="bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl px-3 py-3.5 text-sm text-[var(--text)] outline-none">
            {FILE_TYPES.map((t) => <option key={t} value={t}>.{t}</option>)}
          </select>
        )}
        <button type="button" onClick={run} disabled={!query.trim() || loading}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Search
        </button>
      </div>

      {/* SafeSearch toggle */}
      {kind !== 'torrent' && (
        <button type="button"
          onClick={() => setSafe((s) => !s)}
          title="Toggle SafeSearch filtering"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors w-fit ${
            safe ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                 : 'border-amber-500/40 text-amber-400 bg-amber-500/10'}`}>
          {safe ? <Shield size={12} /> : <ShieldOff size={12} />}
          SafeSearch: {safe ? 'On (filtered)' : 'Off (unfiltered — adult shown)'}
        </button>
      )}

      {kind === 'torrent' ? (
        <p className="text-[10px] text-[var(--text-3)] flex items-center gap-1.5">
          <Magnet size={10} className="text-orange-400" />
          Powered by 1337x &amp; Nyaa.si — use magnet links or click Download to fetch the torrent.
        </p>
      ) : kind === 'news' ? (
        <p className="text-[10px] text-[var(--text-3)] flex items-center gap-1.5">
          <Rss size={10} className="text-orange-400" />
          News from DuckDuckGo — unlimited results cached for 30 min. Click Download to save the article.
        </p>
      ) : (
        <p className="text-[10px] text-[var(--text-3)]">
          {kind === 'file'
            ? `Powered by DuckDuckGo filetype: search — finds real ${filetype.toUpperCase()} files across the web.`
            : 'Multi-engine search (DDG + Bing fallback). Up to 200 results cached — pages load instantly.'}
        </p>
      )}

      {error && <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">{error}</div>}

      {/* Torrent results */}
      {kind === 'torrent' && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors space-y-2">
              <div className="flex items-start gap-3">
                <Magnet size={14} className="text-orange-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] leading-snug">{r.title || r.url}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {r.size && <span className="text-[11px] text-[var(--text-3)] font-mono">{r.size}</span>}
                    <SeedBar seeds={r.seeds} leechers={r.leechers} />
                    {r.source && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-3)] border border-[var(--border)]">{r.source}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap pl-5">
                {r.magnet && <CopyButton text={r.magnet} label="Magnet" />}
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                  <ExternalLink size={11} /> Info
                </a>
                <button type="button" onClick={() => download(r)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors">
                  <Download size={11} /> Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* News results */}
      {kind === 'news' && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors">
              {r.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.thumbnail} alt="" className="w-20 h-16 object-cover rounded-lg shrink-0" loading="lazy" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text)] leading-snug line-clamp-2">{r.title || r.url}</p>
                <p className="text-[11px] text-[var(--text-3)] mt-1 line-clamp-2">{r.snippet}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {r.source && <span className="text-[10px] text-[var(--brand)] font-medium">{r.source}</span>}
                  {r.date && <span className="text-[10px] text-[var(--text-3)]">{timeAgo(r.date)}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                  <ExternalLink size={11} /> Open
                </a>
                <button type="button" onClick={() => download(r)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors">
                  <Download size={11} /> Save
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image results */}
      {kind === 'image' && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {results.map((r, i) => (
            <div key={i} className="group relative rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.thumbnail || r.url} alt={r.title} className="w-full h-full object-cover" loading="lazy" />
              <button type="button" onClick={() => download(r)}
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-all">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"><Download size={13} /> Download</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Web / file / video results */}
      {(kind === 'web' || kind === 'file' || kind === 'video') && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors">
              {r.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.thumbnail} alt="" className="w-16 h-12 object-cover rounded-lg shrink-0" loading="lazy" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text)] truncate">{r.title || r.url}</p>
                <p className="text-[11px] text-[var(--text-3)] truncate">{r.snippet || r.url}</p>
                {r.duration && <span className="text-[10px] text-[var(--text-3)]">{r.duration}</span>}
              </div>
              <a href={`/player?url=${encodeURIComponent(r.source || r.url)}`} target="_blank" rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors" title="Play in the in-app player">
                <Play size={13} /> Play
              </a>
              <a href={r.source || r.url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 p-2 rounded-lg text-[var(--text-3)] hover:text-[var(--text)]" title="Open source">
                <ExternalLink size={14} />
              </a>
              <button type="button" onClick={() => download(r)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors">
                <Download size={13} /> Download
              </button>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-[10px] text-[var(--text-3)]">
            {results.length} result{results.length !== 1 ? 's' : ''}
            {total != null && total > results.length ? ` of ${total} cached` : ''}
          </p>
          {hasMore ? (
            <button type="button" onClick={loadMore} disabled={more}
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
