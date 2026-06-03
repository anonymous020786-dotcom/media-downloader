'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Settings2, Scissors, Globe, Clock, Info } from 'lucide-react'
import type { AdvancedOptions as Opts } from '@/lib/types'

interface Props {
  opts:    Opts
  onChange: (o: Opts) => void
  showPlaylistOptions?: boolean
}

const SUBTITLE_LANGS = [
  { value: 'en',    label: 'English' },
  { value: 'es',    label: 'Spanish' },
  { value: 'fr',    label: 'French' },
  { value: 'de',    label: 'German' },
  { value: 'pt',    label: 'Portuguese' },
  { value: 'it',    label: 'Italian' },
  { value: 'ru',    label: 'Russian' },
  { value: 'ja',    label: 'Japanese' },
  { value: 'ko',    label: 'Korean' },
  { value: 'zh',    label: 'Chinese' },
  { value: 'ar',    label: 'Arabic' },
  { value: 'hi',    label: 'Hindi' },
  { value: 'auto',  label: 'Auto-detect' },
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-slate-700'}`}
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
  const set = <K extends keyof Opts>(k: K, v: Opts[K]) => onChange({ ...opts, [k]: v })

  const hasClip = !!(opts.startTime || opts.endTime)
  const activeCount = [
    opts.subtitles,
    opts.embedThumbnail,
    !opts.embedMetadata,
    !!opts.cookies,
    !!opts.proxy,
    opts.capture,
    hasClip,
    showPlaylistOptions && !!opts.maxItems,
  ].filter(Boolean).length

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
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-600 text-white">
              {activeCount}
            </span>
          )}
          {hasClip && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-600/80 text-white flex items-center gap-1">
              <Scissors size={8} /> Clip
            </span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-4 pb-3 bg-[#0d1117] border-t border-[#21293a]">

          {/* ── Clip Extraction ─────────────────────────────────── */}
          <SectionHeader icon={<Scissors size={10} />} label="Clip extraction" />
          <div className="py-2 space-y-2">
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Download only a portion of a video. Leave blank to download the full video. Format: <span className="font-mono text-slate-500">MM:SS</span> or <span className="font-mono text-slate-500">HH:MM:SS</span>.
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
                <button
                  type="button"
                  onClick={() => onChange({ ...opts, startTime: '', endTime: '' })}
                  className="text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── Output ──────────────────────────────────────────── */}
          <SectionHeader icon={<Settings2 size={10} />} label="Output" />

          {showPlaylistOptions && (
            <Row label="Max items" hint="Limit downloads (blank = unlimited)">
              <input
                type="number" min={1}
                value={opts.maxItems ?? ''}
                onChange={(e) => set('maxItems', e.target.value ? Number(e.target.value) : null)}
                placeholder="∞"
                className="w-20 text-center bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none"
              />
            </Row>
          )}

          <Row label="Embed thumbnail" hint="Write the video thumbnail as cover art">
            <Toggle value={opts.embedThumbnail} onChange={(v) => set('embedThumbnail', v)} />
          </Row>

          <Row label="Embed metadata" hint="Write title, description, date into the file">
            <Toggle value={opts.embedMetadata} onChange={(v) => set('embedMetadata', v)} />
          </Row>

          {/* ── Subtitles & Language ─────────────────────────────── */}
          <SectionHeader icon={<Globe size={10} />} label="Subtitles" />

          <Row label="Download subtitles" hint="Download subtitles and embed into the video">
            <Toggle value={opts.subtitles} onChange={(v) => set('subtitles', v)} />
          </Row>

          {opts.subtitles && (
            <Row label="Subtitle language" hint="Preferred language; falls back to auto if unavailable">
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

          {/* ── Scheduling ──────────────────────────────────────── */}
          <SectionHeader icon={<Clock size={10} />} label="Scheduling" />

          <Row label="Download later (minutes)" hint="Delay start. Leave blank to start immediately.">
            <input
              type="number" min={1}
              value={opts.scheduleMinutes ?? ''}
              onChange={(e) => set('scheduleMinutes', e.target.value ? Number(e.target.value) : null)}
              placeholder="now"
              className="w-20 text-center bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none"
            />
          </Row>

          <Row label="Repeat (recurring)" hint="Re-run automatically — great for keeping a playlist updated.">
            <select
              value={opts.repeatEvery}
              onChange={(e) => set('repeatEvery', e.target.value as any)}
              className="bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none">
              <option value="">Never</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily (9 am)</option>
              <option value="weekly">Weekly (Mon)</option>
            </select>
          </Row>

          {/* ── Anti-blocking ────────────────────────────────────── */}
          <SectionHeader icon={<Globe size={10} />} label="Access &amp; anti-blocking" />

          <Row label="Screen capture" hint="Record MSE/blob streams that have no downloadable URL. Not for DRM.">
            <Toggle value={opts.capture} onChange={(v) => set('capture', v)} />
          </Row>

          <Row label="Browser cookies" hint="Paste cookies (Netscape format) for members-only / age-restricted content">
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

          <Row label="Proxy" hint="Route through a proxy to bypass geo-blocks and rate limits">
            <input
              value={opts.proxy}
              onChange={(e) => set('proxy', e.target.value)}
              placeholder="http://host:port"
              className="w-40 bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1 text-xs text-slate-300 placeholder-slate-600 font-mono outline-none"
            />
          </Row>

          <div className="flex items-start gap-2 pt-3 text-[10px] text-slate-600">
            <Info size={10} className="mt-0.5 shrink-0" />
            <span>All downloads run server-side via yt-dlp + FFmpeg. Cookies and proxy are never stored — used only for the current session.</span>
          </div>
        </div>
      )}
    </div>
  )
}
