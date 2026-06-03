import Link from 'next/link'
import { Home, Download, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="text-center max-w-md">
        <p className="text-8xl font-black gradient-text mb-2">404</p>
        <h1 className="text-2xl font-black text-[var(--text)] mb-3">Page not found</h1>
        <p className="text-[var(--text-2)] mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has moved. Let's get you back on track.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-semibold transition-colors">
            <Home size={15} /> Home
          </Link>
          <Link href="/download" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] text-sm font-semibold transition-colors">
            <Download size={15} /> Download Tool
          </Link>
          <Link href="/supported-sites" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] text-sm font-semibold transition-colors">
            <Search size={15} /> Supported Sites
          </Link>
        </div>
      </div>
    </div>
  )
}
