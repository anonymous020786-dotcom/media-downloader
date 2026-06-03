'use client'
import { memo, useState } from 'react'
import Image from 'next/image'
import {
  Trash2, RotateCcw, Film, ImageIcon, Globe, Music,
  CheckCircle2, XCircle, Clock, Loader2, Wifi,
  Download, FolderOpen, FileVideo, FileImage, File, HardDriveDownload, Play,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Job, JobStatus } from '@/lib/types'
import { fmtBytes, fmtSpeed, fmtEta, fmtDuration, fileDownloadUrl, zipDownloadUrl } from '@/lib/api'
import { saveToLocation } from '@/lib/save'
import MediaViewer from './download/MediaViewer'

interface Props {
  job:      Job
  onDelete: (id: string) => void
  onRetry:  (id: string) => void
}

const STATUS: Record<JobStatus, { label: string; cls: string }> = {
  queued:      { label: 'Queued',      cls: 'bg-slate-700/80 text-slate-300' },
  starting:    { label: 'Starting',    cls: 'bg-blue-900/50 text-blue-300' },
  downloading: { label: 'Downloading', cls: 'bg-cyan-900/50 text-cyan-300' },
  scraping:    { label: 'Scraping',    cls: 'bg-violet-900/50 text-violet-300' },
  converting:  { label: 'Converting',  cls: 'bg-amber-900/50 text-amber-300' },
  processing:  { label: 'Processing',  cls: 'bg-amber-900/50 text-amber-300' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-900/50 text-emerald-300' },
  failed:      { label: 'Failed',      cls: 'bg-red-900/50 text-red-400' },
}

const AUDIO = new Set(['mp3','m4a','opus','ogg','flac','wav'])
const VIDEO_EXT = new Set(['mp4','mkv','webm','avi','mov','ts','flv'])
const IMAGE_EXT = new Set(['jpg','jpeg','png','gif','webp','avif','bmp','svg'])

function FileIcon({ name }: { name: string }) {
  const e = (name.split('.').pop() ?? '').toLowerCase()
  if (VIDEO_EXT.has(e)) return <FileVideo size={11} className="text-blue-400 shrink-0" />
  if (IMAGE_EXT.has(e)) return <FileImage size={11} className="text-cyan-400 shrink-0" />
  return <File size={11} className="text-slate-500 shrink-0" />
}

function StatusIcon({ s }: { s: JobStatus }) {
  if (s === 'completed') return <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
  if (s === 'failed')    return <XCircle      size={11} className="text-red-400 shrink-0" />
  if (s === 'queued')    return <Clock        size={11} className="text-slate-500 shrink-0" />
  return <Loader2 size={11} className="text-cyan-400 shrink-0 spin" />
}

function Thumb({ job }: { job: Job }) {
  if (job.thumbnail) {
    return (
      <Image
        src={job.thumbnail} alt="" width={72} height={52}
        className="object-cover w-full h-full"
        unoptimized loading="lazy"
      />
    )
  }
  const cls = 'text-slate-600'
  if (AUDIO.has(job.format))       return <Music    size={22} className={cls} />
  if (job.mediaType === 'video' || job.mediaType === 'playlist' || job.mediaType === 'profile')
    return <Film size={22} className={cls} />
  if (job.mediaType === 'image')   return <ImageIcon size={22} className={cls} />
  return <Globe size={22} className={cls} />
}

function JobCardInner({ job, onDelete, onRetry }: Props) {
  const { progress, format, jobId } = job
  const [viewerIdx, setViewerIdx] = useState<number | null>(null)
  const pct     = Math.min(100, Math.max(0, progress.progress))
  const isDone  = progress.status === 'completed'
  const isFail  = progress.status === 'failed'
  const isQueue = progress.status === 'queued'
  const isActive = !isDone && !isFail && !isQueue

  const st  = STATUS[progress.status] ?? STATUS.queued
  const files = progress.files ?? []
  const label = job.title
    ?? (() => { try { return new URL(job.url).hostname } catch { return job.url } })()

  const cardBg   = isDone ? 'border-emerald-800/30 bg-emerald-950/20'
                 : isFail ? 'border-red-800/30 bg-red-950/20'
                 : 'border-[#21293a] bg-[#161b27]'
  const barColor = isFail  ? 'bg-red-500'
                 : isDone  ? 'progress-shimmer-success'
                 : 'progress-shimmer'

  return (
    <div
      className={`group relative animate-in rounded-2xl border overflow-hidden
                  transition-colors duration-200 hover:border-[#2d3a4f] ${cardBg}`}
    >
      {/* Top progress stripe */}
      {!isQueue && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[#21293a]">
          <div className={`h-full transition-all duration-700 ${barColor}`}
               style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Main row */}
      <div className="flex gap-3 p-4 pt-[18px]">
        {/* Thumbnail */}
        <div className="shrink-0 w-16 h-12 sm:w-[72px] sm:h-[52px] rounded-xl overflow-hidden bg-[#21293a]/60 flex items-center justify-center">
          <Thumb job={job} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Title + badges */}
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[#f1f5f9] line-clamp-1 flex-1 min-w-0 leading-tight"
               title={label}>
              {label}
            </p>
            <div className="flex items-center gap-1 shrink-0 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${st.cls}`}>
                <StatusIcon s={progress.status} />{st.label}
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[#21293a] text-[#94a3b8]">
                {format || 'orig'}
              </span>
              {job.quality && job.quality !== 'best' && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#21293a] text-[#94a3b8]">
                  {job.quality}p
                </span>
              )}
              {(job.mediaType === 'playlist' || job.mediaType === 'profile') && job.maxItems && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-violet-900/40 text-violet-300">
                  ≤{job.maxItems} items
                </span>
              )}
            </div>
          </div>

          {/* URL */}
          <p className="text-[11px] text-[#475569] truncate">{job.url}</p>

          {/* Stats row */}
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-[#475569] truncate flex-1 min-w-0">
              {isActive && progress.downloaded != null
                ? `${fmtBytes(progress.downloaded)} / ${fmtBytes(progress.total)}`
                : isActive && progress.total_files
                ? `${progress.completed_files ?? 0} / ${progress.total_files} files`
                : isDone && files.length > 0
                ? `${files.length} file${files.length !== 1 ? 's' : ''} ready`
                : isDone
                ? 'Ready'
                : isFail
                ? <span className="text-red-400/70 text-[10px]">{progress.error ?? 'Failed'}</span>
                : <span className="text-[#2d3a4f]">Waiting in queue…</span>}
            </span>

            <span className="flex items-center gap-2 shrink-0 text-[#475569]">
              {isActive && progress.speed  != null && (
                <span className="text-cyan-500 font-semibold flex items-center gap-1">
                  <Wifi size={9} />{fmtSpeed(progress.speed)}
                </span>
              )}
              {isActive && progress.eta    != null && fmtEta(progress.eta)}
              {isActive && progress.filename && (
                <span className="hidden sm:inline text-[10px] text-[#2d3a4f] font-mono max-w-24 truncate" title={progress.filename}>
                  {progress.filename}
                </span>
              )}
              {!isQueue && (
                <span className={`font-bold tabular-nums ${isDone ? 'text-emerald-400' : isFail ? 'text-red-400' : 'text-[#94a3b8]'}`}>
                  {pct}%
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ── No-files fallback (completed but nothing saved) ──────────── */}
      {isDone && files.length === 0 && (
        <div className="border-t border-amber-900/30 bg-amber-950/15 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-amber-300/80 leading-snug">
            Finished, but no file was captured. The source may block downloads, need login (add cookies), or be DRM-protected.
          </p>
          <button onClick={() => onRetry(job.bullId)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition-colors">
            <RotateCcw size={12} /> Retry
          </button>
        </div>
      )}

      {/* ── Download panel ─────────────────────────────────────────── */}
      {isDone && files.length > 0 && (
        <div className="border-t border-emerald-900/30 bg-emerald-950/15 px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] text-emerald-600/80 uppercase tracking-widest font-bold flex items-center gap-1.5">
              <FolderOpen size={10} />{files.length} file{files.length !== 1 ? 's' : ''} ready
            </p>
            {files.length > 1 && (
              <div className="flex items-center gap-1.5">
                {/* Instant ZIP download */}
                <a href={zipDownloadUrl(jobId)} download={`mediadl-${jobId.slice(0,8)}.zip`}
                  title="Download all files as one ZIP"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors">
                  <FolderOpen size={12} /> Download ZIP
                </a>
                {/* Pick a folder for the ZIP */}
                <button
                  onClick={async () => {
                    const r = await saveToLocation(zipDownloadUrl(jobId), `mediadl-${jobId.slice(0,8)}.zip`)
                    if (r === 'error') toast.error('Could not save ZIP')
                  }}
                  title="Choose a folder to save the ZIP"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-700/40 text-emerald-200 text-[11px] font-bold transition-colors">
                  <HardDriveDownload size={12} /> Save as…
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {files.map((f, idx) => {
              const url = fileDownloadUrl(jobId, f)
              const save = async () => {
                const r = await saveToLocation(url, f)
                if (r === 'picker') toast.success('Saved to your device')
                else if (r === 'error') toast.error('Could not save file')
              }
              return (
                <div key={f}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl
                    bg-emerald-900/15 border border-emerald-800/25 transition-all">
                  <FileIcon name={f} />
                  <span className="flex-1 min-w-0 text-[11px] truncate font-mono text-emerald-200/90" title={f}>{f}</span>
                  {/* Preview / play in-app */}
                  <button onClick={() => setViewerIdx(idx)} title="Preview / play"
                    className="shrink-0 p-1.5 rounded-md text-emerald-300/70 hover:text-emerald-200 hover:bg-emerald-800/40 transition-colors">
                    <Play size={13} />
                  </button>
                  {/* PRIMARY: one-click download (no prompt) */}
                  <a href={url} download={f} title="Download now"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors">
                    <Download size={13} /> Download
                  </a>
                  {/* Secondary: pick a folder */}
                  <button onClick={save} title="Choose a folder to save in"
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-700/40 text-emerald-200 text-[11px] font-bold transition-colors">
                    <HardDriveDownload size={13} /> Save as…
                  </button>
                </div>
              )
            })}
          </div>
          <p className="text-[9px] text-emerald-700/70 mt-1.5">
            ↳ <strong>Download</strong> saves instantly to your browser's download folder. <strong>Save as…</strong> lets you pick a folder (Chrome/Edge).
          </p>
        </div>
      )}

      {/* In-app media viewer / player */}
      {viewerIdx !== null && (
        <MediaViewer
          items={files.map((f) => ({ url: fileDownloadUrl(jobId, f), name: f }))}
          index={viewerIdx}
          onClose={() => setViewerIdx(null)}
        />
      )}

      {/* Hover action buttons */}
      <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
        {isFail && (
          <button onClick={() => onRetry(job.bullId)} title="Retry"
            className="p-1.5 rounded-lg bg-[#21293a] hover:bg-amber-700 text-[#94a3b8] hover:text-white transition-colors">
            <RotateCcw size={12} />
          </button>
        )}
        <button onClick={() => onDelete(job.bullId)} title="Remove"
          className="p-1.5 rounded-lg bg-[#21293a] hover:bg-red-700 text-[#94a3b8] hover:text-white transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// Memo: only re-render when progress or bullId changes
export default memo(JobCardInner, (prev, next) =>
  prev.job.bullId    === next.job.bullId &&
  prev.job.progress.status   === next.job.progress.status &&
  prev.job.progress.progress === next.job.progress.progress &&
  prev.job.progress.speed    === next.job.progress.speed &&
  (prev.job.progress.files?.length ?? 0) === (next.job.progress.files?.length ?? 0)
)
