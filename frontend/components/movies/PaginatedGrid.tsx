'use client'
import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { tmdbRaw, type TmdbItem } from '@/lib/tmdb'
import MovieCard from './MovieCard'
import { Empty } from './parts'

// Loads ALL pages of a TMDB list endpoint on demand (recommendations, similar,
// keyword movies, company movies, network shows…). Server passes page 1 (SEO +
// instant), the client appends page 2..N until exhausted — effectively unlimited.
export default function PaginatedGrid({
  endpoint, params = {}, media, initial = [], initialPages = 1, initialTotal,
}: {
  endpoint: string
  params?: Record<string, string | number>
  media?: 'movie' | 'tv' | 'person'
  initial?: TmdbItem[]
  initialPages?: number
  initialTotal?: number
}) {
  const [items, setItems] = useState<TmdbItem[]>(initial)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(initialPages)
  const [total, setTotal] = useState(initialTotal ?? initial.length)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function more() {
    const next = page + 1
    setLoading(true); setErr('')
    try {
      const data = await tmdbRaw(endpoint, { ...params, page: next })
      const results: TmdbItem[] = data.results ?? []
      setItems((prev) => {
        const seen = new Set(prev.map((p) => `${p.id}-${p.media_type ?? media}`))
        return [...prev, ...results.filter((r) => !seen.has(`${r.id}-${r.media_type ?? media}`))]
      })
      setPage(data.page ?? next)
      setPages(data.total_pages ?? pages)
      if (data.total_results != null) setTotal(data.total_results)
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  // If server gave us nothing, fetch page 1 client-side.
  async function loadFirst() {
    setLoading(true); setErr('')
    try {
      const data = await tmdbRaw(endpoint, { ...params, page: 1 })
      setItems(data.results ?? [])
      setPage(1); setPages(data.total_pages ?? 1); setTotal(data.total_results ?? 0)
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  if (!items.length && !loading && !err) {
    // lazy first load (e.g. company/network pages that don't SSR the list)
    loadFirst()
    return <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-[var(--text-3)]" /></div>
  }
  if (!items.length && err) return <Empty>{err}</Empty>
  if (!items.length) return <Empty>Nothing here.</Empty>

  return (
    <div>
      {total > 0 && <p className="text-xs text-[var(--text-3)] mb-3">Showing {items.length.toLocaleString()} of {total.toLocaleString()}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((it, i) => <MovieCard key={`${it.id}-${i}`} item={media ? { ...it, media_type: media } : it} />)}
      </div>
      {err && <p className="text-red-400 text-sm mt-3">{err}</p>}
      {page < pages && (
        <div className="flex justify-center mt-6">
          <button onClick={more} disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--brand)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-50 transition-colors">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Load more ({(pages - page).toLocaleString()} pages left)
          </button>
        </div>
      )}
    </div>
  )
}
