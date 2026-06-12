'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Accessibility, X, RotateCcw, Check, ChevronDown,
  ZoomIn, ZoomOut, Eye, EyeOff, Type, AlignLeft,
  Sun, Moon, Contrast, Focus, Minus, Plus,
  Volume2, VolumeX, MousePointer, Keyboard,
} from 'lucide-react'

// ── Settings shape ─────────────────────────────────────────────────────────────
interface A11yState {
  // Text
  fontSize:         number        // 80–200 (%)
  lineHeight:       number        // 100–220 (%)
  letterSpacing:    number        // 0–10 (px)
  wordSpacing:      number        // 0–20 (px)
  fontFamily:       string        // 'default'|'dyslexic'|'mono'|'serif'
  textAlign:        string        // 'left'|'center'|'right'|'justify'
  // Vision
  contrast:         number        // 50–200 (%)
  saturation:       number        // 0–200 (%)
  brightness:       number        // 50–200 (%)
  hueRotate:        number        // 0–360
  invertColors:     boolean
  grayscale:        boolean
  sepia:            boolean
  // Colour overlays
  colorOverlay:     string        // ''|'yellow'|'blue'|'green'|'pink'|'orange'
  overlayOpacity:   number        // 0–60
  // Focus / cursor
  focusRing:        boolean
  cursorSize:       string        // 'normal'|'large'|'xl'
  cursorColor:      string        // ''|'black'|'white'|'yellow'
  // Motion / animation
  reduceMotion:     boolean
  pauseAnimations:  boolean
  // Reading
  readingGuide:     boolean
  readingMask:      boolean
  readingMaskSize:  number        // 60–300
  highlightLinks:   boolean
  highlightHeadings:boolean
  // Page structure
  hideImages:       boolean
  hideVideos:       boolean
  muteMedia:        boolean
  // Keyboard / navigation
  keyboardNav:      boolean
  skipLinks:        boolean
  // Layout
  pageWidth:        string        // 'normal'|'narrow'|'wide'
  lineLength:       number        // 40–100 (ch)
  // Misc
  darkMode:         boolean
  lightMode:        boolean
  highContrast:     boolean
  monochrome:       boolean
  textShadow:       boolean
  noBold:           boolean
  noItalics:        boolean
  noUnderline:      boolean
  bigButtons:       boolean
  bigSpacing:       boolean
  tooltipsVisible:  boolean
  printFriendly:    boolean
  numberHeadings:   boolean
  dyslexiaRuler:    boolean
  zoom:             number        // 80–200
}

const DEFAULT: A11yState = {
  fontSize: 100, lineHeight: 150, letterSpacing: 0, wordSpacing: 0,
  fontFamily: 'default', textAlign: 'left',
  contrast: 100, saturation: 100, brightness: 100, hueRotate: 0,
  invertColors: false, grayscale: false, sepia: false,
  colorOverlay: '', overlayOpacity: 20,
  focusRing: false, cursorSize: 'normal', cursorColor: '',
  reduceMotion: false, pauseAnimations: false,
  readingGuide: false, readingMask: false, readingMaskSize: 120,
  highlightLinks: false, highlightHeadings: false,
  hideImages: false, hideVideos: false, muteMedia: false,
  keyboardNav: false, skipLinks: false,
  pageWidth: 'normal', lineLength: 75,
  darkMode: false, lightMode: false, highContrast: false, monochrome: false,
  textShadow: false, noBold: false, noItalics: false, noUnderline: false,
  bigButtons: false, bigSpacing: false, tooltipsVisible: false,
  printFriendly: false, numberHeadings: false, dyslexiaRuler: false,
  zoom: 100,
}

const STORAGE_KEY = 'mediadl_a11y'

function load(): A11yState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULT }
}

