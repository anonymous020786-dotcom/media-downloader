'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import {
  Link2, Search, Download, X, Clock, Users, Film, ImageIcon, Globe,
  AlertCircle, Layers, Radio, Music, Zap, List, User, Hash, Grid3x3, Headphones,
} from 'lucide-react'
import FormatSelector from './FormatSelector'
import BulkModal from './BulkModal'
import PlatformGrid from './PlatformGrid'
import AdvancedOptions from './AdvancedOptions'
import MediaPreviewGrid, { type PreviewItem } from './download/MediaPreviewGrid'
import SearchPanel from './download/SearchPanel'
import type { AnalyzeResult, PlaylistInfo, DownloadMode, Job, AdvancedOptions as Opts, FeedResult, FeedItem } from '@/lib/types'
import { DEFAULT_ADVANCED } from '@/lib/types'
import { analyzeUrl, analyzePlaylist, queueDownload, previewPage, listPlaylist, fmtDuration, fmtBytes, parseFeed, batchDownload } from '@/lib/api'
import { getRecaptchaToken } from '@/lib/recaptcha'
import { FileDown, SearchCheck, Rss, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

const RECENT_KEY = 'mediadl_recent_urls'
const MAX_RECENT = 10

function loadRecentUrls(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}

function saveRecentUrl(url: string) {
  if (typeof window === 'undefined') return
  const prev = loadRecentUrls().filter((u) => u !== url)
  localStorage.setItem(RECENT_KEY, JSON.stringify([url, ...prev].slice(0, MAX_RECENT)))
}

interface Props {
  onQueued: (jobId: string, job: Omit<Job, 'progress' | 'bullId'>) => void
  initialUrl?: string
}

const MODES: { key: DownloadMode; label: string; icon: React.ReactNode; hint: string }[] = [
  { key: 'single',   label: 'Single',   icon: <Download size={12}/>, hint: 'One video or image' },
  { key: 'playlist', label: 'Playlist', icon: <List size={12}/>,     hint: 'Full playlist / channel' },
  { key: 'profile',  label: 'Profile',  icon: <User size={12}/>,     hint: 'All posts from a profile' },
  { key: 'batch',    label: 'Batch',    icon: <Layers size={12}/>,   hint: 'Multiple URLs at once' },
  { key: 'search',   label: 'Search',   icon: <SearchCheck size={12}/>, hint: 'Find files on the web & download' },
  { key: 'feed',     label: 'Feed',     icon: <Rss size={12}/>,      hint: 'Download from RSS, Atom, or M3U/IPTV feed' },
]

const PLATFORM_MAP: { host: string; name: string; color: string }[] = [
  { host: 'youtube.com',      name: 'YouTube',     color: 'text-red-400'     },
  { host: 'youtu.be',         name: 'YouTube',     color: 'text-red-400'     },
  { host: 'tiktok.com',       name: 'TikTok',      color: 'text-pink-400'    },
  { host: 'instagram.com',    name: 'Instagram',   color: 'text-purple-400'  },
  { host: 'twitter.com',      name: 'Twitter/X',   color: 'text-sky-400'     },
  { host: 'x.com',            name: 'Twitter/X',   color: 'text-sky-400'     },
  { host: 'facebook.com',     name: 'Facebook',    color: 'text-blue-400'    },
  { host: 'fb.watch',         name: 'Facebook',    color: 'text-blue-400'    },
  { host: 'reddit.com',       name: 'Reddit',      color: 'text-orange-400'  },
  { host: 'twitch.tv',        name: 'Twitch',      color: 'text-violet-400'  },
  { host: 'vimeo.com',        name: 'Vimeo',       color: 'text-cyan-400'    },
  { host: 'soundcloud.com',   name: 'SoundCloud',  color: 'text-amber-400'   },
  { host: 'pinterest.com',    name: 'Pinterest',   color: 'text-red-500'     },
  { host: 'spotify.com',      name: 'Spotify',     color: 'text-emerald-400' },
  { host: 'dailymotion.com',  name: 'Dailymotion', color: 'text-blue-500'    },
  { host: 'bilibili.com',     name: 'Bilibili',    color: 'text-sky-400'     },
  { host: 'rumble.com',       name: 'Rumble',      color: 'text-green-400'   },
  { host: 'odysee.com',       name: 'Odysee',      color: 'text-indigo-400'  },
]

function detectPlatform(u: string) {
  if (!u) return null
  try {
    const host = new URL(u).hostname.replace('www.', '')
    return PLATFORM_MAP.find((p) => host === p.host || host.endsWith('.' + p.host)) ?? null
  } catch { return null }
}

export default function URLInputSection({ onQueued, initialUrl = '' }: Props) {
  const [mode,        setMode]        = useState<DownloadMode>('single')
  const [url,         setUrl]         = useState(initialUrl)
  const [placeholder, setPlaceholder] = useState('')
  const [analyzing,   setAnalyzing]   = useState(false)
  const [error,       setError]       = useState('')
  const [info,        setInfo]        = useState<AnalyzeResult | null>(null)
  const [plInfo,      setPlInfo]      = useState<PlaylistInfo | null>(null)
  const [format,      setFormat]      = useState('mp4')
  const [quality,     setQuality]     = useState('best')
  const [queueing,    setQueueing]    = useState(false)
  const [showBulk,    setShowBulk]    = useState(false)
  const [opts,        setOpts]        = useState<Opts>(DEFAULT_ADVANCED)
  // Preview grid
  const [previewing,  setPreviewing]  = useState(false)
  const [previewItems,setPreviewItems]= useState<PreviewItem[]>([])
  const [previewKind, setPreviewKind] = useState<'image'|'video'>('image')
  const [previewTotal,setPreviewTotal]= useState(0)
  const [previewTitle,setPreviewTitle]= useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [recentUrls,  setRecentUrls]  = useState<string[]>([])
  const [showRecent,  setShowRecent]  = useState(false)
  // Feed mode state
  const [feedResult,  setFeedResult]  = useState<FeedResult | null>(null)
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedSelected,setFeedSelected]= useState<Set<number>>(new Set())
  const [feedFmt,     setFeedFmt]     = useState('mp4')
  const [feedQueing,  setFeedQueing]  = useState(false)
  const inputRef    = useRef<HTMLInputElement>(null)
  const recentRef   = useRef<HTMLDivElement>(null)
  // Clipboard suggestion
  const [clipSuggest, setClipSuggest] = useState('')

  const reset = useCallback(() => { setInfo(null); setPlInfo(null); setError('') }, [])
  const isPlaylistMode = mode === 'playlist' || mode === 'profile'

  // Load recent URLs on mount + close dropdown on outside click
  useEffect(() => {
    setRecentUrls(loadRecentUrls())
    const handler = (e: MouseEvent) => {
      if (recentRef.current && !recentRef.current.contains(e.target as Node)) {
        setShowRecent(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Clipboard URL watcher — when page becomes visible, check clipboard for a URL
  useEffect(() => {
    const checkClip = async () => {
      try {
        if (!navigator?.clipboard?.readText) return
        const text = (await navigator.clipboard.readText()).trim()
        if (text.startsWith('http') && text !== url && text !== clipSuggest) {
          setClipSuggest(text)
        }
      } catch { /* permission denied or unavailable */ }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') checkClip() }
    document.addEventListener('visibilitychange', onVisible)
    // Also check on initial mount (user may have copied before opening the page)
    checkClip()
    return () => document.removeEventListener('visibilitychange', onVisible)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const analyze = useCallback(async (targetUrl?: string) => {
    const u = (targetUrl ?? url).trim()
    if (!u) return
    setInfo(null); setPlInfo(null); setError(''); setAnalyzing(true)
    try {
      if (isPlaylistMode) {
        const r = await analyzePlaylist(u)
        setPlInfo(r); setFormat('mp4'); setQuality('best')
      } else {
        const r = await analyzeUrl(u)
        setInfo(r)
        if (r.type === 'video') { setFormat('mp4'); setQuality('best') }
        else setFormat('original')
        if (r.is_playlist) {
          setMode('playlist')
          const pl = await analyzePlaylist(u)
          setPlInfo(pl); setInfo(null)
        }
      }
      // Save to history after successful analyze
      saveRecentUrl(u)
      setRecentUrls(loadRecentUrls())
    } catch (e: any) { setError(e.message) }
    finally { setAnalyzing(false) }
  }, [url, isPlaylistMode])

  // Auto-analyze if a URL was passed via ?url=
  useEffect(() => {
    if (initialUrl) { setUrl(initialUrl); analyze(initialUrl) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDownload() {
    const u = url.trim()
    if (!u) return
    setQueueing(true)
    try {
      const recaptchaToken = await getRecaptchaToken('download')
      const mediaType = isPlaylistMode ? (mode === 'profile' ? 'profile' : 'playlist')
                      : info?.type === 'image'   ? 'image'
                      : info?.type === 'file'    ? 'file'
                      : info?.type === 'torrent' ? 'torrent'
                      : info?.type === 'page'    ? 'page'
                      : 'video'
      const { jobId } = await queueDownload({
        url: u, mediaType, format,
        recaptchaToken: recaptchaToken ?? undefined,
        quality: mediaType === 'video' || isPlaylistMode ? quality : undefined,
        title: plInfo?.title ?? info?.title, thumbnail: plInfo?.thumbnail ?? info?.thumbnail,
        maxItems: opts.maxItems, startIndex: 1,
        subtitles: opts.subtitles, subtitleLang: opts.subtitleLang,
        embedThumbnail: opts.embedThumbnail, embedMetadata: opts.embedMetadata,
        writeThumbnail: opts.writeThumbnail,
        outputTemplate: opts.outputTemplate || undefined,
        cookies: opts.cookies || undefined, proxy: opts.proxy || undefined,
        capture: opts.capture,
        sponsorBlock: opts.sponsorBlock, splitChapters: opts.splitChapters,
        normalizeAudio: opts.normalizeAudio,
        speedLimit: opts.speedLimit || undefined,
        concurrentFragments: opts.concurrentFragments,
        startTime: opts.startTime || undefined, endTime: opts.endTime || undefined,
        delaySeconds: opts.scheduleMinutes ? opts.scheduleMinutes * 60 : undefined,
        repeatEvery: opts.repeatEvery || undefined,
        webhookUrl: opts.webhookUrl || undefined,
      })
      onQueued(jobId, {
        jobId, url: u, mediaType, format,
        quality: mediaType === 'video' || isPlaylistMode ? quality : undefined,
        title: plInfo?.title ?? info?.title, thumbnail: plInfo?.thumbnail ?? info?.thumbnail,
        addedAt: Date.now(), maxItems: opts.maxItems ?? undefined,
        subtitles: opts.subtitles, embedThumbnail: opts.embedThumbnail,
      })
      setUrl(''); reset()
    } catch (e: any) { setError(e.message) }
    finally { setQueueing(false) }
  }

  // ── Preview & select flow ─────────────────────────────────────────────────
  async function handlePreview() {
    const u = url.trim()
    if (!u) return
    setError(''); setAnalyzing(true)
    try {
      if (isPlaylistMode || plInfo) {
        const r = await listPlaylist(u)
        setPreviewItems(r.items.map((it) => ({ url: it.url, title: it.title, thumbnail: it.thumbnail, duration: it.duration, type: 'video' })))
        setPreviewKind('video'); setPreviewTotal(r.total); setPreviewTitle(r.title)
      } else {
        const r = await previewPage(u)
        setPreviewItems(r.items.map((it) => ({ url: it.url, type: 'image' })))
        setPreviewKind('image'); setPreviewTotal(r.total); setPreviewTitle(r.page_title || `${r.total} images found`)
      }
      setShowPreview(true)
    } catch (e: any) { setError(e.message) }
    finally { setAnalyzing(false) }
  }

  async function handlePreviewConfirm(selected: PreviewItem[]) {
    for (const item of selected) {
      try {
        const mt = item.type === 'video' ? 'video' : 'image'
        const fmt = mt === 'video' ? (format === 'original' ? 'mp4' : format) : (format === 'mp4' ? 'original' : format)
        const { jobId } = await queueDownload({
          url: item.url, mediaType: mt, format: fmt,
          quality: mt === 'video' ? quality : undefined,
          title: item.title, thumbnail: item.thumbnail,
          cookies: opts.cookies || undefined, proxy: opts.proxy || undefined,
        })
        onQueued(jobId, {
          jobId, url: item.url, mediaType: mt, format: fmt,
          quality: mt === 'video' ? quality : undefined,
          title: item.title, thumbnail: item.thumbnail, addedAt: Date.now(),
        })
      } catch { /* skip & continue */ }
    }
    setShowPreview(false); setUrl(''); reset()
  }

  async function handleBulk(urls: string[]) {
    // De-dupe, then queue in parallel with bounded concurrency so large lists
    // (hundreds of URLs) process fast without overwhelming the analyzer.
    const list = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)))
    const CONCURRENCY = 6
    let ok = 0, fail = 0, i = 0
    async function worker() {
      while (i < list.length) {
        const u = list[i++]
        try {
          const r = await analyzeUrl(u)
          const fmt = r.type === 'video' ? 'mp4' : 'original'
          const { jobId } = await queueDownload({
            url: u, mediaType: r.type, format: fmt,
            quality: r.type === 'video' ? 'best' : undefined,
            title: r.title, thumbnail: r.thumbnail,
            cookies: opts.cookies || undefined, proxy: opts.proxy || undefined,
          })
          onQueued(jobId, {
            jobId, url: u, mediaType: r.type, format: fmt,
            quality: r.type === 'video' ? 'best' : undefined,
            title: r.title, thumbnail: r.thumbnail, addedAt: Date.now(),
          })
          ok++
        } catch { fail++ }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker))
    toast[fail && !ok ? 'error' : 'success'](
      `Queued ${ok} of ${list.length}${fail ? ` · ${fail} failed` : ''}`)
  }

  function handlePlatformSelect(ph: string, defaultFmt: string) {
    setPlaceholder(ph); setFormat(defaultFmt); reset(); inputRef.current?.focus()
  }

  const canDownload   = !!(url.trim() && (info || plInfo))
  const canPreview    = !!(url.trim() && (plInfo || isPlaylistMode || info?.type === 'page'))
  const platform      = detectPlatform(url)
  const isFeedMode    = mode === 'feed'

  // Feed mode handlers
  async function handleFeedLoad() {
    const u = url.trim()
    if (!u) return
    setFeedLoading(true); setFeedResult(null); setFeedSelected(new Set()); setError('')
    try {
      const r = await parseFeed(u)
      setFeedResult(r)
      // Pre-select all items
      setFeedSelected(new Set(r.items.map((_, i) => i)))
    } catch (e: any) { setError(e.message) }
    finally { setFeedLoading(false) }
  }

  async function handleFeedDownload() {
    if (!feedResult) return
    const selected = feedResult.items.filter((_, i) => feedSelected.has(i))
    if (!selected.length) { toast.error('Select at least one item'); return }
    setFeedQueing(true)
    try {
      const items = selected.map((it) => ({ url: it.url, title: it.title, thumbnail: it.thumbnail ?? undefined }))
      const mediaType = feedResult.type === 'm3u' ? 'video' : 'video'
      const { count, jobs } = await batchDownload(items, { mediaType, format: feedFmt, quality: 'best', priority: opts.priority })
      for (const j of jobs) {
        onQueued(j.jobId, {
          jobId: j.jobId, url: j.url, mediaType, format: feedFmt,
          quality: 'best', title: j.title, addedAt: Date.now(),
        })
      }
      toast.success(`Queued ${count} items from feed`)
      setFeedResult(null); setUrl('')
    } catch (e: any) { toast.error(e.message) }
    finally { setFeedQueing(false) }
  }

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-fit">
        {MODES.map((m) => (
          <button key={m.key} onClick={() => { setMode(m.key); reset(); if (m.key==='batch') setShowBulk(true) }}
            title={m.hint}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              mode === m.key ? 'bg-[var(--bg-hover)] text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Clipboard URL suggestion banner */}
      {clipSuggest && !url && mode !== 'search' && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs">
          <Link2 size={12} className="text-indigo-400 shrink-0" />
          <span className="text-indigo-300 flex-1 truncate">Clipboard: <span className="text-indigo-200">{clipSuggest}</span></span>
          <button
            onClick={() => { setUrl(clipSuggest); setClipSuggest(''); reset(); setTimeout(() => analyze(clipSuggest), 50) }}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
            Use
          </button>
          <button type="button" title="Dismiss" onClick={() => setClipSuggest('')} className="shrink-0 text-indigo-500 hover:text-indigo-300 transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Search mode → web/file/image/video search */}
      {mode === 'search' && <SearchPanel onQueued={onQueued} />}

      {/* Feed mode — RSS / Atom / M3U / IPTV */}
      {isFeedMode && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setFeedResult(null); setError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleFeedLoad() }}
              placeholder="Paste RSS, Atom, M3U, or M3U8 feed URL…"
              className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl pl-4 pr-4 py-3.5 text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none transition-colors"
            />
            <button type="button" onClick={handleFeedLoad} disabled={!url.trim() || feedLoading}
              className="flex items-center gap-2 px-5 py-3 bg-[var(--bg-hover)] hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text)] text-sm font-medium rounded-xl border border-[var(--border)] transition-colors">
              {feedLoading ? <span className="w-4 h-4 border-2 border-[var(--text-3)] border-t-[var(--brand)] rounded-full spin" /> : <Rss size={14} />}
              {feedLoading ? 'Fetching…' : 'Load Feed'}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span className="text-xs">{error}</span>
            </div>
          )}

          {feedResult && (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
              {/* Feed header */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <Rss size={14} className="text-amber-400" />
                  <span className="text-sm font-semibold text-[var(--text)] line-clamp-1">
                    {feedResult.feed_title || 'Feed'}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--bg-hover)] text-[var(--text-3)] uppercase">
                    {feedResult.type}
                  </span>
                  <span className="text-[11px] text-[var(--text-3)]">{feedResult.count} items</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => setFeedSelected(feedSelected.size === feedResult.items.length ? new Set() : new Set(feedResult.items.map((_, i) => i)))}
                    className="text-[10px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors px-2 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--border-hover)]">
                    {feedSelected.size === feedResult.items.length ? 'Deselect all' : 'Select all'}
                  </button>
                  <select value={feedFmt} onChange={(e) => setFeedFmt(e.target.value)}
                    title="Output format" aria-label="Output format"
                    className="bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text)] text-xs rounded-lg px-2 py-1 outline-none">
                    {['mp4','webm','mkv','mp3','m4a'].map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>

              {/* Feed items */}
              <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
                {feedResult.items.map((item, idx) => {
                  const checked = feedSelected.has(idx)
                  return (
                    <button type="button" key={idx}
                      onClick={() => {
                        const next = new Set(feedSelected)
                        if (checked) next.delete(idx); else next.add(idx)
                        setFeedSelected(next)
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] ${checked ? 'bg-indigo-950/20' : ''}`}>
                      {checked
                        ? <CheckSquare size={13} className="text-indigo-400 shrink-0" />
                        : <Square size={13} className="text-[var(--text-3)] shrink-0" />}
                      {item.thumbnail && (
                        <Image src={item.thumbnail} alt="" width={40} height={28}
                          className="shrink-0 w-10 h-7 object-cover rounded" unoptimized />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text)] truncate">{item.title || item.url}</p>
                        {item.duration_str && <p className="text-[10px] text-[var(--text-3)]">{item.duration_str}</p>}
                      </div>
                      {item.group && <span className="shrink-0 text-[9px] text-[var(--text-3)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded">{item.group}</span>}
                    </button>
                  )
                })}
              </div>

              {/* Feed download bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-hover)]">
                <span className="text-[11px] text-[var(--text-3)] flex-1">
                  {feedSelected.size} of {feedResult.count} selected
                </span>
                <button type="button" onClick={handleFeedDownload}
                  disabled={feedQueing || feedSelected.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--brand)] to-[var(--accent)] hover:opacity-90 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-all">
                  {feedQueing
                    ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full spin"/>Queueing…</>
                    : <><Download size={13}/>Download {feedSelected.size} items</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* URL bar */}
      {mode !== 'batch' && mode !== 'search' && !isFeedMode && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div
          className="relative flex-1"
          ref={recentRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const dropped = e.dataTransfer.getData('text/plain').trim() || e.dataTransfer.getData('text/uri-list').trim()
            if (dropped.startsWith('http')) { setUrl(dropped); reset(); setTimeout(() => analyze(dropped), 50) }
          }}
        >
            <Link2 size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => { setUrl(e.target.value); reset() }}
              onFocus={() => { if (recentUrls.length > 0 && !url) setShowRecent(true) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { setShowRecent(false); analyze() }
                if (e.key === 'Escape') { setUrl(''); reset(); setShowRecent(false) }
                if (e.key === 'ArrowDown' && showRecent) e.preventDefault()
              }}
              onPaste={(e) => {
                const p = e.clipboardData.getData('text').trim()
                const lines = p.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('http'))
                if (lines.length > 1) {
                  // Multi-URL paste — switch to batch mode
                  e.preventDefault()
                  setMode('batch')
                  setShowBulk(true)
                  setTimeout(() => handleBulk(lines), 100)
                } else if (lines.length === 1 && !url) {
                  e.preventDefault(); setUrl(lines[0]); reset(); setTimeout(() => analyze(lines[0]), 50)
                }
              }}
              placeholder={placeholder || (isPlaylistMode ? 'Paste playlist, channel, or profile URL…' : 'Paste a URL or drag it here — auto-analyzes on paste')}
              className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] hover:border-[var(--border-hover)] rounded-xl pl-10 pr-10 py-3.5 text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none transition-colors"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {platform && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--bg-hover)] ${platform.color}`}>
                  {platform.name}
                </span>
              )}
              {url && (
                <button onClick={() => { setUrl(''); reset() }}
                  className="text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Recent URLs dropdown */}
            {showRecent && recentUrls.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={10} /> Recent
                  </span>
                  <button
                    onClick={() => {
                      localStorage.removeItem(RECENT_KEY)
                      setRecentUrls([])
                      setShowRecent(false)
                    }}
                    className="text-[10px] text-[var(--text-3)] hover:text-red-400 transition-colors px-1">
                    Clear all
                  </button>
                </div>
                {recentUrls.map((u) => {
                  let host = u
                  try { host = new URL(u).hostname.replace('www.', '') } catch {}
                  return (
                    <button key={u}
                      onClick={() => {
                        setUrl(u); reset(); setShowRecent(false)
                        setTimeout(() => analyze(u), 50)
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--bg-hover)] text-left transition-colors group border-b border-[var(--border)] last:border-0">
                      <Clock size={11} className="text-[var(--text-3)] shrink-0" />
                      <span className="text-[11px] text-[var(--text-3)] shrink-0 w-28 truncate">{host}</span>
                      <span className="text-[11px] text-[var(--text-2)] truncate flex-1">{u}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {/* Audio-only quick button */}
          {url.trim() && info?.type === 'video' && (
            <button
              type="button"
              title="Extract audio only as MP3"
              onClick={() => { setFormat('mp3') }}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                format === 'mp3'
                  ? 'bg-pink-600 border-pink-600 text-white'
                  : 'border-[var(--border)] text-[var(--text-3)] hover:text-pink-400 hover:border-pink-600/40'
              }`}
            >
              <Headphones size={14} />
              <span className="hidden sm:inline">Audio</span>
            </button>
          )}
          <button onClick={() => analyze()} disabled={!url.trim() || analyzing}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-[var(--bg-hover)] hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text)] text-sm font-medium rounded-xl border border-[var(--border)] transition-colors">
            {analyzing ? <span className="w-4 h-4 border-2 border-[var(--text-3)] border-t-[var(--brand)] rounded-full spin" /> : <Search size={14} />}
            {analyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="leading-relaxed text-xs">{error}</span>
        </div>
      )}

      {/* Playlist info card */}
      {plInfo && (
        <div className="bg-[var(--bg-card)] border border-violet-800/40 rounded-2xl p-4 space-y-3">
          <div className="flex gap-4">
            {plInfo.thumbnail && (
              <div className="shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-[var(--bg-hover)]">
                <Image src={plInfo.thumbnail} alt="" width={96} height={64} className="object-cover w-full h-full" unoptimized />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-700/60 text-violet-200 uppercase">
                  <List size={9} /> {plInfo.is_channel ? 'Channel' : 'Playlist'}
                </span>
                <span className="text-[10px] text-[var(--text-3)]">{plInfo.extractor}</span>
              </div>
              <p className="text-sm font-semibold text-[var(--text)] line-clamp-1">{plInfo.title}</p>
              <div className="flex gap-3 text-[11px] text-[var(--text-2)]">
                {plInfo.uploader && <span className="flex items-center gap-1"><Users size={10}/>{plInfo.uploader}</span>}
                <span className="flex items-center gap-1 text-violet-400 font-semibold">
                  <Hash size={10}/>{plInfo.item_count.toLocaleString()} items{opts.maxItems ? ` (downloading ${opts.maxItems})` : ''}
                </span>
              </div>
            </div>
          </div>
          <FormatSelector info={{ type:'video', qualities:[], video_formats:['mp4','webm','mkv','mp3','m4a'] } as AnalyzeResult}
            format={format} quality={quality} onFormat={setFormat} onQuality={setQuality} />
        </div>
      )}

      {/* Single media info card */}
      {info && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="p-4 flex gap-4">
            {info.thumbnail && info.type !== 'image' && (
              <div className="shrink-0 w-28 rounded-lg overflow-hidden bg-[var(--bg-hover)]" style={{ height: '72px' }}>
                <Image src={info.thumbnail} alt="" width={112} height={72} className="object-cover w-full h-full" unoptimized />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {info.is_live && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white"><Radio size={9}/>Live</span>}
                {info.is_stream && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-700 text-white"><Zap size={9}/>Stream</span>}
                {!info.is_live && !info.is_stream && info.type === 'video' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-700/60 text-blue-200"><Film size={9}/>Video</span>}
                {info.type === 'image' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-700/60 text-cyan-200"><ImageIcon size={9}/>Image</span>}
                {info.type === 'file'  && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-700/60 text-amber-200"><FileDown size={9}/>File</span>}
                {info.type === 'torrent' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-700/60 text-green-200"><FileDown size={9}/>Torrent</span>}
                {info.type === 'page'  && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300"><Globe size={9}/>Page</span>}
                {info.extractor && <span className="text-[10px] text-[var(--text-3)]">{info.extractor}</span>}
              </div>
              {(info.title || info.filename) && <p className="text-sm font-semibold text-[var(--text)] line-clamp-2 leading-snug">{info.title ?? info.filename}</p>}
              <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-2)]">
                {info.duration && <span className="flex items-center gap-1"><Clock size={10}/>{fmtDuration(info.duration)}</span>}
                {info.uploader && <span className="flex items-center gap-1"><Users size={10}/>{info.uploader}</span>}
                {info.size     && <span>{fmtBytes(info.size)}</span>}
                {info.content_type && info.type === 'file' && <span className="font-mono">{info.content_type}</span>}
                {info.type === 'page' && <span className="text-violet-400">Preview & select images, or download all</span>}
              </div>
            </div>
          </div>
          {/* Files & torrents download as-is (no format chooser); others get format options */}
          {info.type !== 'file' && info.type !== 'torrent' && (
            <div className="px-4 pb-3 border-t border-[var(--border)] pt-3">
              <FormatSelector info={info} format={format} quality={quality} onFormat={setFormat} onQuality={setQuality} />
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {canDownload && mode !== 'batch' && (
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Preview & Select — for pages and playlists */}
          {canPreview && (
            <button onClick={handlePreview} disabled={analyzing}
              className="flex items-center justify-center gap-2 py-3.5 px-5 bg-[var(--bg-hover)] hover:bg-[var(--border)] disabled:opacity-50 text-[var(--text)] font-bold text-sm rounded-xl border border-[var(--border)] transition-all">
              <Grid3x3 size={15} /> Preview & Select
            </button>
          )}
          {/* Download all / direct */}
          <button onClick={handleDownload} disabled={queueing}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[var(--brand)] to-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-900/25">
            {queueing
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full spin"/>Adding…</>
              : <><Download size={15}/>
                {isPlaylistMode && plInfo
                  ? `Download ${opts.maxItems ? opts.maxItems : 'all ' + plInfo.item_count} as ${format.toUpperCase()}`
                  : info?.type === 'page' ? 'Download All Images'
                  : info?.type === 'file' ? 'Download File'
                  : info?.type === 'torrent' ? 'Download Torrent'
                  : `Download as ${format.toUpperCase()}`}
              </>}
          </button>
        </div>
      )}

      {/* Advanced options */}
      {mode !== 'batch' && mode !== 'search' && !isFeedMode && (
        <AdvancedOptions opts={opts} onChange={setOpts} showPlaylistOptions={isPlaylistMode || !!plInfo} />
      )}

      {/* Platform grid */}
      {mode !== 'search' && !isFeedMode && <PlatformGrid onSelect={handlePlatformSelect} />}

      {showBulk && <BulkModal onClose={() => { setShowBulk(false); setMode('single') }} onSubmit={handleBulk} />}

      {showPreview && (
        <MediaPreviewGrid
          items={previewItems} kind={previewKind} total={previewTotal} title={previewTitle} format={format}
          onConfirm={handlePreviewConfirm} onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
