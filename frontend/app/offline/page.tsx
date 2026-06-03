import type { Metadata } from 'next'
import Link from 'next/link'
import { WifiOff } from 'lucide-react'

export const metadata: Metadata = { title: 'Offline – MediaDL', robots: { index: false } }

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center mb-6">
        <WifiOff size={28} className="text-[var(--text-3)]" />
      </div>
      <h1 className="text-2xl font-black text-[var(--text)] mb-2">You're offline</h1>
      <p className="text-[var(--text-3)] max-w-xs mb-8">
        Check your internet connection and try again. Previously visited pages may still be available.
      </p>
      <Link href="/"
        className="px-5 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-semibold text-sm transition-colors">
        Try again
      </Link>
    </div>
  )
}
