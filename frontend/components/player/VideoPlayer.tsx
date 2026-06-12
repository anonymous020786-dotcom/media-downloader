'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, Download, Loader2,
  PictureInPicture, RefreshCw, ChevronDown, Check,
  AlertCircle, ExternalLink, Film, Music, FileVideo,
} from 'lucide-react'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

// ── Types ─────────────────────────────────────────────────────────────────────
interface Format {
  format_id:   string
  ext:         string
  height?:     number
  width?:      number
  fps?:        number
  filesize?:   number
  tbr?:        number
  abr?:        number
  vbr?:        number
  acodec?:     string
  vcodec?:     string
  format_note?: string
  url?:        string
  protocol?:   string
}

interface AnalyzeResult {
  title?:       string
  thumbnail?:   string
  duration?:    number
  uploader?:    string
  description?: string
  formats?:     Format[]
  url?:         string
  ext?:         string
  is_live?:     boolean
  direct_url?:  string
  error?:       string
}

interface Props {
  initialUrl?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(s: number) {
  if (!isFinite(s)) return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${m}:${String(sec).padStart(2,'0')}`
}

function fmtSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes > 1e9) return `${(bytes/1e9).toFixed(1)} GB`
  if (bytes > 1e6) return `${(bytes/1e6).toFixed(0)} MB`
  return `${(bytes/1e3).toFixed(0)} KB`
}

function fmtLabel(f: Format) {
  if (f.vcodec === 'none' || (!f.height && f.ext === 'mp3')) {
    const q = f.abr ? `${Math.round(f.abr)}kbps` : 'audio'
    return `${f.ext.toUpperCase()} ${q}`
  }
  const res = f.height ? `${f.height}p` : ''
  const fps = f.fps && f.fps > 30 ? `${Math.round(f.fps)}fps` : ''
  return `${f.ext.toUpperCase()} ${res}${fps}`.trim()
}

function bestStreamUrl(result: AnalyzeResult): string | null {
  const d = result.direct_url ?? result.url
  if (d) return d
  if (!result.formats?.length) return null
  // prefer mp4 with video+audio
  const mp4 = result.formats
    .filter(f => f.ext === 'mp4' && f.vcodec !== 'none' && f.acodec !== 'none' && f.url)
    .sort((a,b) => (b.height??0) - (a.height??0))
  return mp4[0]?.url ?? result.formats.find(f => f.url)?.url ?? null
}

function isHls(url: string) { return /\.m3u8/i.test(url) || /application\/x-mpegurl/i.test(url) }
function isDash(url: string) { return /\.mpd/i.test(url) }
function isDirectVideo(url: string) {
  return /\.(mp4|webm|ogv|ogg|mov|mkv|avi|flv|3gp|m4v)(\?|$)/i.test(url)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VideoPlayer({ initialUrl = '' }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const hlsRef        = useRef<any>(null)
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [inputUrl,     setInputUrl]     = useState(initialUrl)
  const [loadedUrl,    setLoadedUrl]    = useState('')
  const [analyzing,    setAnalyzing]    = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [result,       setResult]       = useState<AnalyzeResult | null>(null)

  // Player state
  const [playing,     setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [volume,      setVolume]      = useState(1)
  const [muted,       setMuted]       = useState(false)
  const [fullscreen,  setFullscreen]  = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [showControls,setShowControls]= useState(true)
  const [showSettings,setShowSettings]= useState(false)
  const [showDownload,setShowDownload]= useState(false)
  const [queueing,    setQueueing]    = useState('')
  const [queued,      setQueued]      = useState('')

  // ── Resolve actual stream URL via dedicated endpoint ──────────────────────
  const resolveStreamUrl = useCallback(async (url: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/analyze/stream-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not resolve stream URL')
      if (data.stream_url) {
        loadVideoSrc(data.stream_url)
        // Merge stream formats back into result for download panel
        setResult(prev => prev ? { ...prev, formats: data.formats ?? prev.formats } : prev)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  // ── Analyze URL ────────────────────────────────────────────────────────────
  const analyzeUrl = useCallback(async (url: string) => {
    if (!url.trim()) return
    setAnalyzing(true)
    setAnalyzeError('')
    setResult(null)
    setLoadedUrl('')
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data: AnalyzeResult = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analyze failed')
      setResult(data)
      const streamUrl = bestStreamUrl(data)
      if (streamUrl) {
        loadVideoSrc(streamUrl)
      } else {
        // Analyze returned metadata only — resolve actual stream URL separately
        const ok = await resolveStreamUrl(url)
        if (!ok) setAnalyzeError('No streamable URL found. Try downloading instead.')
      }
    } catch (e: any) {
      setAnalyzeError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }, [resolveStreamUrl])

  // Try loading as direct URL first, then analyze
  const handleLoad = useCallback(async (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    setLoadedUrl(trimmed)

    if (isDirectVideo(trimmed) || isHls(trimmed) || isDash(trimmed)) {
      loadVideoSrc(trimmed)
      // Still analyze to get download options
      analyzeUrl(trimmed)
    } else {
      analyzeUrl(trimmed)
    }
  }, [analyzeUrl])

  useEffect(() => {
    if (initialUrl) handleLoad(initialUrl)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load video src with HLS.js ─────────────────────────────────────────────
  function loadVideoSrc(src: string) {
    const video = videoRef.current
    if (!video) return

    // Destroy old HLS instance
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }

    setLoading(true)
    setPlaying(false)

    if (isHls(src)) {
      // Dynamically import hls.js only client-side
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          // Fallback for Safari native HLS
          video.src = src
          video.load()
          return
        }
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
        hlsRef.current = hls
        hls.loadSource(src)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false)
          video.play().catch(() => {})
          setPlaying(true)
        })
        hls.on(Hls.Events.ERROR, (_evt: any, data: any) => {
          if (data.fatal) setAnalyzeError(`HLS error: ${data.details}`)
        })
      })
    } else {
      video.src = src
      video.load()
    }
  }

  // ── Video events ───────────────────────────────────────────────────────────
  function onTimeUpdate() {
    const v = videoRef.current
    if (v) setCurrentTime(v.currentTime)
  }
  function onDurationChange() {
    const v = videoRef.current
    if (v && isFinite(v.duration)) setDuration(v.duration)
  }
  function onWaiting()  { setLoading(true) }
  function onCanPlay()  { setLoading(false) }
  function onPlay()     { setPlaying(true) }
  function onPause()    { setPlaying(false) }
  function onEnded()    { setPlaying(false) }
  function onVolumeChange() {
    const v = videoRef.current
    if (v) { setVolume(v.volume); setMuted(v.muted) }
  }

  // ── Controls ───────────────────────────────────────────────────────────────
  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    playing ? v.pause() : v.play()
  }
  function seek(to: number) {
    const v = videoRef.current
    if (v) v.currentTime = to
  }
  function setVol(val: number) {
    const v = videoRef.current
    if (v) { v.volume = val; v.muted = val === 0 }
  }
  function toggleMute() {
    const v = videoRef.current
    if (v) v.muted = !v.muted
  }
  function skip(delta: number) {
    const v = videoRef.current
    if (v) v.currentTime = Math.max(0, Math.min(v.currentTime + delta, v.duration || 0))
  }
  async function toggleFullscreen() {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      await el.requestFullscreen()
      setFullscreen(true)
    } else {
      await document.exitFullscreen()
      setFullscreen(false)
    }
  }
  async function togglePip() {
    const v = videoRef.current
    if (!v) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await v.requestPictureInPicture()
    } catch {}
  }

  // Show controls on mouse move, hide after 3s
  function onMouseMove() {
    setShowControls(true)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    if (playing) {
      controlsTimer.current = setTimeout(() => setShowControls(false), 3000)
    }
  }

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // ── Queue download ─────────────────────────────────────────────────────────
  async function queueDownload(format: Format) {
    const url = loadedUrl || inputUrl
    if (!url) return
    setQueueing(format.format_id)
    try {
      const res = await fetch(`${API_BASE}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          mediaType: format.vcodec === 'none' ? 'audio' : 'video',
          format: format.ext,
          quality: format.height ? `${format.height}p` : 'best',
          formatId: format.format_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQueued(format.format_id)
      setTimeout(() => setQueued(''), 3000)
    } catch (e: any) {
      toast.error(`Download failed: ${e.message}`)
    } finally {
      setQueueing('')
    }
  }

  // ── Sorted formats for download panel ─────────────────────────────────────
  const downloadFormats = (result?.formats ?? [])
    .filter(f => f.url || f.format_id)
    .sort((a, b) => {
      const ah = a.height ?? 0, bh = b.height ?? 0
      if (bh !== ah) return bh - ah
      return (b.tbr ?? 0) - (a.tbr ?? 0)
    })
    .slice(0, 30)

  const videoFormats  = downloadFormats.filter(f => f.vcodec !== 'none' && f.height)
  const audioFormats  = downloadFormats.filter(f => f.vcodec === 'none' || (!f.height && f.acodec))
  const otherFormats  = downloadFormats.filter(f => !videoFormats.includes(f) && !audioFormats.includes(f))

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex flex-col gap-0">

      {/* ── URL input bar ───────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Film size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="url"
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoad(inputUrl)}
            placeholder="Paste any video URL — YouTube, TikTok, direct .mp4, .m3u8 HLS, and more…"
            className="input pl-9 pr-4 h-11 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => handleLoad(inputUrl)}
          disabled={analyzing || !inputUrl.trim()}
          className="btn-primary h-11 px-5 shrink-0 min-w-[90px]"
        >
          {analyzing
            ? <><Loader2 size={14} className="spin" /> Analyzing…</>
            : 'Play'}
        </button>
      </div>

      {analyzeError && (
        <div className="flex items-start gap-2 p-3 mb-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {analyzeError}
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-4">

        {/* ── Video player ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseLeave={() => playing && setShowControls(false)}
            className="relative bg-black rounded-2xl overflow-hidden group select-none"
            style={{ aspectRatio: '16/9' }}
          >
            {/* Video element */}
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              preload="metadata"
              onTimeUpdate={onTimeUpdate}
              onDurationChange={onDurationChange}
              onWaiting={onWaiting}
              onCanPlay={onCanPlay}
              onPlay={onPlay}
              onPause={onPause}
              onEnded={onEnded}
              onVolumeChange={onVolumeChange}
              onClick={togglePlay}
            />

            {/* Empty state */}
            {!loadedUrl && !analyzing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--text-3)]">
                <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
                  <Film size={28} className="text-[var(--text-3)]" />
                </div>
                <p className="text-sm font-medium">Paste a URL above to play</p>
                <p className="text-xs opacity-70">YouTube, TikTok, MP4, HLS, DASH, and 14,000+ sites</p>
              </div>
            )}

            {/* Loading spinner */}
            {loading && loadedUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 size={40} className="spin text-white/80" />
              </div>
            )}

            {/* Analyzing overlay */}
            {analyzing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
                <Loader2 size={36} className="spin text-[var(--brand)]" />
                <p className="text-sm text-white/80">Analyzing video source…</p>
              </div>
            )}

            {/* Controls overlay */}
            {loadedUrl && (
              <div
                className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${
                  showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                {/* Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                {/* Controls bar */}
                <div className="relative z-10 px-4 pb-3 pt-8">
                  {/* Progress bar */}
                  <div className="relative h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group/seek"
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      seek(((e.clientX - rect.left) / rect.width) * duration)
                    }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-[var(--brand)] rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity"
                      style={{ left: `calc(${progress}% - 7px)` }}
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => skip(-10)}
                      className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                      <SkipBack size={16} />
                    </button>
                    <button type="button" onClick={togglePlay}
                      className="text-white hover:text-white p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors">
                      {playing ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button type="button" onClick={() => skip(10)}
                      className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                      <SkipForward size={16} />
                    </button>

                    {/* Volume */}
                    <button type="button" onClick={toggleMute}
                      className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                      {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input
                      type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                      onChange={e => setVol(parseFloat(e.target.value))}
                      className="w-20 h-1 accent-[var(--brand)] cursor-pointer hidden sm:block"
                    />

                    {/* Time */}
                    <span className="text-xs text-white/70 tabular-nums ml-1 hidden sm:block">
                      {fmtTime(currentTime)} / {fmtTime(duration)}
                    </span>

                    <div className="ml-auto flex items-center gap-1">
                      <button type="button" onClick={togglePip}
                        className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden sm:block"
                        title="Picture in Picture">
                        <PictureInPicture size={15} />
                      </button>
                      <button type="button"
                        onClick={() => { setShowDownload(v => !v); setShowSettings(false) }}
                        className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
                          showDownload ? 'text-[var(--brand)]' : 'text-white/80 hover:text-white'}`}
                        title="Download options">
                        <Download size={15} />
                      </button>
                      <button type="button" onClick={toggleFullscreen}
                        className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                        {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Video meta */}
          {result && (
            <div className="mt-3 px-1">
              {result.title && (
                <h2 className="font-bold text-[var(--text)] text-sm sm:text-base line-clamp-2 leading-snug mb-1">
                  {result.title}
                </h2>
              )}
              <div className="flex items-center gap-3 text-xs text-[var(--text-3)]">
                {result.uploader && <span>{result.uploader}</span>}
                {result.duration && <span>{fmtTime(result.duration)}</span>}
                {result.is_live && (
                  <span className="flex items-center gap-1 text-red-400 font-semibold">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full pulse-dot" /> LIVE
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Download panel ───────────────────────────────────────────────── */}
        <div className={`xl:w-80 flex-shrink-0 transition-all duration-300 ${
          (showDownload || result) && downloadFormats.length > 0
            ? 'opacity-100'
            : 'xl:opacity-0 xl:w-0 xl:overflow-hidden opacity-100'
        }`}>
          {(showDownload || result) && downloadFormats.length > 0 && (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden h-full flex flex-col">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
                <Download size={14} className="text-[var(--brand)]" />
                <span className="text-sm font-bold text-[var(--text)]">Download Options</span>
                <span className="ml-auto text-xs text-[var(--text-3)]">{downloadFormats.length} formats</span>
              </div>

              <div className="overflow-y-auto flex-1 p-3 space-y-3 max-h-[420px]">
                {/* Video formats */}
                {videoFormats.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <FileVideo size={10} /> Video
                    </p>
                    <div className="space-y-1">
                      {videoFormats.map(f => (
                        <FormatRow
                          key={f.format_id}
                          format={f}
                          queueing={queueing === f.format_id}
                          queued={queued === f.format_id}
                          onDownload={() => queueDownload(f)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio formats */}
                {audioFormats.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Music size={10} /> Audio only
                    </p>
                    <div className="space-y-1">
                      {audioFormats.map(f => (
                        <FormatRow
                          key={f.format_id}
                          format={f}
                          queueing={queueing === f.format_id}
                          queued={queued === f.format_id}
                          onDownload={() => queueDownload(f)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Other */}
                {otherFormats.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1.5">Other</p>
                    <div className="space-y-1">
                      {otherFormats.map(f => (
                        <FormatRow
                          key={f.format_id}
                          format={f}
                          queueing={queueing === f.format_id}
                          queued={queued === f.format_id}
                          onDownload={() => queueDownload(f)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Open in download tool */}
              {loadedUrl && (
                <div className="px-3 pb-3 pt-1 border-t border-[var(--border)]">
                  <a
                    href={`/download?url=${encodeURIComponent(loadedUrl)}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-light)] border border-[var(--brand)]/30 hover:bg-[var(--brand)]/5 rounded-xl transition-colors"
                  >
                    <ExternalLink size={12} /> Open in Full Download Tool
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Format row ────────────────────────────────────────────────────────────────
function FormatRow({ format: f, queueing, queued, onDownload }: {
  format: Format
  queueing: boolean
  queued: boolean
  onDownload: () => void
}) {
  const isAudio = f.vcodec === 'none' || (!f.height && f.acodec && f.acodec !== 'none')
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors group">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--text)] leading-tight">{fmtLabel(f)}</p>
        <p className="text-[10px] text-[var(--text-3)] truncate">
          {[
            f.height && !isAudio && `${f.height}p`,
            f.fps && f.fps > 30 && `${Math.round(f.fps)}fps`,
            f.tbr && `${Math.round(f.tbr)}kbps`,
            f.filesize && fmtSize(f.filesize),
            f.format_note,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>
      <button
        type="button"
        onClick={onDownload}
        disabled={queueing || queued}
        className={`shrink-0 p-1.5 rounded-lg transition-colors ${
          queued
            ? 'text-[var(--ok)] bg-[var(--ok)]/10'
            : 'text-[var(--text-3)] hover:text-[var(--brand)] hover:bg-[var(--brand)]/10'
        }`}
        title="Queue download"
      >
        {queueing
          ? <Loader2 size={13} className="spin" />
          : queued
          ? <Check size={13} />
          : <Download size={13} />}
      </button>
    </div>
  )
}
