'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Download, Loader2,
  PictureInPicture, Check, AlertCircle, ExternalLink,
  Film, Music, FileVideo, Camera, Repeat, Settings,
  LayoutPanelLeft, ChevronDown,
} from 'lucide-react'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

// ── Types ─────────────────────────────────────────────────────────────────────
interface Format {
  format_id: string; ext: string; height?: number; width?: number
  fps?: number; filesize?: number; tbr?: number; abr?: number
  acodec?: string; vcodec?: string; format_note?: string
  url?: string; protocol?: string
}
interface AnalyzeResult {
  title?: string; thumbnail?: string; duration?: number; uploader?: string
  description?: string; formats?: Format[]; url?: string; ext?: string
  is_live?: boolean; direct_url?: string; error?: string
}
interface Props { initialUrl?: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return '0:00'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
}
function fmtSize(b?: number) {
  if (!b) return ''
  return b > 1e9 ? `${(b/1e9).toFixed(1)}GB` : b > 1e6 ? `${(b/1e6).toFixed(0)}MB` : `${(b/1e3).toFixed(0)}KB`
}
function fmtLabel(f: Format) {
  if (f.vcodec === 'none' || (!f.height && f.ext === 'mp3'))
    return `${f.ext?.toUpperCase()} ${f.abr ? `${Math.round(f.abr)}kbps` : 'audio'}`
  const res = f.height ? `${f.height}p` : ''
  const fps = f.fps && f.fps > 30 ? `${Math.round(f.fps)}fps` : ''
  return `${f.ext?.toUpperCase()} ${res}${fps}`.trim()
}
function bestStreamUrl(r: AnalyzeResult): string | null {
  const d = r.direct_url ?? r.url
  if (d) return d
  if (!r.formats?.length) return null
  const mp4 = r.formats.filter(f => f.ext === 'mp4' && f.vcodec !== 'none' && f.acodec !== 'none' && f.url)
    .sort((a,b) => (b.height??0)-(a.height??0))
  return mp4[0]?.url ?? r.formats.find(f => f.url)?.url ?? null
}
function isHls(u: string)        { return /\.m3u8/i.test(u) }
function isDash(u: string)       { return /\.mpd/i.test(u) }
function isDirectVideo(u: string){ return /\.(mp4|webm|ogv|ogg|mov|mkv|avi|flv|3gp|m4v)(\?|$)/i.test(u) }

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

