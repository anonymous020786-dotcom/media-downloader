'use client'
import { useState, useRef, useEffect } from 'react'
import {
  Accessibility, Check, ChevronDown, ZoomIn, ZoomOut,
  Eye, Wind, Focus, BookOpen, RotateCcw, Type,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface A11ySettings {
  fontSize:      'sm' | 'md' | 'lg' | 'xl'
  reduceMotion:  boolean
  highContrast:  boolean
  focusVisible:  boolean
  dyslexiaFont:  boolean
  lineHeight:    'normal' | 'relaxed' | 'loose'
  letterSpacing: 'normal' | 'wide' | 'wider'
  cursorSize:    'normal' | 'large'
}

const DEFAULT: A11ySettings = {
  fontSize: 'md', reduceMotion: false, highContrast: false,
  focusVisible: false, dyslexiaFont: false,
  lineHeight: 'normal', letterSpacing: 'normal', cursorSize: 'normal',
}

const LS_KEY = 'a11y_settings'

function load(): A11ySettings {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } } catch { return DEFAULT }
}

function apply(s: A11ySettings) {
  const r = document.documentElement
  const SIZES = { sm: '14px', md: '16px', lg: '18px', xl: '20px' }
  const LH    = { normal: '1.5', relaxed: '1.75', loose: '2' }
  const LS    = { normal: 'normal', wide: '0.05em', wider: '0.1em' }
  r.style.setProperty('--a11y-font-size',       SIZES[s.fontSize])
  r.style.setProperty('--a11y-line-height',     LH[s.lineHeight])
  r.style.setProperty('--a11y-letter-spacing',  LS[s.letterSpacing])
  r.setAttribute('data-reduce-motion',   String(s.reduceMotion))
  r.setAttribute('data-high-contrast',   String(s.highContrast))
  r.setAttribute('data-focus-visible',   String(s.focusVisible))
  r.setAttribute('data-dyslexia-font',   String(s.dyslexiaFont))
  r.setAttribute('data-cursor-large',    String(s.cursorSize === 'large'))
}