// ── Apply settings to DOM ──────────────────────────────────────────────────────
function applySettings(s: A11yState) {
  const r = document.documentElement
  const b = document.body

  // CSS variables
  r.style.setProperty('--a11y-font-size',      `${s.fontSize}%`)
  r.style.setProperty('--a11y-line-height',    `${s.lineHeight / 100}`)
  r.style.setProperty('--a11y-letter-spacing', `${s.letterSpacing}px`)
  r.style.setProperty('--a11y-word-spacing',   `${s.wordSpacing}px`)
  r.style.setProperty('--a11y-zoom',           `${s.zoom / 100}`)

  // Filter
  const filters = [
    s.contrast   !== 100 ? `contrast(${s.contrast}%)` : '',
    s.saturation !== 100 ? `saturate(${s.saturation}%)` : '',
    s.brightness !== 100 ? `brightness(${s.brightness}%)` : '',
    s.hueRotate         ? `hue-rotate(${s.hueRotate}deg)` : '',
    s.invertColors       ? 'invert(1)' : '',
    s.grayscale          ? 'grayscale(1)' : '',
    s.sepia              ? 'sepia(0.8)' : '',
  ].filter(Boolean).join(' ')
  b.style.filter = filters || ''

  // Font family
  const fonts: Record<string,string> = {
    default:  '',
    dyslexic: '"OpenDyslexic", "Comic Sans MS", cursive',
    mono:     '"Courier New", monospace',
    serif:    'Georgia, serif',
  }
  b.style.fontFamily = fonts[s.fontFamily] ?? ''

  // Text align
  b.style.textAlign = s.textAlign === 'left' ? '' : s.textAlign

  // Text shadow
  b.style.textShadow = s.textShadow ? '1px 1px 2px rgba(0,0,0,0.5)' : ''

  // Classes
  const cls = r.classList
  cls.toggle('a11y-focus-ring',       s.focusRing)
  cls.toggle('a11y-reduce-motion',    s.reduceMotion)
  cls.toggle('a11y-pause-animations', s.pauseAnimations)
  cls.toggle('a11y-high-contrast',    s.highContrast)
  cls.toggle('a11y-monochrome',       s.monochrome)
  cls.toggle('a11y-highlight-links',  s.highlightLinks)
  cls.toggle('a11y-highlight-headings', s.highlightHeadings)
  cls.toggle('a11y-hide-images',      s.hideImages)
  cls.toggle('a11y-hide-videos',      s.hideVideos)
  cls.toggle('a11y-no-bold',          s.noBold)
  cls.toggle('a11y-no-italics',       s.noItalics)
  cls.toggle('a11y-no-underline',     s.noUnderline)
  cls.toggle('a11y-big-buttons',      s.bigButtons)
  cls.toggle('a11y-big-spacing',      s.bigSpacing)
  cls.toggle('a11y-keyboard-nav',     s.keyboardNav)
  cls.toggle('a11y-number-headings',  s.numberHeadings)
  cls.toggle('a11y-print-friendly',   s.printFriendly)

  // Cursor
  const cursorMap: Record<string,string> = {
    normal: '', large: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'%3E%3Cpath d=\'M8 0 L8 26 L14 20 L18 30 L21 29 L17 19 L25 19 Z\' fill=\'black\' stroke=\'white\' stroke-width=\'1\'/%3E%3C/svg%3E") 0 0, auto',
    xl:     'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\' viewBox=\'0 0 48 48\'%3E%3Cpath d=\'M10 0 L10 38 L20 28 L26 44 L30 42 L24 26 L36 26 Z\' fill=\'black\' stroke=\'white\' stroke-width=\'1.5\'/%3E%3C/svg%3E") 0 0, auto',
  }
  b.style.cursor = cursorMap[s.cursorSize] ?? ''

  // Zoom
  b.style.zoom = s.zoom !== 100 ? `${s.zoom}%` : ''
}

