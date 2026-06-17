'use client'
import type { AnalyzeResult } from '@/lib/types'
import { fmtBytes } from '@/lib/api'

interface Props {
  info:       AnalyzeResult
  format:     string
  quality:    string
  onFormat:   (f: string) => void
  onQuality:  (q: string) => void
}

const VIDEO_FMTS  = ['mp4','webm','mkv','avi','mov','flv','3gp','mp3','m4a','opus','flac','wav','aac','ogg']
const IMAGE_FMTS  = ['original','jpg','png','webp','avif','bmp','gif','tiff']
const AUDIO_FMTS  = new Set(['mp3','m4a','opus','flac','wav','aac','ogg','vorbis'])

const FMT_BG: Record<string, string> = {
  mp4:'bg-blue-600', webm:'bg-violet-600', mkv:'bg-indigo-600',
  avi:'bg-cyan-700',  mov:'bg-sky-700', flv:'bg-blue-800', '3gp':'bg-slate-700',
  mp3:'bg-pink-600',  m4a:'bg-rose-600',  opus:'bg-fuchsia-600',
  flac:'bg-pink-700', wav:'bg-rose-700', aac:'bg-fuchsia-700', ogg:'bg-pink-800',
  original:'bg-slate-600', jpg:'bg-amber-600', png:'bg-teal-600',
  webp:'bg-emerald-600', avif:'bg-lime-700', bmp:'bg-orange-700',
  gif:'bg-yellow-700', tiff:'bg-amber-700',
}

interface Preset { label: string; hint: string; format: string; quality: string; color: string }

const VIDEO_PRESETS: Preset[] = [
  { label: 'Best',    hint: 'Highest available quality',  format: 'mp4', quality: 'best', color: 'bg-violet-600' },
  { label: 'HD 1080', hint: '1080p MP4',                  format: 'mp4', quality: '1080', color: 'bg-blue-600'   },
  { label: 'Mobile',  hint: '720p — smaller file size',   format: 'mp4', quality: '720',  color: 'bg-sky-600'    },
  { label: 'Audio',   hint: 'Extract audio as MP3',       format: 'mp3', quality: 'best', color: 'bg-pink-600'   },
  { label: 'Compact', hint: '480p — smallest file',       format: 'mp4', quality: '480',  color: 'bg-slate-600'  },
]

function Chip({ label, active, bg, onClick }: {
  label: string; active: boolean; bg?: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-100 border ${
        active
          ? `${bg ?? 'bg-blue-600'} text-white border-transparent shadow-md`
          : 'bg-transparent text-[#94a3b8] border-[#21293a] hover:border-[#2d3a4f] hover:text-[#f1f5f9]'
      }`}
    >
      {label}
    </button>
  )
}

function PresetChip({ p, active, onApply }: { p: Preset; active: boolean; onApply: () => void }) {
  return (
    <button
      type="button"
      onClick={onApply}
      title={p.hint}
      className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-100 border ${
        active
          ? `${p.color} text-white border-transparent shadow-md`
          : 'bg-[#161b27] text-[#64748b] border-[#21293a] hover:border-[#2d3a4f] hover:text-[#94a3b8]'
      }`}
    >
      {p.label}
    </button>
  )
}

export default function FormatSelector({ info, format, quality, onFormat, onQuality }: Props) {
  const isVideo   = info.type === 'video' || info.type === 'playlist' || info.type === 'profile'
  const isAudio   = AUDIO_FMTS.has(format)
  const fmts      = isVideo ? VIDEO_FMTS : IMAGE_FMTS
  const qualities = info.qualities ?? []
  const detailed  = info.format_options ?? []

  const activePreset = isVideo
    ? VIDEO_PRESETS.find((p) => p.format === format && p.quality === quality) ?? null
    : null

  return (
    <div className="space-y-2.5">
      {/* Quick presets row — video only */}
      {isVideo && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-[#2d3a4f] uppercase tracking-[0.15em] font-bold w-14 shrink-0">
            Preset
          </span>
          <div className="flex flex-wrap gap-1.5">
            {VIDEO_PRESETS.map((p) => (
              <PresetChip
                key={p.label}
                p={p}
                active={activePreset?.label === p.label}
                onApply={() => { onFormat(p.format); onQuality(p.quality) }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Format row */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[10px] text-[#2d3a4f] uppercase tracking-[0.15em] font-bold w-14 shrink-0">
          Format
        </span>
        <div className="flex flex-wrap gap-1.5">
          {fmts.map((f) => (
            <Chip key={f} label={f} active={format===f} bg={FMT_BG[f]} onClick={() => onFormat(f)} />
          ))}
        </div>
      </div>

      {/* Quality row — video only, not for audio formats */}
      {isVideo && !isAudio && !info.is_stream && (
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[10px] text-[#2d3a4f] uppercase tracking-[0.15em] font-bold w-14 shrink-0">
            Quality
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Chip label="Best" active={quality==='best'} bg="bg-violet-600" onClick={() => onQuality('best')} />
            {detailed.length > 0
              ? detailed.map((o) => {
                  const bits = [
                    o.fps && o.fps > 30 ? `${o.fps}fps` : null,
                    o.size ? fmtBytes(o.size) : null,
                    o.vcodec ? o.vcodec : null,
                  ].filter(Boolean).join(' · ')
                  return (
                    <button key={o.height} type="button" title={bits || undefined}
                      onClick={() => onQuality(String(o.height))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-100 border ${
                        quality===String(o.height)
                          ? 'bg-violet-600 text-white border-transparent shadow-md'
                          : 'bg-transparent text-[#94a3b8] border-[#21293a] hover:border-[#2d3a4f] hover:text-[#f1f5f9]'
                      }`}>
                      <span className="uppercase tracking-wide">{o.height}p</span>
                      {bits && <span className="ml-1.5 font-medium normal-case opacity-70">{bits}</span>}
                    </button>
                  )
                })
              : qualities.map((q) => (
                  <Chip key={q} label={`${q}p`} active={quality===String(q)} bg="bg-violet-600"
                    onClick={() => onQuality(String(q))} />
                ))}
          </div>
        </div>
      )}
    </div>
  )
}
