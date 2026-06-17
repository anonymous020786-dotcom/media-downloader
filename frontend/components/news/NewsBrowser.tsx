'use client'
import { useEffect, useState, useCallback } from 'react'
import { Search, Loader2, ExternalLink, Clock, Newspaper, X, Globe } from 'lucide-react'
import { fetchNews, fetchNewsCategories, type NewsItem, type NewsCategory } from '@/lib/news'

function timeAgo(d: string) {
  if (!d) return ''
  const s = (Date.now() - +new Date(d)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

const FEATURED = ['world', 'technology', 'business', 'science', 'sports', 'entertainment', 'gaming']

export default function NewsBrowser() {
  const [cats, setCats] = useState<NewsCategory[]>([])
  const [mode, setMode] = useState<{ category?: string; topic?: string }>({ category: 'world' })
  const [q, setQ] = useState('')
  const [source, setSource] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [items, setItems] = useState<NewsItem[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [err, setErr] = useState('')
  const [reading, setReading] = useState<NewsItem | null>(null)

  useEffect(() => {
    fetchNewsCategories().then((r) => {
      // The feed can return the same category slug more than once — dedupe so
      // React keys stay unique.
      const seen = new Set<string>()
      setCats(r.categories.filter((c) => !seen.has(c.slug) && seen.add(c.slug)))
    }).catch(() => {})
  }, [])

  const load = useCallback(async (p: number, reset: boolean) => {
    reset ? setLoading(true) : setMore(true)
    setErr('')
    try {
      const r = await fetchNews({ ...mode, source, page: p, limit: 24 })
      setItems((prev) => {
        if (reset) return r.items
        const seen = new Set(prev.map((x) => x.link))
        return [...prev, ...r.items.filter((x) => !seen.has(x.link))]
      })
      setPage(r.page); setPages(r.pages); setTotal(r.total); setSources(r.sources)
      if (reset && !r.items.length) setErr('No articles found — try another topic or category.')
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false); setMore(false) }
  }, [mode, source])

  useEffect(() => { load(1, true) }, [load])

  const searchTopic = () => { const t = q.trim(); if (t) { setMode({ topic: t }); setSource('') } }
  const pickCategory = (slug: string) => { setMode({ category: slug }); setSource(''); setQ('') }
  const featuredCats = cats.filter((c) => FEATURED.includes(c.slug))

  return (
    <div className="space-y-5">
      {/* Infinite topic search */}
      <div className="flex gap-2 max-w-2xl mx-auto">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchTopic()}
            placeholder="Search ANY topic — companies, people, events… (live, unlimited)"
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none" />
        </div>
        <button onClick={searchTopic} className="px-5 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-bold rounded-xl">Search</button>
      </div>

      {/* Featured chips + full category picker */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {featuredCats.map((c) => (
          <button key={c.slug} onClick={() => pickCategory(c.slug)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${mode.category===c.slug?'bg-[var(--brand)] text-white border-[var(--brand)]':'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-hover)]'}`}>
            {c.category}
          </button>
        ))}
        <select value={mode.category && !FEATURED.includes(mode.category) ? mode.category : ''} onChange={(e) => e.target.value && pickCategory(e.target.value)}
          className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-2)] outline-none max-w-[200px]">
          <option value="">More categories ({cats.length})…</option>
          {cats.map((c, i) => <option key={`${c.slug}-${i}`} value={c.slug}>{c.category}</option>)}
        </select>
      </div>

      {/* Current view + source filter */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-[var(--text-3)]">
        {mode.topic && <span className="inline-flex items-center gap-1 text-[var(--brand)] font-semibold"><Globe size={11}/>Topic: “{mode.topic}”</span>}
        {total > 0 && <span>{total} articles</span>}
        {sources.length > 1 && (
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1 text-[11px] text-[var(--text)] outline-none">
            <option value="">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {err && <p className="text-center text-[var(--text-3)] py-6">{err}</p>}
      {loading ? <div className="py-16 text-center"><Loader2 className="animate-spin mx-auto text-[var(--text-3)]" /></div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it, i) => (
            <button key={`${it.link}-${i}`} onClick={() => setReading(it)}
              className="group flex flex-col text-left rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:-translate-y-1 transition-all overflow-hidden">
              <div className="aspect-video bg-[var(--bg-hover)] overflow-hidden flex items-center justify-center">
                {it.image
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={it.image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  : <Newspaper size={28} className="text-[var(--text-3)]" />}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2 text-[11px] text-[var(--text-3)]">
                  <span className="font-bold text-[var(--brand)] truncate">{it.source}</span>
                  <span className="flex items-center gap-1 shrink-0"><Clock size={10} />{timeAgo(it.date)}</span>
                </div>
                <h3 className="font-bold text-[var(--text)] leading-snug line-clamp-3 mb-2 group-hover:text-[var(--brand)] transition-colors">{it.title}</h3>
                <p className="text-xs text-[var(--text-2)] line-clamp-2 flex-1">{it.snippet}</p>
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-3)] mt-3 group-hover:text-[var(--brand)]">Read on site</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Infinite "Load more" pagination */}
      {!loading && items.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-4">
          <p className="text-[11px] text-[var(--text-3)]">Showing {items.length.toLocaleString()}{total ? ` of ${total.toLocaleString()}` : ''}</p>
          {page < pages ? (
            <button onClick={() => load(page + 1, false)} disabled={more}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--brand)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-50 transition-colors">
              {more ? <Loader2 size={15} className="animate-spin" /> : <Newspaper size={15} />}
              {more ? 'Loading…' : `Load more (${(pages - page).toLocaleString()} pages left)`}
            </button>
          ) : (
            <p className="text-[11px] text-[var(--text-3)]">— end of results —</p>
          )}
        </div>
      )}

      {/* On-site reader */}
      {reading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setReading(null)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
              <span className="text-xs font-bold text-[var(--brand)]">{reading.source} · {timeAgo(reading.date)}</span>
              <button onClick={() => setReading(null)} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={18} /></button>
            </div>
            {reading.image && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={reading.image} alt="" className="w-full max-h-72 object-cover" />
            )}
            <div className="p-6">
              <h2 className="text-2xl font-black text-[var(--text)] mb-4 leading-tight">{reading.title}</h2>
              <p className="text-[var(--text-2)] leading-relaxed whitespace-pre-line">{reading.content || reading.snippet}</p>
              <a href={reading.link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-bold">
                Read full article at source <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
