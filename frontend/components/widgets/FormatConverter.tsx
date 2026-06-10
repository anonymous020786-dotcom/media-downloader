'use client'
import { useEffect, useState } from 'react'
import { Wand2, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle, FolderOpen, Download } from 'lucide-react'
import { fetchStorage, convertFile, fileDownloadUrl, fmtBytes } from '@/lib/api'
import type { StorageJob, ConvertRequest } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

const VIDEO_FORMATS = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'gif']
const AUDIO_FORMATS = ['mp3', 'm4a', 'opus', 'ogg', 'flac', 'wav', 'aac']
const VIDEO_CODECS  = [{ v: '', label: 'Auto' }, { v: 'libx264', label: 'H.264' }, { v: 'libx265', label: 'H.265/HEVC' }, { v: 'libvpx-vp9', label: 'VP9' }, { v: 'copy', label: 'Copy (no re-encode)' }]
const RESOLUTIONS   = [{ v: '', label: 'Original' }, { v: '1920:1080', label: '1080p' }, { v: '1280:720', label: '720p' }, { v: '854:480', label: '480p' }, { v: '640:360', label: '360p' }]
const AUDIO_BITRATES= [{ v: '', label: 'Auto' }, { v: '320k', label: '320 kbps' }, { v: '192k', label: '192 kbps' }, { v: '128k', label: '128 kbps' }, { v: '96k', label: '96 kbps' }]

type ConvertStatus = 'idle' | 'converting' | 'done' | 'error'

interface ConvertResult { outputFile: string; outputJobId: string; size: number }

