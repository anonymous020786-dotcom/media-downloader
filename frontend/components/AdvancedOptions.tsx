'use client'
import { useState } from 'react'
import {
  ChevronDown, ChevronUp, Settings2, Scissors, Globe,
  Clock, Info, Zap, Music, FileText, Wifi, Gauge,
} from 'lucide-react'
import type { AdvancedOptions as Opts } from '@/lib/types'

interface Props {
  opts:    Opts
  onChange: (o: Opts) => void
  showPlaylistOptions?: boolean
}

const SUBTITLE_LANGS = [
  { value: 'en',   label: 'English'    },
  { value: 'es',   label: 'Spanish'    },
  { value: 'fr',   label: 'French'     },
  { value: 'de',   label: 'German'     },
  { value: 'pt',   label: 'Portuguese' },
  { value: 'it',   label: 'Italian'    },
  { value: 'ru',   label: 'Russian'    },
  { value: 'ja',   label: 'Japanese'   },
  { value: 'ko',   label: 'Korean'     },
  { value: 'zh',   label: 'Chinese'    },
  { value: 'ar',   label: 'Arabic'     },
  { value: 'hi',   label: 'Hindi'      },
  { value: 'auto', label: 'Auto-detect'},
]

const OUTPUT_TEMPLATES = [
  { label: 'Default',              value: ''                                          },
  { label: 'Title only',           value: '%(title)s.%(ext)s'                         },
  { label: 'Uploader – Title',     value: '%(uploader)s - %(title)s.%(ext)s'          },
  { label: 'Date – Title',         value: '%(upload_date>%Y-%m-%d)s %(title)s.%(ext)s'},
  { label: 'ID – Title',           value: '%(id)s %(title)s.%(ext)s'                  },
  { label: 'Playlist index',       value: '%(playlist_index)03d %(title)s.%(ext)s'    },
  { label: 'Custom…',              value: '__custom__'                                },
]

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1">
      <span className="text-slate-600">{icon}</span>
      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.18em]">{label}</span>
      <div className="flex-1 h-px bg-[#21293a]" />
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[#1a2030] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 font-medium">{label}</p>
        {hint && <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange, color = 'bg-indigo-600' }: { value: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors ${value ? color : 'bg-slate-700'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function TimeInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const valid = !value || /^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/.test(value)
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={8}
      className={`w-24 text-center bg-[#161b27] border rounded-lg px-2 py-1 text-xs font-mono outline-none transition-colors
        ${valid ? 'border-[#21293a] focus:border-indigo-500/60 text-slate-200' : 'border-red-600/60 text-red-400'}`}
    />
  )
}

export default function AdvancedOptions({ opts, onChange, showPlaylistOptions = false }: Props) {
  const [open, setOpen] = useState(false)
  const [customTemplate, setCustomTemplate] = useState('')
  const set = <K extends keyof Opts>(k: K, v: Opts[K]) => onChange({ ...opts, [k]: v })

  const hasClip     = !!(opts.startTime || opts.endTime)
  const hasPostProc = opts.sponsorBlock || opts.splitChapters || opts.normalizeAudio
  const hasNetwork  = !!(opts.speedLimit || opts.concurrentFragments !== 16 || opts.cookies || opts.proxy)

  const activeCount = [
    opts.subtitles, opts.embedThumbnail, opts.writeThumbnail, !opts.embedMetadata,
    !!opts.cookies, !!opts.proxy, opts.capture, hasClip,
    opts.sponsorBlock, opts.splitChapters, opts.normalizeAudio,
    !!opts.speedLimit, opts.concurrentFragments !== 16, !!opts.outputTemplate,
    showPlaylistOptions && !!opts.maxItems,
    opts.priority !== 5,
  ].filter(Boolean).length

  const selectedTpl = OUTPUT_TEMPLATES.find(t => t.value === opts.outputTemplate) ?? OUTPUT_TEMPLATES.find(t => t.value === '__custom__')!

  return (
    <div className="rounded-xl border border-[#21293a] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-400 hover:text-slate-200 hover:bg-[#1a2235] transition-colors"
      >
        <span className="flex items-center gap-2">
          <Settings2 size={13} />
          <span className="font-medium">Advanced options</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-600 text-white">{activeCount}</span>
          )}
          {hasClip && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-600/80 text-white flex items-center gap-1">
              <Scissors size={8} /> Clip
            </span>
          )}
          {opts.sponsorBlock && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-700/80 text-white">SponsorBlock</span>
          )}
          {opts.splitChapters && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-700/80 text-white">Chapters</span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-4 pb-3 bg-[#0d1117] border-t border-[#21293a]">

          {/* ── Clip Extraction ──────────────────────────────────── */}
          <SectionHeader icon={<Scissors size={10} />} label="Clip extraction" />
          <div className="py-2 space-y-2">
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Download only a portion of the video. Format: <span className="font-mono text-slate-500">MM:SS</span> or <span className="font-mono text-slate-500">HH:MM:SS</span>
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-8 text-right">From</span>
                <TimeInput value={opts.startTime} onChange={(v) => set('startTime', v)} placeholder="00:00" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-8 text-right">To</span>
                <TimeInput value={opts.endTime} onChange={(v) => set('endTime', v)} placeholder="03:30" />
              </div>
              {(opts.startTime || opts.endTime) && (
                <button type="button" onClick={() => onChange({ ...opts, startTime: '', endTime: '' })}
                  className="text-[10px] text-slate-600 hover:text-red-400 transition-colors">Clear</button>
              )}
            </div>
          </div>

          {/* ── Post-processing ──────────────────────────────────── */}
          <SectionHeader icon={<Zap size={10} />} label="Post-processing" />

          <Row
            label="SponsorBlock"
            hint="Auto-remove sponsor segments, intros, outros, and self-promo from YouTube videos using community-sourced timestamps"
          >
            <Toggle value={opts.sponsorBlock} onChange={(v) => set('sponsorBlock', v)} color="bg-emerald-600" />
          </Row>

          <Row
            label="Split by chapters"
            hint="Save each video chapter as a separate file — great for long lectures, podcasts, and compilations"
          >
            <Toggle value={opts.splitChapters} onChange={(v) => set('splitChapters', v)} color="bg-violet-600" />
          </Row>

          <Row
            label="Normalize audio"
            hint="Apply FFmpeg loudnorm to balance volume levels — useful when mixing content from different sources"
          >
            <Toggle value={opts.normalizeAudio} onChange={(v) => set('normalizeAudio', v)} color="bg-amber-600" />
          </Row>

          {/* ── Output ───────────────────────────────────────────── */}
          <SectionHeader icon={<FileText size={10} />} label="Output" />

          {showPlaylistOptions && (
            <Row label="Max items" hint="Limit downloads (blank = unlimited)">
              <input type="number" min={1}
                value={opts.maxItems ?? ''}
                onChange={(e) => set('maxItems', e.target.value ? Number(e.target.value) : null)}
                placeholder="∞"
                className="w-20 text-center bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none"
              />
            </Row>
          )}

          <Row label="Embed thumbnail" hint="Write the video thumbnail as cover art inside the file">
            <Toggle value={opts.embedThumbnail} onChange={(v) => set('embedThumbnail', v)} />
          </Row>

          <Row label="Save thumbnail separately" hint="Also save the thumbnail as a separate .jpg/.webp file">
            <Toggle value={opts.writeThumbnail} onChange={(v) => set('writeThumbnail', v)} />
          </Row>

          <Row label="Embed metadata" hint="Write title, description, upload date, and chapters into the file">
            <Toggle value={opts.embedMetadata} onChange={(v) => set('embedMetadata', v)} />
          </Row>

          <Row label="Filename template" hint="How output files are named. Uses yt-dlp template variables.">
            <select
              value={selectedTpl?.value === '__custom__' && opts.outputTemplate ? '__custom__' : opts.outputTemplate}
              onChange={(e) => {
                if (e.target.value === '__custom__') { set('outputTemplate', customTemplate || '%(title)s.%(ext)s') }
                else { set('outputTemplate', e.target.value) }
              }}
              className="bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none max-w-[200px]"
            >
              {OUTPUT_TEMPLATES.map((t) => (
                <option key={t.label} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Row>
          {opts.outputTemplate && !OUTPUT_TEMPLATES.slice(0,-1).some(t => t.value === opts.outputTemplate) && (
            <div className="pb-2">
              <input
                value={opts.outputTemplate}
                onChange={(e) => set('outputTemplate', e.target.value)}
                placeholder="%(title)s.%(ext)s"
                className="w-full bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 outline-none"
              />
              <p className="text-[9px] text-slate-700 mt-1">Variables: %(title)s %(uploader)s %(upload_date)s %(id)s %(ext)s %(playlist_index)s</p>
            </div>
          )}

          {/* ── Subtitles ─────────────────────────────────────────── */}
          <SectionHeader icon={<Globe size={10} />} label="Subtitles" />

          <Row label="Download subtitles" hint="Download and embed subtitles into the video file">
            <Toggle value={opts.subtitles} onChange={(v) => set('subtitles', v)} />
          </Row>

          {opts.subtitles && (
            <Row label="Subtitle language" hint="Preferred language — falls back to auto if unavailable">
              <select
                value={opts.subtitleLang}
                onChange={(e) => set('subtitleLang', e.target.value)}
                className="bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none"
              >
                {SUBTITLE_LANGS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </Row>
          )}

          {/* ── Network / Anti-blocking ───────────────────────────── */}
          <SectionHeader icon={<Wifi size={10} />} label="Network &amp; anti-blocking" />

          <Row label="Speed limit" hint="Cap download speed to avoid rate-limiting (e.g. 5M = 5 MB/s, 500K = 500 KB/s, empty = unlimited)">
            <input
              value={opts.speedLimit}
              onChange={(e) => set('speedLimit', e.target.value)}
              placeholder="e.g. 5M"
              className="w-24 bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1 text-xs text-slate-300 font-mono outline-none"
            />
          </Row>

          <Row label="Parallel fragments" hint="Simultaneous HLS/DASH fragment downloads (1–16). Reduce on unstable connections.">
            <div className="flex items-center gap-2">
              <input
                type="range" min={1} max={16} step={1}
                value={opts.concurrentFragments}
                onChange={(e) => set('concurrentFragments', Number(e.target.value))}
                className="w-24 accent-indigo-500"
              />
              <span className="text-xs text-slate-400 w-4 text-center tabular-nums">{opts.concurrentFragments}</span>
            </div>
          </Row>

          <Row label="Screen capture" hint="Record MSE/blob streams that have no direct URL. Not for DRM content.">
            <Toggle value={opts.capture} onChange={(v) => set('capture', v)} />
          </Row>

          <Row label="Browser cookies" hint="Netscape-format cookies for members-only / age-restricted content">
            <div />
          </Row>
          <div className="pb-2">
            <textarea
              value={opts.cookies}
              onChange={(e) => set('cookies', e.target.value)}
              placeholder={"# Netscape HTTP Cookie File\n.youtube.com TRUE / FALSE 0 LOGIN_INFO abc..."}
              rows={3}
              className="w-full bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-400 placeholder-slate-700 outline-none resize-none"
            />
          </div>

          <Row label="Proxy" hint="Route through a proxy to bypass geo-blocks (http://host:port or socks5://host:port)">
            <input
              value={opts.proxy}
              onChange={(e) => set('proxy', e.target.value)}
              placeholder="http://host:port"
              className="w-40 bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1 text-xs text-slate-300 placeholder-slate-600 font-mono outline-none"
            />
          </Row>

          {/* ── Scheduling ────────────────────────────────────────── */}
          <SectionHeader icon={<Clock size={10} />} label="Scheduling" />

          <Row label="Download later (minutes)" hint="Delay start. Leave blank to start immediately.">
            <input type="number" min={1}
              value={opts.scheduleMinutes ?? ''}
              onChange={(e) => set('scheduleMinutes', e.target.value ? Number(e.target.value) : null)}
              placeholder="now"
              className="w-20 text-center bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none"
            />
          </Row>

          <Row label="Repeat (recurring)" hint="Re-run automatically — great for keeping a playlist up to date.">
            <select
              value={opts.repeatEvery}
              onChange={(e) => set('repeatEvery', e.target.value as any)}
              className="bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none"
            >
              <option value="">Never</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily (9 am)</option>
              <option value="weekly">Weekly (Mon)</option>
            </select>
          </Row>

          {/* ── Queue Priority ────────────────────────────────────── */}
          <SectionHeader icon={<Gauge size={10} />} label="Queue priority" />
          <Row label="Priority" hint="High-priority jobs jump the queue ahead of normal ones">
            <div className="flex items-center gap-1">
              {([1, 5, 10] as const).map((p) => {
                const labels: Record<number, string> = { 1: 'High', 5: 'Normal', 10: 'Low' }
                const colors: Record<number, string> = {
                  1: 'bg-red-600 text-white',
                  5: 'bg-indigo-600 text-white',
                  10: 'bg-slate-700 text-slate-300',
                }
                const active = opts.priority === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set('priority', p)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors
                      ${active ? colors[p] : 'bg-[#161b27] border border-[#21293a] text-slate-500 hover:text-slate-300'}`}
                  >
                    {labels[p]}
                  </button>
                )
              })}
            </div>
          </Row>

          <div className="flex items-start gap-2 pt-3 text-[10px] text-slate-600">
            <Info size={10} className="mt-0.5 shrink-0" />
            <span>All processing runs server-side via yt-dlp + FFmpeg. Cookies and proxy are used only for the current session and never stored.</span>
          </div>
        </div>
      )}
    </div>
  )
}