export function useA11y() {
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT)
  useEffect(() => {
    const s = load()
    setSettings(s)
    apply(s)
  }, [])
  const update = (patch: Partial<A11ySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      apply(next)
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }
  const reset = () => {
    apply(DEFAULT)
    try { localStorage.removeItem(LS_KEY) } catch {}
    setSettings(DEFAULT)
  }
  return { settings, update, reset }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AccessibilityPanel() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { settings, update, reset } = useA11y()

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Accessibility settings"
        aria-expanded={open}
        title="Accessibility"
        className={`relative p-2 rounded-xl border transition-colors ${
          !isDefault
            ? 'border-[var(--brand)] text-[var(--brand)] bg-[var(--brand)]/10'
            : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-2)] hover:text-[var(--text)]'
        }`}
      >
        <Accessibility size={15} />
        {!isDefault && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--brand)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Accessibility size={15} className="text-[var(--brand)]" />
              <span className="text-sm font-bold text-[var(--text)]">Accessibility</span>
            </div>
            {!isDefault && (
              <button onClick={reset}
                className="flex items-center gap-1 text-[10px] text-[var(--text-3)] hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-900/20">
                <RotateCcw size={10} /> Reset all
              </button>
            )}
          </div>

          <div className="p-4 space-y-5 max-h-[calc(100vh-8rem)] overflow-y-auto">

            {/* Font size */}
            <Section icon={<Type size={14} />} label="Text size">
              <div className="grid grid-cols-4 gap-1.5">
                {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
                  <button key={s} onClick={() => update({ fontSize: s })}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      settings.fontSize === s
                        ? 'bg-[var(--brand)] text-white border-transparent'
                        : 'border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)]'
                    }`}>
                    {s === 'sm' ? 'Small' : s === 'md' ? 'Default' : s === 'lg' ? 'Large' : 'X-Large'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => {
                  const order = ['sm','md','lg','xl'] as const
                  const i = order.indexOf(settings.fontSize)
                  if (i > 0) update({ fontSize: order[i - 1] })
                }} className="p-1 rounded-lg border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]">
                  <ZoomOut size={14} />
                </button>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--brand)] transition-all"
                    style={{ width: `${({'sm':25,'md':50,'lg':75,'xl':100})[settings.fontSize]}%` }} />
                </div>
                <button onClick={() => {
                  const order = ['sm','md','lg','xl'] as const
                  const i = order.indexOf(settings.fontSize)
                  if (i < 3) update({ fontSize: order[i + 1] })
                }} className="p-1 rounded-lg border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]">
                  <ZoomIn size={14} />
                </button>
              </div>
            </Section>

            {/* Line height */}
            <Section icon={<ChevronDown size={14} />} label="Line spacing">
              <div className="grid grid-cols-3 gap-1.5">
                {(['normal', 'relaxed', 'loose'] as const).map((v) => (
                  <button key={v} onClick={() => update({ lineHeight: v })}
                    className={`py-1.5 rounded-xl text-xs font-semibold border capitalize transition-colors ${
                      settings.lineHeight === v
                        ? 'bg-[var(--brand)] text-white border-transparent'
                        : 'border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]'
                    }`}>{v}</button>
                ))}
              </div>
            </Section>

            {/* Letter spacing */}
            <Section icon={<Type size={14} />} label="Letter spacing">
              <div className="grid grid-cols-3 gap-1.5">
                {(['normal', 'wide', 'wider'] as const).map((v) => (
                  <button key={v} onClick={() => update({ letterSpacing: v })}
                    className={`py-1.5 rounded-xl text-xs font-semibold border capitalize transition-colors ${
                      settings.letterSpacing === v
                        ? 'bg-[var(--brand)] text-white border-transparent'
                        : 'border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]'
                    }`}>{v}</button>
                ))}
              </div>
            </Section>

            {/* Toggles */}
            <Section icon={<Eye size={14} />} label="Visual">
              <div className="space-y-2">
                <Toggle
                  icon={<Wind size={14} />}
                  label="Reduce motion"
                  desc="Disables animations and transitions"
                  checked={settings.reduceMotion}
                  onChange={(v) => update({ reduceMotion: v })}
                  color="bg-sky-500"
                />
                <Toggle
                  icon={<Eye size={14} />}
                  label="High contrast"
                  desc="Stronger color contrast for readability"
                  checked={settings.highContrast}
                  onChange={(v) => update({ highContrast: v })}
                  color="bg-yellow-500"
                />
                <Toggle
                  icon={<Focus size={14} />}
                  label="Focus highlight"
                  desc="Bright ring on focused elements"
                  checked={settings.focusVisible}
                  onChange={(v) => update({ focusVisible: v })}
                  color="bg-emerald-500"
                />
                <Toggle
                  icon={<BookOpen size={14} />}
                  label="Dyslexia-friendly font"
                  desc="Uses OpenDyslexic typeface"
                  checked={settings.dyslexiaFont}
                  onChange={(v) => update({ dyslexiaFont: v })}
                  color="bg-violet-500"
                />
                <Toggle
                  icon={<ZoomIn size={14} />}
                  label="Large cursor"
                  desc="Bigger mouse pointer"
                  checked={settings.cursorSize === 'large'}
                  onChange={(v) => update({ cursorSize: v ? 'large' : 'normal' })}
                  color="bg-pink-500"
                />
              </div>
            </Section>

          </div>

          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-hover)]/30">
            <p className="text-[10px] text-[var(--text-3)] text-center">
              Settings are saved in your browser and apply everywhere on this site.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)] uppercase tracking-widest font-bold mb-2">
        {icon}{label}
      </p>
      {children}
    </div>
  )
}

function Toggle({ icon, label, desc, checked, onChange, color }: {
  icon: React.ReactNode; label: string; desc: string
  checked: boolean; onChange: (v: boolean) => void; color: string
}) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-left ${
        checked
          ? 'border-[var(--brand)]/40 bg-[var(--brand)]/8'
          : 'border-[var(--border)] hover:bg-[var(--bg-hover)]'
      }`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${checked ? color : 'bg-[var(--bg-hover)]'} ${checked ? 'text-white' : 'text-[var(--text-3)]'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[var(--text)]">{label}</p>
        <p className="text-[10px] text-[var(--text-3)] truncate">{desc}</p>
      </div>
      <div className={`w-9 h-5 rounded-full transition-colors shrink-0 relative ${checked ? 'bg-[var(--brand)]' : 'bg-[var(--bg-hover)] border border-[var(--border)]'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
      </div>
    </button>
  )
}
