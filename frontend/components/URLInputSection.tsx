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
import type { AnalyzeResult, PlaylistInfo, DownloadMode, Job, AdvancedOptions as Opts } from '@/lib/types'
import { DEFAULT_ADVANCED } from '@/lib/types'
import { analyzeUrl, analyzePlaylist, queueDownload, previewPage, listPlaylist, fmtDuration, fmtBytes } from '@/lib/api'
import { FileDown, SearchCheck } from 'lucide-react'
import { toast } from 'sonner'

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
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => { setInfo(null); setPlInfo(null); setError('') }, [])
  const isPlaylistMode = mode === 'playlist' || mode === 'profile'

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
      const mediaType = isPlaylistMode ? (mode === 'profile' ? 'profile' : 'playlist')
                      : info?.type === 'image'   ? 'image'
                      : info?.type === 'file'    ? 'file'
                      : info?.type === 'torrent' ? 'torrent'
                      : info?.type === 'page'    ? 'page'
                      : 'video'
      const { jobId } = await queueDownload({
        url: u, mediaType, format,
        quality: mediaType === 'video' || isPlaylistMode ? quality : undefined,
        title: plInfo?.title ?? info?.title, thumbnail: plInfo?.thumbnail ?? info?.thumbnail,
        maxItems: opts.maxItems, startIndex: 1,
        subtitles: opts.subtitles, subtitleLang: opts.subtitleLang,
        embedThumbnail: opts.embedThumbnail, embedMetadata: opts.embedMetadata,
        cookies: opts.cookies || undefined, proxy: opts.proxy || undefined,
        capture: opts.capture,
        startTime: opts.startTime || undefined, endTime: opts.endTime || undefined,
        delaySeconds: opts.scheduleMinutes ? opts.scheduleMinutes * 60 : undefined,
        repeatEvery: opts.repeatEvery || undefined,
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

      {/* Search mode → web/file/image/video search */}
      {mode === 'search' && <SearchPanel onQueued={onQueued} />}

      {/* URL bar */}
      {mode !== 'batch' && mode !== 'search' && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => { setUrl(e.target.value); reset() }}
              onKeyDown={(e) => e.key === 'Enter' && analyze()}
              onPaste={(e) => {
                const p = e.clipboardData.getData('text').trim()
                if (p.startsWith('http') && !url) { e.preventDefault(); setUrl(p); reset(); setTimeout(() => analyze(p), 50) }
              }}
              placeholder={placeholder || (isPlaylistMode ? 'Paste playlist, channel, or profile URL…' : 'Paste any video or image URL — auto-analyzes on paste')}
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
      {mode !== 'batch' && mode !== 'search' && (
        <AdvancedOptions opts={opts} onChange={setOpts} showPlaylistOptions={isPlaylistMode || !!plInfo} />
      )}

      {/* Platform grid */}
      {mode !== 'search' && <PlatformGrid onSelect={handlePlatformSelect} />}

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