// ── Component ─────────────────────────────────────────────────────────────────
export default function VideoPlayer({ initialUrl = '' }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const hlsRef        = useRef<any>(null)
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimeRef  = useRef(0)
  const lastTapRef    = useRef(0)

  const [inputUrl,      setInputUrl]      = useState(initialUrl)
  const [loadedUrl,     setLoadedUrl]     = useState('')
  const [analyzing,     setAnalyzing]     = useState(false)
  const [analyzeError,  setAnalyzeError]  = useState('')
  const [result,        setResult]        = useState<AnalyzeResult | null>(null)

  // Player state
  const [playing,      setPlaying]      = useState(false)
  const [currentTime,  setCurrentTime]  = useState(0)
  const [duration,     setDuration]     = useState(0)
  const [buffered,     setBuffered]     = useState(0)
  const [volume,       setVolume]       = useState(1)
  const [muted,        setMuted]        = useState(false)
  const [fullscreen,   setFullscreen]   = useState(false)
  const [theaterMode,  setTheaterMode]  = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showQuality,  setShowQuality]  = useState(false)
  const [showDownload, setShowDownload] = useState(false)
  const [speed,        setSpeed]        = useState(1)
  const [loop,         setLoop]         = useState(false)
  const [queueing,     setQueueing]     = useState('')
  const [queued,       setQueued]       = useState('')
  const [dlJobs,       setDlJobs]       = useState<Array<{ jobId: string; label: string; title?: string }>>([])
  const [showDlPanel,  setShowDlPanel]  = useState(false)
  const [hint,         setHint]         = useState('')
  const [seekTooltip,  setSeekTooltip]  = useState<{x: number; time: number} | null>(null)

  // ── Hint flash ─────────────────────────────────────────────────────────────
  const showHint = useCallback((text: string) => {
    setHint(text)
    if (hintTimer.current) clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(''), 1000)
  }, [])

  // ── Show / hide controls ───────────────────────────────────────────────────
  function armHideTimer() {
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false)
    }, 3000)
  }
  function onMouseMove() { setShowControls(true); armHideTimer() }
  function onMouseLeave() { if (playing) armHideTimer() }

  // ── Load video src with HLS.js ─────────────────────────────────────────────
  const loadVideoSrc = useCallback((src: string, restoreTime = 0) => {
    const video = videoRef.current
    if (!video) return
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    setLoading(true); setPlaying(false)
    savedTimeRef.current = restoreTime

    if (isHls(src)) {
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) { video.src = src; video.load(); return }
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
        hlsRef.current = hls
        hls.loadSource(src); hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false)
          if (savedTimeRef.current > 0) { video.currentTime = savedTimeRef.current; savedTimeRef.current = 0 }
          video.play().catch(() => {})
          setPlaying(true)
        })
        hls.on(Hls.Events.ERROR, (_: any, d: any) => {
          if (d.fatal) toast.error(`Stream error: ${d.details}`)
        })
      })
    } else {
      video.src = src; video.load()
    }
  }, [])

  // ── Resolve stream URL via dedicated endpoint ──────────────────────────────
  const resolveStreamUrl = useCallback(async (url: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/analyze/stream-url`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to resolve stream URL')
      if (data.stream_url) {
        loadVideoSrc(data.stream_url)
        setResult(prev => prev ? { ...prev, formats: data.formats ?? prev.formats } : prev)
        return true
      }
      return false
    } catch { return false }
  }, [loadVideoSrc])

  // ── Analyze URL ────────────────────────────────────────────────────────────
  const analyzeUrl = useCallback(async (url: string) => {
    if (!url.trim()) return
    setAnalyzing(true); setAnalyzeError(''); setResult(null); setLoadedUrl('')
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data: AnalyzeResult = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analyze failed')
      setResult(data)
      const streamUrl = bestStreamUrl(data)
      if (streamUrl) loadVideoSrc(streamUrl)
      else {
        const ok = await resolveStreamUrl(url)
        if (!ok) setAnalyzeError('Could not find a playable stream. Try the Download tool instead.')
      }
    } catch (e: any) { setAnalyzeError(e.message) }
    finally { setAnalyzing(false) }
  }, [loadVideoSrc, resolveStreamUrl])

  const handleLoad = useCallback(async (url: string) => {
    const t = url.trim()
    if (!t) return
    setLoadedUrl(t)
    if (isDirectVideo(t) || isHls(t) || isDash(t)) {
      loadVideoSrc(t); analyzeUrl(t)
    } else {
      analyzeUrl(t)
    }
  }, [analyzeUrl, loadVideoSrc])

  useEffect(() => { if (initialUrl) handleLoad(initialUrl) }, []) // eslint-disable-line

  // ── Video events ───────────────────────────────────────────────────────────
  function onTimeUpdate() { const v = videoRef.current; if (v) setCurrentTime(v.currentTime) }
  function onDurationChange() { const v = videoRef.current; if (v && isFinite(v.duration)) setDuration(v.duration) }
  function onProgress() {
    const v = videoRef.current; if (!v || !v.buffered.length) return
    const end = v.buffered.end(v.buffered.length - 1)
    setBuffered(v.duration > 0 ? (end / v.duration) * 100 : 0)
  }
  function onWaiting()  { setLoading(true)  }
  function onCanPlay()  {
    setLoading(false)
    if (savedTimeRef.current > 0) { const v = videoRef.current; if (v) { v.currentTime = savedTimeRef.current; savedTimeRef.current = 0 } }
  }
  function onPlay()     { setPlaying(true)  }
  function onPause()    { setPlaying(false); setShowControls(true) }
  function onEnded()    { setPlaying(false); setShowControls(true) }
  function onVolumeChange() { const v = videoRef.current; if (v) { setVolume(v.volume); setMuted(v.muted) } }

  // ── Controls ───────────────────────────────────────────────────────────────
  function togglePlay() { const v = videoRef.current; if (!v) return; playing ? v.pause() : v.play() }
  function seek(to: number) { const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(to, v.duration || 0)) }
  function seekPct(pct: number) { if (duration) seek(pct * duration) }
  function setVol(val: number) { const v = videoRef.current; if (v) { v.volume = val; v.muted = val === 0 } }
  function toggleMute() { const v = videoRef.current; if (v) v.muted = !v.muted }
  function skip(delta: number) { const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(v.currentTime + delta, v.duration || 0)) }

  function changeSpeed(s: number) {
    const v = videoRef.current; if (v) { v.playbackRate = s; setSpeed(s); showHint(`${s}×`) }
  }
  function toggleLoop() {
    const v = videoRef.current
    const next = !loop; setLoop(next)
    if (v) v.loop = next
    showHint(next ? '↺ Loop on' : '↺ Loop off')
  }

  async function toggleFullscreen() {
    const el = containerRef.current; if (!el) return
    if (!document.fullscreenElement) { await el.requestFullscreen(); setFullscreen(true) }
    else { await document.exitFullscreen(); setFullscreen(false) }
  }
  async function togglePip() {
    const v = videoRef.current; if (!v) return
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await v.requestPictureInPicture() }
    catch {}
  }
  function takeScreenshot() {
    const v = videoRef.current; if (!v) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth || 1280; canvas.height = v.videoHeight || 720
    canvas.getContext('2d')!.drawImage(v, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `screenshot-${Math.round(currentTime)}s.png`; a.click()
      URL.revokeObjectURL(url)
    })
    toast.success('Screenshot saved')
  }

  function switchQuality(f: Format) {
    if (!f.url) return
    const curTime = videoRef.current?.currentTime ?? 0
    loadVideoSrc(f.url, curTime)
    setShowQuality(false)
    showHint(`${f.height ? f.height + 'p' : f.ext?.toUpperCase()}`)
  }

  // ── Touch: double-tap to seek, single tap to toggle controls ───────────────
  function onTouchEnd(e: React.TouchEvent) {
    const now = Date.now()
    const t = e.changedTouches[0]
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = t.clientX - rect.left
      if (x < rect.width * 0.35) { skip(-10); showHint('◀◀ -10s') }
      else if (x > rect.width * 0.65) { skip(10); showHint('▶▶ +10s') }
      else toggleFullscreen()
    } else {
      lastTapRef.current = now
      setShowControls(v => !v)
    }
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as Element).tagName
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return
      if (!loadedUrl) return
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); showHint(playing ? '⏸' : '▶'); break
        case 'ArrowLeft':   e.preventDefault(); skip(e.shiftKey ? -30 : -5); showHint(e.shiftKey ? '◀◀ -30s' : '◀ -5s'); break
        case 'ArrowRight':  e.preventDefault(); skip(e.shiftKey ? 30 : 5);  showHint(e.shiftKey ? '▶▶ +30s' : '▶ +5s'); break
        case 'ArrowUp':     e.preventDefault(); setVol(Math.min(1, volume + 0.1)); showHint('🔊'); break
        case 'ArrowDown':   e.preventDefault(); setVol(Math.max(0, volume - 0.1)); showHint('🔉'); break
        case 'm': case 'M': toggleMute(); showHint(muted ? '🔊 Unmuted' : '🔇 Muted'); break
        case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break
        case 'p': case 'P': togglePip(); break
        case 'l': case 'L': toggleLoop(); break
        case 't': case 'T': setTheaterMode(v => !v); break
        case ',': changeSpeed(Math.max(0.25, speed - 0.25)); break
        case '.': changeSpeed(Math.min(2, speed + 0.25)); break
        default:
          if (e.key >= '0' && e.key <= '9') { seekPct(parseInt(e.key) / 10); showHint(`${parseInt(e.key) * 10}%`) }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [loadedUrl, playing, volume, muted, loop, speed, duration]) // eslint-disable-line

  useEffect(() => {
    const onFsc = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsc)
    return () => document.removeEventListener('fullscreenchange', onFsc)
  }, [])

  // ── Queue download ─────────────────────────────────────────────────────────
  async function queueDownload(format: Format) {
    const url = loadedUrl || inputUrl; if (!url) return
    setQueueing(format.format_id)
    try {
      const res = await fetch(`${API_BASE}/api/download`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          mediaType: format.vcodec === 'none' ? 'audio' : 'video',
          format: format.ext ?? 'mp4',
          quality: format.height ? `${format.height}p` : 'best',
          formatId: format.format_id,
          title: result?.title,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQueued(format.format_id)
      setTimeout(() => setQueued(''), 3000)
      setDlJobs(prev => {
        const next = [{ jobId: data.jobId, label: fmtLabel(format), title: result?.title }, ...prev]
        if (next.length === 1) setShowDlPanel(true)
        return next
      })
      toast.success('Download queued — see progress below')
    } catch (e: any) { toast.error(`Download failed: ${e.message}`) }
    finally { setQueueing('') }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const progress      = duration > 0 ? (currentTime / duration) * 100 : 0
  const allFormats    = (result?.formats ?? []).filter(f => f.url || f.format_id)
    .sort((a,b) => (b.height??0)-(a.height??0)).slice(0, 30)
  const videoFormats  = allFormats.filter(f => f.vcodec !== 'none' && f.height)
  const audioFormats  = allFormats.filter(f => f.vcodec === 'none' || (!f.height && f.acodec))
  const otherFormats  = allFormats.filter(f => !videoFormats.includes(f) && !audioFormats.includes(f))
  const qualities     = allFormats.filter(f => f.url && f.vcodec !== 'none' && f.height)
  const hasQuality    = qualities.length > 1

  // ── Seek bar interaction ───────────────────────────────────────────────────
  function onSeekClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    seekPct((e.clientX - rect.left) / rect.width)
  }
  function onSeekMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setSeekTooltip({ x: e.clientX - rect.left, time: pct * duration })
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-0">

      {/* ── URL input ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Film size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
          <input
            type="url" value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoad(inputUrl)}
            placeholder="Paste any video URL — YouTube, TikTok, MP4, HLS, DASH, 14,000+ sites…"
            className="input pl-9 pr-4 h-11 text-sm"
          />
        </div>
        <button type="button" onClick={() => handleLoad(inputUrl)}
          disabled={analyzing || !inputUrl.trim()}
          className="btn-primary h-11 px-5 shrink-0 min-w-[90px] disabled:opacity-50">
          {analyzing ? <><Loader2 size={14} className="spin mr-1.5" />Analyzing…</> : <><Play size={14} className="mr-1.5" fill="currentColor" />Play</>}
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {analyzeError && (
        <div className="flex items-start gap-2 p-3 mb-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{analyzeError}</span>
          {loadedUrl && (
            <a href={`/download?url=${encodeURIComponent(loadedUrl)}`}
              className="ml-auto shrink-0 underline text-red-300 hover:text-red-200 text-xs">
              Try Downloader →
            </a>
          )}
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-4">

        {/* ── Video ────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            onTouchEnd={onTouchEnd}
            onDoubleClick={toggleFullscreen}
            className={`relative bg-black rounded-2xl overflow-hidden select-none ${
              theaterMode ? 'w-full' : ''}`}
            style={{ aspectRatio: theaterMode ? undefined : '16/9', height: theaterMode ? 'min(70vh, 640px)' : undefined }}
          >
            {/* Video */}
            <video
              ref={videoRef} className="w-full h-full object-contain"
              playsInline preload="metadata"
              onTimeUpdate={onTimeUpdate} onDurationChange={onDurationChange}
              onProgress={onProgress} onWaiting={onWaiting} onCanPlay={onCanPlay}
              onPlay={onPlay} onPause={onPause} onEnded={onEnded} onVolumeChange={onVolumeChange}
              onClick={e => { e.preventDefault(); togglePlay() }}
            />

            {/* Empty state */}
            {!loadedUrl && !analyzing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[var(--text-3)] p-6">
                <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Film size={36} className="text-white/30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white/50 mb-1">Paste a URL above to play</p>
                  <p className="text-xs text-white/25">YouTube · TikTok · MP4 · HLS · DASH · 14,000+ sites</p>
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px] text-white/20">
                  {['Space — play/pause','← → — seek ±5s','M — mute','F — fullscreen','L — loop','0-9 — seek %'].map(k => (
                    <span key={k} className="px-2 py-1 rounded-lg bg-white/5 font-mono">{k}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Analyzing overlay */}
            {analyzing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
                <Loader2 size={40} className="spin text-[var(--brand)]" />
                <p className="text-sm text-white/70 font-medium">Analyzing stream…</p>
              </div>
            )}

            {/* Loading spinner */}
            {loading && loadedUrl && !analyzing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 size={44} className="spin text-white/70" />
              </div>
            )}

            {/* Center play button (when paused & video loaded) */}
            {loadedUrl && !loading && !analyzing && !playing && (
              <button type="button" onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center group"
                aria-label="Play">
                <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/50 border-2 border-white/30 flex items-center justify-center
                  group-hover:bg-black/70 group-hover:scale-110 transition-all duration-200 backdrop-blur-sm">
                  <Play size={28} className="text-white ml-1" fill="currentColor" />
                </span>
              </button>
            )}

            {/* Keyboard hint flash */}
            {hint && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none
                px-5 py-2.5 rounded-xl bg-black/70 text-white text-base font-bold backdrop-blur-sm animate-scale-in">
                {hint}
              </div>
            )}

            {/* Controls overlay */}
            {loadedUrl && (
              <div className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${
                showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

                {/* Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pointer-events-none" />

                <div className="relative z-10 px-3 sm:px-4 pb-3 pt-10">

                  {/* Seek bar */}
                  <div
                    className="relative h-1 sm:h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group/seek"
                    onClick={onSeekClick}
                    onMouseMove={onSeekMove}
                    onMouseLeave={() => setSeekTooltip(null)}
                  >
                    {/* Buffered */}
                    <div className="absolute inset-y-0 left-0 bg-white/25 rounded-full" style={{ width: `${buffered}%` }} />
                    {/* Played */}
                    <div className="absolute inset-y-0 left-0 bg-[var(--brand)] rounded-full" style={{ width: `${progress}%` }} />
                    {/* Thumb */}
                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-white rounded-full shadow-md
                      opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none"
                      style={{ left: `calc(${progress}% - 6px)` }} />
                    {/* Tooltip */}
                    {seekTooltip && (
                      <div className="absolute bottom-full mb-1.5 -translate-x-1/2 px-2 py-0.5 bg-black/90 text-white text-[10px] font-mono
                        rounded-md pointer-events-none whitespace-nowrap"
                        style={{ left: seekTooltip.x }}>
                        {fmtTime(seekTooltip.time)}
                      </div>
                    )}
                  </div>

                  {/* Controls row */}
                  <div className="flex items-center gap-1 sm:gap-1.5">

                    {/* Left controls */}
                    <button type="button" onClick={() => { skip(-10); showHint('◀ -10s') }}
                      className="ctrl-btn" title="Back 10s (←)"><SkipBack size={15} /></button>
                    <button type="button" onClick={togglePlay}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors shrink-0"
                      title={playing ? 'Pause (Space)' : 'Play (Space)'}>
                      {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <button type="button" onClick={() => { skip(10); showHint('▶ +10s') }}
                      className="ctrl-btn" title="Forward 10s (→)"><SkipForward size={15} /></button>

                    {/* Volume */}
                    <button type="button" onClick={toggleMute} className="ctrl-btn" title="Mute (M)">
                      {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    </button>
                    <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                      onChange={e => setVol(parseFloat(e.target.value))}
                      aria-label="Volume"
                      title="Volume"
                      className="w-16 sm:w-20 h-1 accent-[var(--brand)] cursor-pointer hidden sm:block" />

                    {/* Time */}
                    <span className="text-[10px] sm:text-xs text-white/60 font-mono tabular-nums ml-1 shrink-0 hidden sm:block">
                      {fmtTime(currentTime)} / {fmtTime(duration)}
                    </span>

                    <div className="ml-auto flex items-center gap-0.5 sm:gap-1">

                      {/* Loop */}
                      <button type="button" onClick={toggleLoop}
                        className={`ctrl-btn ${loop ? 'text-[var(--brand)]' : ''}`} title="Loop (L)">
                        <Repeat size={14} />
                      </button>

                      {/* Screenshot */}
                      <button type="button" onClick={takeScreenshot}
                        className="ctrl-btn hidden sm:flex" title="Screenshot">
                        <Camera size={14} />
                      </button>

                      {/* Quality switcher */}
                      {hasQuality && (
                        <div className="relative">
                          <button type="button" onClick={() => { setShowQuality(v => !v); setShowSettings(false) }}
                            className={`ctrl-btn gap-1 hidden sm:flex ${showQuality ? 'text-[var(--brand)]' : ''}`}
                            title="Quality">
                            <span className="text-[10px] font-bold leading-none">HD</span>
                            <ChevronDown size={10} />
                          </button>
                          {showQuality && (
                            <div className="absolute bottom-full right-0 mb-2 bg-black/90 border border-white/15 rounded-xl p-1.5
                              backdrop-blur-sm min-w-[120px] shadow-xl z-50">
                              {qualities.map(q => (
                                <button type="button" key={q.format_id} onClick={() => switchQuality(q)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 text-xs text-white/80 hover:text-white transition-colors">
                                  <span className="font-semibold">{q.height}p</span>
                                  {q.fps && q.fps > 30 && <span className="text-white/40">{Math.round(q.fps)}fps</span>}
                                  {q.tbr && <span className="ml-auto text-white/30">{Math.round(q.tbr)}k</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Settings (speed + loop) */}
                      <div className="relative">
                        <button type="button" onClick={() => { setShowSettings(v => !v); setShowQuality(false) }}
                          className={`ctrl-btn ${showSettings ? 'text-[var(--brand)]' : ''}`} title="Settings">
                          <Settings size={14} />
                        </button>
                        {showSettings && (
                          <div className="absolute bottom-full right-0 mb-2 bg-black/90 border border-white/15 rounded-2xl p-3
                            backdrop-blur-sm min-w-[180px] shadow-xl z-50">

                            {/* Speed */}
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Playback speed</p>
                            <div className="grid grid-cols-4 gap-1 mb-3">
                              {SPEEDS.map(s => (
                                <button type="button" key={s} onClick={() => changeSpeed(s)}
                                  className={`py-1 rounded-lg text-[10px] font-bold transition-colors
                                    ${speed === s ? 'bg-[var(--brand)] text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                                  {s}×
                                </button>
                              ))}
                            </div>

                            {/* Loop */}
                            <button type="button" onClick={toggleLoop}
                              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                              <span className="text-xs text-white/80 flex items-center gap-2"><Repeat size={12} />Loop</span>
                              <div className={`w-8 h-4 rounded-full transition-colors relative ${loop ? 'bg-[var(--brand)]' : 'bg-white/20'}`}>
                                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${loop ? 'left-4' : 'left-0.5'}`} />
                              </div>
                            </button>

                            {/* Download button */}
                            <button type="button" onClick={() => { setShowDownload(v => !v); setShowSettings(false) }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors mt-1">
                              <Download size={12} className="text-white/60" />
                              <span className="text-xs text-white/80">Download formats</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* PiP */}
                      <button type="button" onClick={togglePip} className="ctrl-btn hidden sm:flex" title="Picture-in-picture (P)">
                        <PictureInPicture size={14} />
                      </button>

                      {/* Theater */}
                      <button type="button" onClick={() => setTheaterMode(v => !v)}
                        className={`ctrl-btn hidden md:flex ${theaterMode ? 'text-[var(--brand)]' : ''}`} title="Theater mode (T)">
                        <LayoutPanelLeft size={14} />
                      </button>

                      {/* Download toggle */}
                      <button type="button" onClick={() => setShowDownload(v => !v)}
                        className={`ctrl-btn ${showDownload ? 'text-[var(--brand)]' : ''}`} title="Download options">
                        <Download size={14} />
                      </button>

                      {/* Fullscreen */}
                      <button type="button" onClick={toggleFullscreen}
                        className="ctrl-btn" title={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>
                        {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          {result && (
            <div className="mt-3 px-1">
              {result.title && (
                <h2 className="font-bold text-[var(--text)] text-sm sm:text-base line-clamp-2 leading-snug mb-1">
                  {result.title}
                </h2>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-3)]">
                {result.uploader && <span>{result.uploader}</span>}
                {result.duration && <span>{fmtTime(result.duration)}</span>}
                {result.is_live && (
                  <span className="flex items-center gap-1 text-red-400 font-semibold">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full pulse-dot" /> LIVE
                  </span>
                )}
                {speed !== 1 && <span className="badge bg-[var(--brand)]/15 text-[var(--brand)] border border-[var(--brand)]/25">{speed}×</span>}
                {loop && <span className="badge bg-amber-500/15 text-amber-400 border border-amber-500/25">Loop</span>}
              </div>
              {/* Keyboard shortcuts hint */}
              {loadedUrl && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[['Space','Play/Pause'],['← →','Seek ±5s'],['M','Mute'],['F','Fullscreen'],['L','Loop'],['< >','Speed']].map(([k,v]) => (
                    <span key={k} className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-3)] font-mono">
                      <b>{k}</b> {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Download panel ────────────────────────────────────────────────── */}
        {(showDownload || allFormats.length > 0) && allFormats.length > 0 && (
          <div className="xl:w-80 shrink-0">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
                <Download size={13} className="text-[var(--brand)]" />
                <span className="text-sm font-bold text-[var(--text)]">Download Options</span>
                <span className="ml-auto text-xs text-[var(--text-3)]">{allFormats.length} formats</span>
                <button type="button" onClick={() => setShowDownload(false)} className="xl:hidden p-1 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-3)]">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 p-3 space-y-3 max-h-[360px]">
                {videoFormats.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <FileVideo size={10} /> Video
                    </p>
                    <div className="space-y-1">
                      {videoFormats.map(f => (
                        <FormatRow key={f.format_id} format={f} queueing={queueing===f.format_id} queued={queued===f.format_id} onDownload={() => queueDownload(f)} />
                      ))}
                    </div>
                  </div>
                )}
                {audioFormats.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Music size={10} /> Audio only
                    </p>
                    <div className="space-y-1">
                      {audioFormats.map(f => (
                        <FormatRow key={f.format_id} format={f} queueing={queueing===f.format_id} queued={queued===f.format_id} onDownload={() => queueDownload(f)} />
                      ))}
                    </div>
                  </div>
                )}
                {otherFormats.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1.5">Other</p>
                    <div className="space-y-1">
                      {otherFormats.map(f => (
                        <FormatRow key={f.format_id} format={f} queueing={queueing===f.format_id} queued={queued===f.format_id} onDownload={() => queueDownload(f)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {loadedUrl && (
                <div className="px-3 pb-3 pt-1 border-t border-[var(--border)]">
                  <a href={`/download?url=${encodeURIComponent(loadedUrl)}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold
                      text-[var(--brand)] hover:text-[var(--brand-light)] border border-[var(--brand)]/30
                      hover:bg-[var(--brand)]/5 rounded-xl transition-colors">
                    <ExternalLink size={12} /> Open in Full Download Tool
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Download progress panel ───────────────────────────────────────── */}
      {dlJobs.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDlPanel(v => !v)}
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors text-sm font-semibold text-[var(--text)]"
          >
            <Download size={14} className="text-[var(--brand)]" />
            Downloads
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand)]/15 text-[var(--brand)]">
              {dlJobs.length}
            </span>
            <span className="ml-auto text-[var(--text-3)] text-xs">{showDlPanel ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showDlPanel && (
            <div className="mt-2 flex flex-col gap-2">
              {dlJobs.map(j => (
                <DownloadJobRow key={j.jobId} jobId={j.jobId} label={j.label} title={j.title} apiBase={API_BASE}
                  onRemove={() => setDlJobs(prev => prev.filter(x => x.jobId !== j.jobId))} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Ctrl button helper class ───────────────────────────────────────────────────
// Applied via className="ctrl-btn" — defined in globals.css
// (inline here for clarity)

// ── Download job row with live SSE progress ───────────────────────────────────
function DownloadJobRow({ jobId, label, title, apiBase, onRemove }: {
  jobId: string; label: string; title?: string; apiBase: string; onRemove: () => void
}) {
  const [prog, setProg]   = useState<{ status: string; progress: number; speed?: number | null; eta?: number | null; files?: string[]; error?: string; filename?: string } | null>(null)
  const [files, setFiles] = useState<string[]>([])
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current) return
    const es = new EventSource(`${apiBase}/api/jobs/${jobId}/progress`)
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        setProg(d)
        if (d.status === 'completed') {
          setFiles(d.files ?? [])
          doneRef.current = true
          es.close()
        } else if (d.status === 'failed') {
          doneRef.current = true
          es.close()
        }
      } catch {}
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [jobId, apiBase])

  const status   = prog?.status ?? 'queued'
  const pct      = prog?.progress ?? 0
  const isDone   = status === 'completed'
  const isFailed = status === 'failed'
  const isActive = !isDone && !isFailed

  const statusColor = isDone ? 'text-green-400' : isFailed ? 'text-red-400' : 'text-[var(--brand)]'
  const badgeBg     = isDone ? 'bg-green-500/15 border-green-500/25 text-green-400'
                   : isFailed ? 'bg-red-500/15 border-red-500/25 text-red-400'
                   : 'bg-[var(--brand)]/15 border-[var(--brand)]/25 text-[var(--brand)]'

  function fmtSpeed(s?: number | null) {
    if (!s) return ''
    return s > 1e6 ? `${(s/1e6).toFixed(1)} MB/s` : `${(s/1e3).toFixed(0)} KB/s`
  }
  function fmtEta(s?: number | null) {
    if (!s || s <= 0) return ''
    if (s < 60) return `${s}s`
    return `${Math.floor(s/60)}m ${s%60}s`
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--text)] truncate">{title ?? label}</p>
          <p className="text-[10px] text-[var(--text-3)] truncate">{label} · {jobId.slice(0, 8)}</p>
        </div>
        <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
          {status.toUpperCase()}
        </span>
        <button type="button" onClick={onRemove} className="shrink-0 p-1 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-3)]" title="Dismiss">
          ✕
        </button>
      </div>

      {/* Progress bar */}
      {isActive && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--brand)] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between text-[9px] text-[var(--text-3)]">
            <span className={statusColor}>{pct}% {prog?.filename ? `· ${prog.filename.slice(0,30)}` : ''}</span>
            <span>{fmtSpeed(prog?.speed)}{prog?.eta ? ` · ETA ${fmtEta(prog.eta)}` : ''}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {isFailed && prog?.error && (
        <p className="text-[10px] text-red-400 bg-red-500/10 rounded-lg px-2 py-1 break-words">{prog.error}</p>
      )}

      {/* Download links */}
      {isDone && files.length > 0 && (
        <div className="flex flex-col gap-1">
          {files.map(f => (
            <a key={f}
              href={`${apiBase}/api/files/${jobId}/${encodeURIComponent(f)}`}
              download={f}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20
                text-green-400 hover:bg-green-500/20 text-[10px] font-semibold transition-colors truncate">
              <Download size={10} className="shrink-0" />
              <span className="truncate">{f}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Format row ────────────────────────────────────────────────────────────────
function FormatRow({ format: f, queueing, queued, onDownload }: {
  format: Format; queueing: boolean; queued: boolean; onDownload: () => void
}) {
  const isAudio = f.vcodec === 'none' || (!f.height && f.acodec && f.acodec !== 'none')
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors group">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--text)] leading-tight">{fmtLabel(f)}</p>
        <p className="text-[10px] text-[var(--text-3)] truncate">
          {[f.height && !isAudio && `${f.height}p`, f.fps && f.fps > 30 && `${Math.round(f.fps)}fps`,
            f.tbr && `${Math.round(f.tbr)}kbps`, f.filesize && fmtSize(f.filesize), f.format_note]
            .filter(Boolean).join(' · ')}
        </p>
      </div>
      <button type="button" onClick={onDownload} disabled={queueing || queued}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all
          ${queued ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'bg-[var(--brand)]/15 text-[var(--brand)] border border-[var(--brand)]/25 hover:bg-[var(--brand)]/25'}`}>
        {queueing ? <Loader2 size={10} className="spin" /> : queued ? <Check size={10} /> : <Download size={10} />}
        {queued ? 'Queued' : 'Save'}
      </button>
    </div>
  )
}