export default function FormatConverter() {
  const [jobs,       setJobs]       = useState<StorageJob[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selJobId,   setSelJobId]   = useState('')
  const [selFile,    setSelFile]    = useState('')
  const [outFmt,     setOutFmt]     = useState('mp4')
  const [extractAudio, setExtractAudio] = useState(false)
  const [vCodec,     setVCodec]     = useState('')
  const [resolution, setResolution] = useState('')
  const [crf,        setCrf]        = useState<number | ''>('')
  const [aBitrate,   setABitrate]   = useState('')
  const [startTime,  setStartTime]  = useState('')
  const [endTime,    setEndTime]    = useState('')
  const [gifFps,     setGifFps]     = useState(10)
  const [gifScale,   setGifScale]   = useState(480)
  const [showAdv,    setShowAdv]    = useState(false)
  const [status,     setStatus]     = useState<ConvertStatus>('idle')
  const [result,     setResult]     = useState<ConvertResult | null>(null)
  const [error,      setError]      = useState('')

  useEffect(() => {
    fetchStorage()
      .then((s) => { setJobs(s.jobs.filter((j) => j.file_count > 0)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const selectedJob = jobs.find((j) => j.job_id === selJobId)
  const formats     = extractAudio ? AUDIO_FORMATS : [...VIDEO_FORMATS, ...AUDIO_FORMATS]

  async function handleConvert() {
    if (!selJobId || !selFile) return
    setStatus('converting'); setError(''); setResult(null)
    const newJobId = uuidv4()
    const req: ConvertRequest = {
      job_id: selJobId, filename: selFile, output_format: outFmt,
      new_job_id: newJobId,
      extract_audio: extractAudio || AUDIO_FORMATS.includes(outFmt),
      video_codec:    vCodec     || undefined,
      resolution:     resolution || undefined,
      crf:            crf !== '' ? Number(crf) : undefined,
      audio_bitrate:  aBitrate   || undefined,
      start_time:     startTime  || undefined,
      end_time:       endTime    || undefined,
      ...(outFmt === 'gif' ? { gif_fps: gifFps, gif_scale: gifScale } : {}),
    }
    try {
      const r = await convertFile(req)
      setResult({ outputFile: r.output_file, outputJobId: r.output_job_id, size: r.size })
      setStatus('done')
      // Reload storage list to include the new file
      fetchStorage().then((s) => setJobs(s.jobs.filter((j) => j.file_count > 0)))
    } catch (e: any) {
      setError(e.message); setStatus('error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#475569]">
        <Loader2 size={20} className="spin mr-2" /> Loading downloads…
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#475569] gap-2">
        <FolderOpen size={32} strokeWidth={1.2} />
        <p className="text-sm">No downloaded files yet — download something first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Step 1 — pick file */}
      <div className="bg-[#161b27] border border-[#21293a] rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">1 — Source file</p>

        <div className="space-y-2">
          <label className="text-xs text-slate-400">Download job</label>
          <select value={selJobId} onChange={(e) => { setSelJobId(e.target.value); setSelFile('') }}
            title="Select download job" aria-label="Select download job"
            className="w-full bg-[#0d1117] border border-[#21293a] text-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500/60">
            <option value="">Select a download…</option>
            {jobs.map((j) => (
              <option key={j.job_id} value={j.job_id}>
                {j.job_id.slice(0, 8)}… — {j.file_count} file{j.file_count !== 1 ? 's' : ''} ({fmtBytes(j.total_size)})
              </option>
            ))}
          </select>
        </div>

        {selectedJob && (
          <div className="space-y-2">
            <label className="text-xs text-slate-400">File</label>
            <select value={selFile} onChange={(e) => setSelFile(e.target.value)}
              title="Select file" aria-label="Select file"
              className="w-full bg-[#0d1117] border border-[#21293a] text-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500/60">
              <option value="">Select a file…</option>
              {selectedJob.files.map((f) => (
                <option key={f.name} value={f.name}>{f.name} ({fmtBytes(f.size)})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Step 2 — output options */}
      <div className="bg-[#161b27] border border-[#21293a] rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">2 — Output format</p>

        <div className="flex items-center gap-2 flex-wrap">
          {formats.map((f) => (
            <button type="button" key={f} onClick={() => { setOutFmt(f); if (AUDIO_FORMATS.includes(f)) setExtractAudio(true) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                outFmt === f ? 'bg-indigo-600 text-white' : 'bg-[#0d1117] border border-[#21293a] text-slate-400 hover:text-slate-200'
              }`}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {(outFmt === 'mp4' || outFmt === 'webm' || outFmt === 'mkv') && (
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input type="checkbox" checked={extractAudio}
              onChange={(e) => setExtractAudio(e.target.checked)}
              className="accent-indigo-500 w-3.5 h-3.5" />
            Extract audio only (discard video)
          </label>
        )}

        {/* Advanced toggle */}
        <button type="button" onClick={() => setShowAdv(!showAdv)}
          className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
          {showAdv ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          Advanced options
        </button>

        {showAdv && (
          <div className="space-y-3 pt-1 border-t border-[#21293a]">
            {/* Time range / clip */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-8 text-right">From</span>
                <input type="text" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  placeholder="00:00" maxLength={8}
                  className="w-24 text-center bg-[#0d1117] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-8 text-right">To</span>
                <input type="text" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  placeholder="end" maxLength={8}
                  className="w-24 text-center bg-[#0d1117] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 outline-none" />
              </div>
            </div>

            {!extractAudio && !AUDIO_FORMATS.includes(outFmt) && outFmt !== 'gif' && (
              <>
                <div className="flex gap-3 flex-wrap">
                  <div className="space-y-1 flex-1 min-w-[120px]">
                    <label className="text-[10px] text-slate-500">Video codec</label>
                    <select value={vCodec} onChange={(e) => setVCodec(e.target.value)}
                      title="Video codec" aria-label="Video codec"
                      className="w-full bg-[#0d1117] border border-[#21293a] text-slate-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500/60">
                      {VIDEO_CODECS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1 flex-1 min-w-[120px]">
                    <label className="text-[10px] text-slate-500">Resolution</label>
                    <select value={resolution} onChange={(e) => setResolution(e.target.value)}
                      title="Output resolution" aria-label="Output resolution"
                      className="w-full bg-[#0d1117] border border-[#21293a] text-slate-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500/60">
                      {RESOLUTIONS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-[10px] text-slate-500 w-24">Quality (CRF)</label>
                  <input type="range" min={12} max={51} step={1}
                    value={crf !== '' ? crf : 23}
                    onChange={(e) => setCrf(Number(e.target.value))}
                    className="flex-1 accent-indigo-500" />
                  <span className="text-xs text-slate-400 w-6 text-center tabular-nums">{crf !== '' ? crf : 23}</span>
                  {crf !== '' && (
                    <button type="button" onClick={() => setCrf('')}
                      className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">Reset</button>
                  )}
                </div>
              </>
            )}

            {outFmt === 'gif' && (
              <div className="flex gap-3 flex-wrap">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">GIF FPS</label>
                  <input type="number" min={1} max={30} value={gifFps} onChange={(e) => setGifFps(Number(e.target.value))}
                    className="w-20 bg-[#0d1117] border border-[#21293a] text-slate-200 rounded-lg px-2 py-1 text-xs outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">GIF width (px)</label>
                  <input type="number" min={100} max={1920} step={10} value={gifScale} onChange={(e) => setGifScale(Number(e.target.value))}
                    className="w-24 bg-[#0d1117] border border-[#21293a] text-slate-200 rounded-lg px-2 py-1 text-xs outline-none" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Audio bitrate</label>
              <select value={aBitrate} onChange={(e) => setABitrate(e.target.value)}
                title="Audio bitrate" aria-label="Audio bitrate"
                className="bg-[#0d1117] border border-[#21293a] text-slate-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500/60">
                {AUDIO_BITRATES.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Convert button */}
      <button type="button" onClick={handleConvert}
        disabled={!selJobId || !selFile || status === 'converting'}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm
          bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90
          disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-indigo-900/30">
        {status === 'converting'
          ? <><Loader2 size={15} className="spin" /> Converting…</>
          : <><Wand2 size={15} /> Convert to {outFmt.toUpperCase()}</>}
      </button>

      {/* Result */}
      {status === 'done' && result && (
        <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-200">{result.outputFile}</p>
              <p className="text-[11px] text-emerald-600">{fmtBytes(result.size)}</p>
            </div>
          </div>
          <a href={fileDownloadUrl(result.outputJobId, result.outputFile)} download={result.outputFile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shrink-0">
            <Download size={12} /> Download
          </a>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2.5 bg-red-950/30 border border-red-800/40 rounded-2xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="text-xs leading-relaxed">{error}</span>
        </div>
      )}
    </div>
  )
}
