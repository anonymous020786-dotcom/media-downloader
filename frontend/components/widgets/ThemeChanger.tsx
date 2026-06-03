'use client'
import { useState, useRef, useEffect } from 'react'
import { Palette, Sun, Moon, Check } from 'lucide-react'
import { useTheme, ACCENTS } from '@/components/layout/ThemeProvider'

export default function ThemeChanger() {
  const { theme, toggle, accent, setAccent } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Change theme"
        className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
        <Palette size={15} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-60 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl p-4 z-50">
          {/* Mode */}
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-widest font-bold mb-2">Appearance</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => theme !== 'dark' && toggle()}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                theme === 'dark' ? 'bg-[var(--brand)] text-white border-transparent' : 'border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]'}`}>
              <Moon size={13} /> Dark
            </button>
            <button onClick={() => theme !== 'light' && toggle()}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                theme === 'light' ? 'bg-[var(--brand)] text-white border-transparent' : 'border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]'}`}>
              <Sun size={13} /> Light
            </button>
          </div>

          {/* Accent */}
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-widest font-bold mb-2">Accent color</p>
          <div className="grid grid-cols-6 gap-2">
            {ACCENTS.map((a) => (
              <button key={a.id} onClick={() => setAccent(a.id)} title={a.label}
                className="relative w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ background: a.brand }}>
                {accent === a.id && <Check size={13} className="text-white" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
