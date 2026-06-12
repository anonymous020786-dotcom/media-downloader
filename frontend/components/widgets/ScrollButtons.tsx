'use client'
import { useEffect, useState, useCallback } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export default function ScrollButtons() {
  const [scrollY,   setScrollY]   = useState(0)
  const [docHeight, setDocHeight] = useState(0)
  const [visible,   setVisible]   = useState(false)

  const update = useCallback(() => {
    const sy = window.scrollY
    const dh = document.documentElement.scrollHeight - window.innerHeight
    setScrollY(sy)
    setDocHeight(dh)
    setVisible(dh > 300)
  }, [])

  useEffect(() => {
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [update])

  if (!visible) return null

  const atTop    = scrollY < 80
  const atBottom = docHeight > 0 && scrollY >= docHeight - 80
  const progress = docHeight > 0 ? Math.min(scrollY / docHeight, 1) : 0
  const deg      = progress * 360

  return (
    <div className="fixed right-4 bottom-24 z-50 flex flex-col gap-2 sm:right-6" aria-label="Page scroll controls">

      {/* Scroll to top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        disabled={atTop}
        aria-label="Scroll to top"
        title="Back to top"
        className={`relative group w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${
          atTop
            ? 'opacity-30 cursor-not-allowed bg-[var(--bg-card)] border border-[var(--border)]'
            : 'opacity-100 bg-[var(--brand)] hover:bg-[var(--brand-dark)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
        }`}
      >
        {/* Circular progress ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
          <circle cx="22" cy="22" r="19" fill="none" stroke="currentColor" strokeWidth="2"
            className="text-white/20" />
          <circle cx="22" cy="22" r="19" fill="none" stroke="currentColor" strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 19}`}
            strokeDashoffset={`${2 * Math.PI * 19 * (1 - progress)}`}
            className="text-white/70 transition-all duration-150"
            strokeLinecap="round" />
        </svg>
        <ChevronUp size={16} className="relative z-10 text-white" />
        {/* Tooltip */}
        <span className="absolute right-full mr-2 px-2 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
          Back to top
        </span>
      </button>

      {/* Scroll to bottom */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
        disabled={atBottom}
        aria-label="Scroll to bottom"
        title="Scroll to bottom"
        className={`relative group w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg border transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${
          atBottom
            ? 'opacity-30 cursor-not-allowed bg-[var(--bg-card)] border-[var(--border)]'
            : 'opacity-100 bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--brand)] hover:bg-[var(--brand)]/10 hover:translate-y-0.5 active:translate-y-0 cursor-pointer'
        }`}
      >
        <ChevronDown size={16} className={atBottom ? 'text-[var(--text-3)]' : 'text-[var(--text-2)] group-hover:text-[var(--brand)]'} />
        <span className="absolute right-full mr-2 px-2 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
          Scroll to bottom
        </span>
      </button>

      {/* Progress percentage badge */}
      {!atTop && (
        <div className="w-10 sm:w-11 flex justify-center">
          <span className="text-[9px] font-bold tabular-nums text-[var(--text-3)]">
            {Math.round(progress * 100)}%
          </span>
        </div>
      )}
    </div>
  )
}
