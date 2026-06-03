'use client'
import { useState, useRef, useEffect } from 'react'
import { Globe, Check, ChevronDown } from 'lucide-react'
import { LANGUAGES } from '@/lib/i18n'
import { useLang } from './LanguageProvider'

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Select language"
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors text-sm"
      >
        <Globe size={14} />
        <span className="hidden sm:inline text-xs font-medium">{current.flag} {current.code.toUpperCase()}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 max-h-80 overflow-y-auto bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl py-1.5 z-50">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                l.code === lang ? 'text-[var(--text)] bg-[var(--bg-hover)]' : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span className="flex-1 text-left">{l.label}</span>
              {l.code === lang && <Check size={14} className="text-[var(--brand)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
