'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Monitor, StopCircle, Download, Trash2, Play, Pause, AlertCircle, CheckCircle2, Video, Mic, MicOff } from 'lucide-react'

type RecState = 'idle' | 'recording' | 'paused' | 'stopped'

interface Recording {
  id: string
  blob: Blob
  url: string
  name: string
  size: number
  duration: number
  mimeType: string
  ts: number
}

function fmtDur(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

const MIME_PRIORITY = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
]

function getBestMime() {
  return MIME_PRIORITY.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
}

export default function ScreenCapture() {
  const [state,     setState]     = useState<RecState>('idle')
  const [elapsed,   setElapsed]   = useState(0)
  const [error,     setError]     = useState('')
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [withAudio, setWithAudio] = useState(true)
  const [micAudio,  setMicAudio]  = useState(false)
  const [supported, setSupported] = useState(true)

  const recRef      = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const streamRef   = useRef<MediaStream | null>(null)
  const startRef    = useRef<number>(0)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewRef  = useRef<HTMLVideoElement>(null)
  const pausedAtRef = useRef<number>(0)
  const totalPausedRef = useRef<number>(0)

  useEffect(() => {
    if (typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof (navigator.mediaDevices as any).getDisplayMedia === 'undefined') {
      setSupported(false)
    }
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startRef.current - totalPausedRef.current)
    }, 200)
  }, [stopTimer])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (previewRef.current) { previewRef.current.srcObject = null }
  }, [])

  const startRecording = useCallback(async () => {
    setError('')
    try {
      const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: withAudio,
      })

      let finalStream = displayStream

      if (micAudio) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          const ctx = new AudioContext()
          const dest = ctx.createMediaStreamDestination()
          if (withAudio && displayStream.getAudioTracks().length > 0) {
            ctx.createMediaStreamSource(displayStream).connect(dest)
          }
          ctx.createMediaStreamSource(micStream).connect(dest)
          finalStream = new MediaStream([
            ...displayStream.getVideoTracks(),
            ...dest.stream.getTracks(),
          ])
        } catch {
          // mic unavailable — proceed without
        }
      }

      streamRef.current = finalStream
      chunksRef.current = []
      totalPausedRef.current = 0
      startRef.current = Date.now()
      setElapsed(0)

      if (previewRef.current) {
        previewRef.current.srcObject = finalStream
        previewRef.current.muted = true
        previewRef.current.play().catch(() => {})
      }

      const mime = getBestMime()
      const rec = new MediaRecorder(finalStream, {
        mimeType: mime,
        videoBitsPerSecond: 3_000_000,
      })

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      rec.onstop = () => {
        const mime2 = rec.mimeType || 'video/webm'
        const blob  = new Blob(chunksRef.current, { type: mime2 })
        const url   = URL.createObjectURL(blob)
        const ext   = mime2.includes('mp4') ? 'mp4' : 'webm'
        const name  = `screen-capture-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`
        const dur   = Date.now() - startRef.current - totalPausedRef.current
        setRecordings((prev) => [{
          id: crypto.randomUUID(), blob, url, name,
          size: blob.size, duration: dur, mimeType: mime2, ts: Date.now(),
        }, ...prev])
        setState('stopped')
        stopTimer()
        stopStream()
      }

      rec.onerror = () => {
        setError('Recording error — stopped.')
        setState('idle')
        stopTimer(); stopStream()
      }

      // Handle screen share stop via browser UI
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (rec.state !== 'inactive') rec.stop()
      })

      rec.start(1000)
      recRef.current = rec
      setState('recording')
      startTimer()
    } catch (e: any) {
      if (e.name === 'NotAllowedError') setError('Permission denied — allow screen sharing in your browser.')
      else setError(e.message || 'Could not start screen capture.')
    }
  }, [withAudio, micAudio, startTimer, stopTimer, stopStream])

  const stopRecording = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.stop()
    }
  }, [])

  const pauseResume = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    if (rec.state === 'recording') {
      rec.pause()
      pausedAtRef.current = Date.now()
      stopTimer()
      setState('paused')
    } else if (rec.state === 'paused') {
      totalPausedRef.current += Date.now() - pausedAtRef.current
      rec.resume()
      startTimer()
      setState('recording')
    }
  }, [startTimer, stopTimer])

  const discard = useCallback((id: string) => {
    setRecordings((prev) => {
      const r = prev.find((x) => x.id === id)
      if (r) URL.revokeObjectURL(r.url)
      return prev.filter((x) => x.id !== id)
    })
  }, [])

  const downloadRec = useCallback((r: Recording) => {
    const a = document.createElement('a')
    a.href = r.url; a.download = r.name; a.click()
  }, [])

  useEffect(() => () => { stopTimer(); stopStream() }, [stopTimer, stopStream])

  if (!supported) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle size={32} className="text-amber-400" />
        <p className="text-sm font-semibold text-[var(--text)]">Screen Capture Not Supported</p>
        <p className="text-xs text-[var(--text-3)] max-w-sm">
          Your browser doesn't support <code>getDisplayMedia</code>. Use Chrome 72+, Edge 79+, or Firefox 66+.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Preview */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0a0e18] border border-[var(--border)] aspect-video flex items-center justify-center">
        <video ref={previewRef} className="w-full h-full object-contain" muted playsInline />
        {state === 'idle' || state === 'stopped' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--text-3)]">
            <Monitor size={44} strokeWidth={1.2} />
            <p className="text-sm">{state === 'stopped' ? 'Recording saved' : 'Preview will appear here'}</p>
          </div>
        ) : null}
        {/* Recording indicator */}
        {state === 'recording' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/90 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-bold text-white tabular-nums">{fmtDur(elapsed)}</span>
          </div>
        )}
        {state === 'paused' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-600/90 backdrop-blur-sm">
            <Pause size={11} className="text-white" />
            <span className="text-xs font-bold text-white tabular-nums">{fmtDur(elapsed)}</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span className="text-xs">{error}</span>
        </div>
      )}

      {/* Options */}
      {state === 'idle' && (
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div onClick={() => setWithAudio((v) => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative ${withAudio ? 'bg-[var(--brand)]' : 'bg-[var(--bg-hover)]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${withAudio ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-[var(--text-2)]">System audio</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div onClick={() => setMicAudio((v) => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative ${micAudio ? 'bg-[var(--brand)]' : 'bg-[var(--bg-hover)]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${micAudio ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-[var(--text-2)] flex items-center gap-1">
              {micAudio ? <Mic size={11}/> : <MicOff size={11}/>} Microphone
            </span>
          </label>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        {state === 'idle' && (
          <button onClick={startRecording}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:opacity-90 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-red-900/30">
            <Video size={15} /> Start Recording
          </button>
        )}
        {(state === 'recording' || state === 'paused') && (
          <>
            <button onClick={pauseResume}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-hover)] hover:bg-[var(--border)] text-[var(--text)] font-semibold text-sm rounded-xl border border-[var(--border)] transition-colors">
              {state === 'paused' ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
            </button>
            <button onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 font-semibold text-sm rounded-xl border border-red-800/50 transition-colors">
              <StopCircle size={14} /> Stop
            </button>
          </>
        )}
        {state === 'stopped' && (
          <button onClick={() => setState('idle')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--brand)] to-[var(--accent)] hover:opacity-90 text-white font-semibold text-sm rounded-xl transition-all">
            <Video size={15} /> New Recording
          </button>
        )}
      </div>

      {/* Recordings list */}
      {recordings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">Saved Recordings</h3>
          {recordings.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--text)] truncate">{r.name}</p>
                <p className="text-[10px] text-[var(--text-3)]">
                  {fmtDur(r.duration)} · {fmtBytes(r.size)} · {r.mimeType.split(';')[0]}
                </p>
              </div>
              <button onClick={() => downloadRec(r)} title="Download"
                className="p-2 rounded-lg text-[var(--text-2)] hover:text-emerald-400 hover:bg-emerald-900/20 transition-colors">
                <Download size={14} />
              </button>
              <button onClick={() => discard(r.id)} title="Discard"
                className="p-2 rounded-lg text-[var(--text-3)] hover:text-red-400 hover:bg-red-900/20 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
