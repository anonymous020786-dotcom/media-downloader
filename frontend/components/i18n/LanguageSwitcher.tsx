'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Globe, Check, Search, X, ChevronDown } from 'lucide-react'
import { LANGUAGES } from '@/lib/i18n'
import { useLang } from './LanguageProvider'

// ── Region grouping ────────────────────────────────────────────────────────────
const REGIONS: { label: string; codes: string[] }[] = [
  { label: 'Americas',     codes: ['en', 'es', 'pt'] },
  { label: 'Europe',       codes: ['fr', 'de', 'it', 'nl', 'ru', 'pl'] },
  { label: 'Middle East',  codes: ['ar', 'tr'] },
  { label: 'South Asia',   codes: ['hi'] },
  { label: 'East Asia',    codes: ['zh', 'ja', 'ko'] },
  { label: 'Southeast Asia', codes: ['id', 'vi', 'th'] },
]

// English names for each language (for search + subtitle)
const EN_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German',
  it: 'Italian', nl: 'Dutch', ru: 'Russian', pl: 'Polish', ar: 'Arabic',
  tr: 'Turkish', hi: 'Hindi', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  id: 'Indonesian', vi: 'Vietnamese', th: 'Thai',
}

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang()
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [recent, setRecent]   = useState<string[]>([])
  const ref      = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load recent picks from localStorage
  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem('lang_recent') ?? '[]')) } catch {}
  }, [])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  const pick = (code: string) => {
    setLang(code)
    setOpen(false)
    setQuery('')
    setRecent((prev) => {
      const next = [code, ...prev.filter((c) => c !== code)].slice(0, 3)
      localStorage.setItem('lang_recent', JSON.stringify(next))
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return LANGUAGES.filter((l) =>
      l.label.toLowerCase().includes(q) ||
      (EN_NAMES[l.code] ?? '').toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    )
  }, [query])

  const recentLangs = LANGUAGES.filter((l) => recent.includes(l.code) && l.code !== lang)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Select language"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors text-sm"
      >
        <Globe size={14} />
        <span className="hidden sm:inline text-xs font-medium">{current.flag} {current.code.toUpperCase()}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)]">
              <Search size={13} className="text-[var(--text-3)] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search languages…"
                className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-[var(--text-3)] hover:text-[var(--text)]">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* Search results */}
            {filtered ? (
              <div className="py-1.5">
                {filtered.length === 0
                  ? <p className="px-4 py-3 text-sm text-[var(--text-3)] text-center">No languages found</p>
                  : filtered.map((l) => <LangRow key={l.code} l={l} active={l.code === lang} onPick={pick} />)
                }
              </div>
            ) : (
              <>
                {/* Current */}
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-[10px] text-[var(--text-3)] uppercase tracking-widest font-bold px-1 mb-1">Current</p>
                  <LangRow l={current} active={true} onPick={pick} />
                </div>

                {/* Recently used */}
                {recentLangs.length > 0 && (
                  <div className="px-3 pb-1">
                    <p className="text-[10px] text-[var(--text-3)] uppercase tracking-widest font-bold px-1 mb-1 mt-2">Recent</p>
                    {recentLangs.map((l) => <LangRow key={l.code} l={l} active={false} onPick={pick} />)}
                  </div>
                )}

                {/* Grouped regions */}
                {REGIONS.map((region) => {
                  const langs = LANGUAGES.filter((l) => region.codes.includes(l.code) && l.code !== lang)
                  if (langs.length === 0) return null
                  return (
                    <div key={region.label} className="px-3 pb-1">
                      <p className="text-[10px] text-[var(--text-3)] uppercase tracking-widest font-bold px-1 mb-1 mt-2">
                        {region.label}
                      </p>
                      {langs.map((l) => <LangRow key={l.code} l={l} active={false} onPick={pick} />)}
                    </div>
                  )
                })}
                <div className="h-2" />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function LangRow({ l, active, onPick }: { l: { code: string; label: string; flag: string }; active: boolean; onPick: (c: string) => void }) {
  return (
    <button
      onClick={() => onPick(l.code)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
        active
          ? 'bg-[var(--brand)]/10 text-[var(--text)]'
          : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
      }`}
    >
      <span className="text-base w-6 text-center shrink-0">{l.flag}</span>
      <span className="flex-1 text-left font-medium">{l.label}</span>
      <span className="text-[11px] text-[var(--text-3)]">{EN_NAMES[l.code]}</span>
      {active && <Check size={13} className="text-[var(--brand)] shrink-0" />}
    </button>
  )
}