// ── Inject global CSS once ─────────────────────────────────────────────────────
let injected = false
function injectCSS() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const style = document.createElement('style')
  style.id = 'a11y-panel-styles'
  style.textContent = `
    :root { font-size: var(--a11y-font-size, 100%); }
    * { line-height: var(--a11y-line-height, inherit) !important; }
    .a11y-focus-ring *:focus { outline: 3px solid #f59e0b !important; outline-offset: 3px !important; }
    .a11y-reduce-motion *, .a11y-reduce-motion *::before, .a11y-reduce-motion *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    .a11y-pause-animations * { animation-play-state: paused !important; }
    .a11y-high-contrast { filter: contrast(150%) !important; }
    .a11y-monochrome { filter: grayscale(1) !important; }
    .a11y-highlight-links a { background: #ff0 !important; color: #000 !important; text-decoration: underline !important; padding: 0 2px; border-radius: 2px; }
    .a11y-highlight-headings h1,.a11y-highlight-headings h2,.a11y-highlight-headings h3,.a11y-highlight-headings h4 { border-left: 4px solid #6366f1 !important; padding-left: 8px !important; }
    .a11y-hide-images img { visibility: hidden !important; }
    .a11y-hide-videos video, .a11y-hide-videos iframe { visibility: hidden !important; }
    .a11y-no-bold * { font-weight: normal !important; }
    .a11y-no-italics * { font-style: normal !important; }
    .a11y-no-underline * { text-decoration: none !important; }
    .a11y-big-buttons button, .a11y-big-buttons a[role=button], .a11y-big-buttons [class*=btn] { min-height: 48px !important; min-width: 48px !important; padding: 12px 20px !important; font-size: 1.05rem !important; }
    .a11y-big-spacing * { margin-bottom: 0.5em !important; padding: 4px !important; }
    .a11y-keyboard-nav *:focus { outline: 4px solid #3b82f6 !important; outline-offset: 2px !important; }
    .a11y-number-headings { counter-reset: h2 h3; }
    .a11y-number-headings h2::before { counter-increment: h2; content: counter(h2) ". "; font-weight: bold; }
    .a11y-number-headings h3::before { counter-increment: h3; content: counter(h2) "." counter(h3) ". "; font-weight: bold; }
    .a11y-print-friendly { background: white !important; color: black !important; }
  `
  document.head.appendChild(style)
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-[var(--text-2)]">{label}</span>
        <span className="text-xs font-mono font-bold text-[var(--brand)]">{value}{unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - step))}
          aria-label={`Decrease ${label}`}
          title={`Decrease ${label}`}
          className="w-6 h-6 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--text-2)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors shrink-0">
          <Minus size={10} aria-hidden="true" />
        </button>
        <input type="range" min={min} max={max} step={step} value={value}
          aria-label={label}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 accent-[var(--brand)] cursor-pointer" />
        <button type="button" onClick={() => onChange(Math.min(max, value + step))}
          aria-label={`Increase ${label}`}
          title={`Increase ${label}`}
          className="w-6 h-6 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--text-2)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors shrink-0">
          <Plus size={10} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange, desc }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; desc?: string
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <div className={`relative mt-0.5 w-8 h-4.5 h-[18px] rounded-full transition-colors shrink-0 ${checked ? 'bg-[var(--brand)]' : 'bg-[var(--border)]'}`}
        style={{ minWidth: 32 }}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--text)] leading-tight">{label}</p>
        {desc && <p className="text-[10px] text-[var(--text-3)] leading-tight mt-0.5">{desc}</p>}
      </div>
    </label>
  )
}

