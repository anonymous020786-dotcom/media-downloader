'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import type { BlogCategory } from '@/lib/api'

const SORTS = [
  { v: 'newest', label: 'Newest' },
  { v: 'oldest', label: 'Oldest' },
  { v: 'az',     label: 'A–Z' },
  { v: 'reads',  label: 'Longest reads' },
]

export default function BlogControls({ categories }: { categories: BlogCategory[] }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, start] = useTransition()
  const [q, setQ] = useState(sp.get('q') ?? '')

  const cat  = sp.get('category') ?? ''
  const sort = sp.get('sort') ?? 'newest'

  function update(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString())
    Object.entries(next).forEach(([k, v]) => { v ? params.set(k, v) : params.delete(k) })
    params.delete('page') // any change resets to page 1
    start(() => router.push(`/blog?${params.toString()}`))
  }

  return (
    <div className="space-y-4 mb-10">
      <form onSubmit={(e) => { e.preventDefault(); update({ q }) }} className="flex gap-2 max-w-2xl mx-auto">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search guides & tutorials…"
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl pl-10 pr-9 py-3 text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none" />
          {q && <button type="button" onClick={() => { setQ(''); update({ q: '' }) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)]"><X size={15} /></button>}
        </div>
        <button type="submit" disabled={pending}
          className="px-5 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white text-sm font-bold rounded-xl">Search</button>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button onClick={() => update({ category: '' })}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            !cat ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-hover)]'}`}>
          All
        </button>
        {categories.map((c) => (
          <button key={c.category} onClick={() => update({ category: c.category })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              cat === c.category ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-hover)]'}`}>
            {c.category} <span className="opacity-60">{c.count}</span>
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-auto sm:ml-2">
          <SlidersHorizontal size={13} className="text-[var(--text-3)]" />
          <select value={sort} onChange={(e) => update({ sort: e.target.value })}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text)] outline-none">
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
