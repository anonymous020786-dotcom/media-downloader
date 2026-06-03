'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-amber-900/30 text-amber-400 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={28} />
        </div>
        <h1 className="text-2xl font-black text-[var(--text)] mb-3">Something went wrong</h1>
        <p className="text-[var(--text-2)] mb-2 leading-relaxed">
          An unexpected error occurred. You can try again — if it persists, head back home.
        </p>
        {error?.digest && <p className="text-[10px] text-[var(--text-3)] font-mono mb-6">ref: {error.digest}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-semibold transition-colors">
            <RotateCcw size={15} /> Try again
          </button>
          <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] text-sm font-semibold transition-colors">
            <Home size={15} /> Home
          </Link>
        </div>
      </div>
    </div>
  )
}