function SegmentControl({ label, options, value, onChange }: {
  label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-[var(--text-2)]">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`px-2 py-1 text-[10px] font-semibold rounded-lg border transition-colors ${
              value === o.value
                ? 'bg-[var(--brand)] border-[var(--brand)] text-white'
                : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand)] hover:text-[var(--brand)]'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Section({ title, children, defaultOpen = false }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] transition-colors text-left">
        <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">{title}</span>
        <ChevronDown size={13} className={`text-[var(--text-3)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 py-3 space-y-3 bg-[var(--bg-card)]">{children}</div>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AccessibilityPanel() {
  const [open,    setOpen]    = useState(false)
  const [s,       setS]       = useState<A11yState>(DEFAULT)
  const [mounted, setMounted] = useState(false)
  const panelRef              = useRef<HTMLDivElement>(null)
  const btnRef                = useRef<HTMLButtonElement>(null)
  const guideRef              = useRef<HTMLDivElement>(null)
  const maskRef               = useRef<HTMLDivElement>(null)

  // Load from storage on mount
  useEffect(() => {
    injectCSS()
    const saved = load()
    setS(saved)
    applySettings(saved)
    setMounted(true)
  }, [])

  // Apply on every change
  const update = useCallback((patch: Partial<A11yState>) => {
    setS(prev => {
      const next = { ...prev, ...patch }
      applySettings(next)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Escape key closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Reading guide (follows mouse)
  useEffect(() => {
    if (!s.readingGuide) return
    const el = guideRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => { el.style.top = `${e.clientY - 2}px` }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [s.readingGuide])

  // Reading mask (dims everything except a band around cursor)
  useEffect(() => {
    if (!s.readingMask) return
    const el = maskRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const cy = e.clientY
      el.style.background = `linear-gradient(to bottom,
        rgba(0,0,0,0.7) 0px,
        rgba(0,0,0,0.7) ${cy - s.readingMaskSize / 2}px,
        transparent ${cy - s.readingMaskSize / 2}px,
        transparent ${cy + s.readingMaskSize / 2}px,
        rgba(0,0,0,0.7) ${cy + s.readingMaskSize / 2}px,
        rgba(0,0,0,0.7) 100%)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [s.readingMask, s.readingMaskSize])

  // Color overlay
  const overlayColors: Record<string, string> = {
    yellow: '#fef08a', blue: '#bfdbfe', green: '#bbf7d0',
    pink: '#fbcfe8', orange: '#fed7aa',
  }

  const resetAll = useCallback(() => {
    const d = { ...DEFAULT }
    setS(d)
    applySettings(d)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  if (!mounted) return null

  const activeCount = Object.entries(s).filter(([k, v]) => {
    const def = DEFAULT[k as keyof A11yState]
    return v !== def
  }).length

  return (
    <>
      {/* Trigger button */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Accessibility settings"
        aria-expanded={open}
        title="Accessibility"
        className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--brand)] hover:border-[var(--brand)] hover:bg-[var(--brand)]/5 transition-colors"
      >
        <Accessibility size={16} />
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--brand)] text-white text-[9px] font-bold flex items-center justify-center">
            {activeCount > 9 ? '9+' : activeCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Accessibility panel"
          aria-modal="false"
          className="absolute top-full right-0 mt-2 w-80 sm:w-96 max-h-[85vh] flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.5)] z-[999] overflow-hidden animate-slide-down"
          style={{ minWidth: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
            <div className="flex items-center gap-2">
              <Accessibility size={15} className="text-[var(--brand)]" />
              <span className="text-sm font-bold text-[var(--text)]">Accessibility</span>
              {activeCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[var(--brand)]/15 text-[var(--brand)] border border-[var(--brand)]/30">
                  {activeCount} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={resetAll}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[var(--text-3)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                title="Reset all">
                <RotateCcw size={11} /> Reset
              </button>
              <button type="button" onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 p-3 space-y-2">

            {/* ── Text & Typography ─────────────────────── */}
            <Section title="Text & Typography" defaultOpen>
              <Slider label="Font size" value={s.fontSize} min={80} max={200} step={5} unit="%" onChange={v => update({ fontSize: v })} />
              <Slider label="Line height" value={s.lineHeight} min={100} max={220} step={5} unit="%" onChange={v => update({ lineHeight: v })} />
              <Slider label="Letter spacing" value={s.letterSpacing} min={0} max={10} step={1} unit="px" onChange={v => update({ letterSpacing: v })} />
              <Slider label="Word spacing" value={s.wordSpacing} min={0} max={20} step={1} unit="px" onChange={v => update({ wordSpacing: v })} />
              <SegmentControl label="Font family" value={s.fontFamily}
                options={[
                  { value: 'default', label: 'Default' },
                  { value: 'dyslexic', label: 'Dyslexic' },
                  { value: 'mono', label: 'Mono' },
                  { value: 'serif', label: 'Serif' },
                ]}
                onChange={v => update({ fontFamily: v })} />
              <SegmentControl label="Text align" value={s.textAlign}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                  { value: 'justify', label: 'Justify' },
                ]}
                onChange={v => update({ textAlign: v })} />
              <Toggle label="Text shadow" desc="Add subtle shadow for readability" checked={s.textShadow} onChange={v => update({ textShadow: v })} />
              <Toggle label="Remove bold" desc="Normalize all font weights to regular" checked={s.noBold} onChange={v => update({ noBold: v })} />
              <Toggle label="Remove italics" desc="Convert all italic text to normal" checked={s.noItalics} onChange={v => update({ noItalics: v })} />
              <Toggle label="Remove underlines" desc="Hide all text underlines" checked={s.noUnderline} onChange={v => update({ noUnderline: v })} />
            </Section>

            {/* ── Vision & Colour ───────────────────────── */}
            <Section title="Vision & Colour">
              <Slider label="Contrast" value={s.contrast} min={50} max={200} step={5} unit="%" onChange={v => update({ contrast: v })} />
              <Slider label="Brightness" value={s.brightness} min={50} max={200} step={5} unit="%" onChange={v => update({ brightness: v })} />
              <Slider label="Saturation" value={s.saturation} min={0} max={200} step={5} unit="%" onChange={v => update({ saturation: v })} />
              <Slider label="Hue rotate" value={s.hueRotate} min={0} max={360} step={10} unit="°" onChange={v => update({ hueRotate: v })} />
              <Toggle label="Invert colours" desc="Full colour inversion (dark mode alternative)" checked={s.invertColors} onChange={v => update({ invertColors: v })} />
              <Toggle label="Grayscale" desc="Remove all colours from the page" checked={s.grayscale} onChange={v => update({ grayscale: v })} />
              <Toggle label="Sepia tone" desc="Warm sepia filter — easier on the eyes" checked={s.sepia} onChange={v => update({ sepia: v })} />
              <Toggle label="High contrast" desc="Maximise contrast for low-vision users" checked={s.highContrast} onChange={v => update({ highContrast: v })} />
              <Toggle label="Monochrome" desc="Black and white only" checked={s.monochrome} onChange={v => update({ monochrome: v })} />
            </Section>

            {/* ── Colour Overlay ────────────────────────── */}
            <Section title="Colour Overlay (Irlen)">
              <div className="space-y-2">
                <span className="text-xs text-[var(--text-2)]">Overlay colour</span>
                <div className="flex gap-2 flex-wrap">
                  {(['', 'yellow', 'blue', 'green', 'pink', 'orange'] as const).map(c => (
                    <button key={c} type="button" onClick={() => update({ colorOverlay: c })}
                      aria-label={c ? `${c} overlay` : 'No overlay'}
                      aria-pressed={s.colorOverlay === c ? true : false}
                      title={c ? `${c.charAt(0).toUpperCase() + c.slice(1)} overlay` : 'No overlay'}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${s.colorOverlay === c ? 'border-[var(--brand)] scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ background: c ? overlayColors[c] : 'transparent', outline: !c ? '1px dashed var(--border)' : undefined }}>
                      {!c && <X size={12} className="m-auto text-[var(--text-3)]" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </div>
              {s.colorOverlay && (
                <Slider label="Overlay opacity" value={s.overlayOpacity} min={5} max={60} step={5} unit="%" onChange={v => update({ overlayOpacity: v })} />
              )}
            </Section>

            {/* ── Focus & Cursor ───────────────────────── */}
            <Section title="Focus & Cursor">
              <Toggle label="Enhanced focus ring" desc="Yellow outline on focused elements" checked={s.focusRing} onChange={v => update({ focusRing: v })} />
              <Toggle label="Keyboard navigation" desc="Blue focus ring for keyboard-only navigation" checked={s.keyboardNav} onChange={v => update({ keyboardNav: v })} />
              <Toggle label="Skip links" desc="Show skip-to-content links on focus" checked={s.skipLinks} onChange={v => update({ skipLinks: v })} />
              <SegmentControl label="Cursor size" value={s.cursorSize}
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'large', label: 'Large' },
                  { value: 'xl', label: 'XL' },
                ]}
                onChange={v => update({ cursorSize: v })} />
            </Section>

            {/* ── Reading Aids ─────────────────────────── */}
            <Section title="Reading Aids">
              <Toggle label="Reading guide" desc="Horizontal line follows your cursor" checked={s.readingGuide} onChange={v => update({ readingGuide: v })} />
              <Toggle label="Reading mask" desc="Dims area above and below cursor line" checked={s.readingMask} onChange={v => update({ readingMask: v })} />
              {s.readingMask && (
                <Slider label="Mask height" value={s.readingMaskSize} min={60} max={300} step={10} unit="px" onChange={v => update({ readingMaskSize: v })} />
              )}
              <Toggle label="Highlight links" desc="Yellow background on all hyperlinks" checked={s.highlightLinks} onChange={v => update({ highlightLinks: v })} />
              <Toggle label="Highlight headings" desc="Indigo left-border on all headings" checked={s.highlightHeadings} onChange={v => update({ highlightHeadings: v })} />
              <Toggle label="Number headings" desc="Auto-number H2/H3 headings" checked={s.numberHeadings} onChange={v => update({ numberHeadings: v })} />
              <Toggle label="Dyslexia ruler" desc="Horizontal ruler to track reading line" checked={s.dyslexiaRuler} onChange={v => update({ dyslexiaRuler: v })} />
            </Section>

            {/* ── Motion & Animation ───────────────────── */}
            <Section title="Motion & Animation">
              <Toggle label="Reduce motion" desc="Shorten all CSS animations to 1ms" checked={s.reduceMotion} onChange={v => update({ reduceMotion: v })} />
              <Toggle label="Pause all animations" desc="Freeze every animation on the page" checked={s.pauseAnimations} onChange={v => update({ pauseAnimations: v })} />
            </Section>

            {/* ── Media ────────────────────────────────── */}
            <Section title="Media">
              <Toggle label="Hide images" desc="Make all images invisible" checked={s.hideImages} onChange={v => update({ hideImages: v })} />
              <Toggle label="Hide videos" desc="Make all video elements invisible" checked={s.hideVideos} onChange={v => update({ hideVideos: v })} />
              <Toggle label="Mute all media" desc="Mutes all audio and video elements" checked={s.muteMedia}
                onChange={v => {
                  update({ muteMedia: v })
                  document.querySelectorAll<HTMLMediaElement>('audio, video').forEach(el => { el.muted = v })
                }} />
            </Section>

            {/* ── Layout & Page ────────────────────────── */}
            <Section title="Layout & Page">
              <Slider label="Page zoom" value={s.zoom} min={80} max={200} step={5} unit="%" onChange={v => update({ zoom: v })} />
              <SegmentControl label="Content width" value={s.pageWidth}
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'narrow', label: 'Narrow' },
                  { value: 'wide', label: 'Wide' },
                ]}
                onChange={v => update({ pageWidth: v })} />
              <Toggle label="Big click targets" desc="Enlarge all buttons and interactive elements" checked={s.bigButtons} onChange={v => update({ bigButtons: v })} />
              <Toggle label="Increase spacing" desc="Add extra margin/padding throughout" checked={s.bigSpacing} onChange={v => update({ bigSpacing: v })} />
              <Toggle label="Print-friendly" desc="White background, black text for printing" checked={s.printFriendly} onChange={v => update({ printFriendly: v })} />
              <Toggle label="Always show tooltips" desc="Force all title attributes to be visible" checked={s.tooltipsVisible} onChange={v => update({ tooltipsVisible: v })} />
            </Section>

          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
            <p className="text-[10px] text-[var(--text-3)] text-center">
              Settings saved to your browser · {activeCount} customisation{activeCount !== 1 ? 's' : ''} active
            </p>
          </div>
        </div>
      )}

      {/* Reading guide overlay */}
      {s.readingGuide && (
        <div ref={guideRef} aria-hidden="true"
          className="fixed left-0 right-0 h-0.5 bg-[var(--brand)]/60 pointer-events-none z-[998]"
          style={{ top: 0 }} />
      )}

      {/* Reading mask overlay */}
      {s.readingMask && (
        <div ref={maskRef} aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-[997]"
          style={{ background: 'rgba(0,0,0,0.7)' }} />
      )}

      {/* Colour overlay */}
      {s.colorOverlay && overlayColors[s.colorOverlay] && (
        <div aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-[996] mix-blend-multiply"
          style={{ background: overlayColors[s.colorOverlay], opacity: s.overlayOpacity / 100 }} />
      )}
    </>
  )
}
