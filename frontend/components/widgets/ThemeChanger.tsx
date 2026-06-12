'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Palette, Search, Check, X, Sun, Moon, Contrast, Code2, Sparkles } from 'lucide-react'
import { useTheme, THEMES, type ThemeCategory } from '@/components/layout/ThemeProvider'

const CATEGORIES: { id: ThemeCategory | 'all'; label: string; Icon: React.ElementType }[] = [
  { id: 'all',      label: 'All',      Icon: Sparkles  },
  { id: 'dark',     label: 'Dark',     Icon: Moon      },
  { id: 'light',    label: 'Light',    Icon: Sun       },
  { id: 'coding',   label: 'Coding',   Icon: Code2     },
  { id: 'contrast', label: 'Contrast', Icon: Contrast  },
]

function ThemeCard({ spec, active, onSelect }: {
  spec: typeof THEMES[0]
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={spec.label}
      aria-label={`Apply ${spec.label} theme`}
      aria-pressed={active ? 'true' : 'false'}
      className={`group relative flex flex-col gap-1.5 p-2.5 rounded-xl border transition-all text-left
        ${active
          ? 'border-[var(--brand)] shadow-[0_0_0_2px_var(--brand)]'
          : 'border-[var(--border)] hover:border-[var(--border-hover)]'
        }`}
    >
      {/* Swatch bar */}
      <div className="flex rounded-md overflow-hidden h-5 w-full">
        <div className="flex-1" style={{ background: spec.bg }} />
        <div className="flex-1" style={{ background: spec.bgCard }} />
        <div className="w-4 shrink-0" style={{ background: spec.brand }} />
        <div className="w-3 shrink-0" style={{ background: spec.accent }} />
      </div>
      {/* Label */}
      <span className="text-[10px] font-semibold text-[var(--text-2)] group-hover:text-[var(--text)] truncate transition-colors leading-none">
        {spec.label}
      </span>
      {/* Active check */}
      {active && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: spec.brand }}>
          <Check size={9} className="text-white" />
        </span>
      )}
    </button>
  )
}

export default function ThemeChanger() {
  const { themeId, setTheme, theme } = useTheme()
  const [open, setOpen]   = useState(false)
  const [search, setSrch] = useState('')
  const [cat, setCat]     = useState<ThemeCategory | 'all'>('all')
  const ref  = useRef<HTMLDivElement>(null)
  const inpt = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inpt.current?.focus(), 50)
    else setSrch('')
  }, [open])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return THEMES.filter(t =>
      (cat === 'all' || t.category === cat) &&
      (!q || t.label.toLowerCase().includes(q) || t.id.includes(q))
    )
  }, [cat, search])

  const count = THEMES.length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Change theme"
        aria-expanded={open ? 'true' : 'false'}
        className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors relative"
      >
        <Palette size={15} />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-black flex items-center justify-center"
          style={{ background: 'var(--brand)', color: '#fff' }}>
          {count > 9 ? '∞' : count}
        </span>
      </button>

      {open && (
        <div className={`
          absolute z-[200] mt-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl
          flex flex-col
          w-[min(92vw,380px)]
          right-0
          max-h-[min(85vh,520px)]
        `}>

          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-[var(--border)] shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-bold text-[var(--text)]">Theme Studio</p>
                <p className="text-[10px] text-[var(--text-3)]">{count} themes</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close theme panel"
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
              <input
                ref={inpt}
                value={search}
                onChange={e => setSrch(e.target.value)}
                placeholder="Search themes…"
                aria-label="Search themes"
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>

            {/* Category tabs */}
            <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {CATEGORIES.map(({ id, label, Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setCat(id)}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border
                    ${cat === id
                      ? 'bg-[var(--brand)] text-white border-transparent'
                      : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--border-hover)]'
                    }`}
                >
                  <Icon size={10} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme grid */}
          <div className="overflow-y-auto flex-1 p-3" style={{ scrollbarWidth: 'thin' }}>
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-[var(--text-3)] py-8">No themes match "{search}"</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filtered.map(spec => (
                  <ThemeCard
                    key={spec.id}
                    spec={spec}
                    active={spec.id === themeId}
                    onSelect={() => { setTheme(spec.id); setOpen(false) }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Active theme footer */}
          <div className="px-4 py-3 border-t border-[var(--border)] shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-[var(--brand)]"
                style={{ background: THEMES.find(t => t.id === themeId)?.bg }} />
              <span className="text-[10px] text-[var(--text-2)] font-semibold">
                {THEMES.find(t => t.id === themeId)?.label ?? themeId}
              </span>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border
              ${theme === 'dark'
                ? 'bg-slate-800 text-slate-300 border-slate-600'
                : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}>
              {theme.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
