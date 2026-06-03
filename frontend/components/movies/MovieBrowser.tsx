'use client'
import { useEffect, useState, useCallback } from 'react'
import { Search, Loader2, TrendingUp, Flame, Star, CalendarClock, Clapperboard } from 'lucide-react'
import {
  tmdbTrending, tmdbSearch, tmdbList, tmdbDiscover, tmdbGenres,
  type TmdbItem, type Genre,
} from '@/lib/tmdb'
import MovieCard from './MovieCard'

type Media = 'movie' | 'tv'
const CATS: Record<Media, { key: string; label: string; icon: React.ReactNode }[]> = {
  movie: [
    { key: 'trending',    label: 'Trending',    icon: <TrendingUp size={13} /> },
    { key: 'popular',     label: 'Popular',     icon: <Flame size={13} /> },
    { key: 'top_rated',   label: 'Top Rated',   icon: <Star size={13} /> },
    { key: 'now_playing', label: 'Now Playing', icon: <Clapperboard size={13} /> },
    { key: 'upcoming',    label: 'Upcoming',    icon: <CalendarClock size={13} /> },
  ],
  tv: [
    { key: 'trending',     label: 'Trending',     icon: <TrendingUp size={13} /> },
    { key: 'popular',      label: 'Popular',      icon: <Flame size={13} /> },
    { key: 'top_rated',    label: 'Top Rated',    icon: <Star size={13} /> },
    { key: 'on_the_air',   label: 'On The Air',   icon: <Clapperboard size={13} /> },
    { key: 'airing_today', label: 'Airing Today', icon: <CalendarClock size={13} /> },
  ],
}

export default function MovieBrowser() {
  const [media, setMedia]   = useState<Media>('movie')
  const [cat, setCat]       = useState('trending')
  const [genre, setGenre]   = useState<number | null>(null)
  const [genres, setGenres] = useState<Genre[]>([])
  const [query, setQuery]   = useState('')
  const [active, setActive] = useState('')        // committed search term
  const [items, setItems]   = useState<TmdbItem[]>([])
  const [page, setPage]     = useState(1)
  const [pages, setPages]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => { tmdbGenres(media).then((r) => setGenres(r.genres)).catch(() => setGenres([])) }, [media])

  const load = useCallback(async (p: number, reset: boolean) => {
    setLoading(true); setError('')
    try {
      let data
      if (active) data = await tmdbSearch(media, active, p)
      else if (genre) data = await tmdbDiscover(media, { with_genres: genre, page: p, sort_by: 'popularity.desc' })
      else if (cat === 'trending') data = await tmdbTrending(media, 'week', p)
      else data = await tmdbList(media, cat, p)
      setItems((prev) => reset ? data.results : [...prev, ...data.results])
      setPage(data.page); setPages(data.total_pages)
      if (reset && data.results.length === 0) setError('No results.')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [media, cat, genre, active])

  useEffect(() => { load(1, true) }, [load])

  const onSearch = () => { setActive(query.trim()); setGenre(null) }

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="flex gap-2 max-w-2xl mx-auto">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="Search movies, TV shows, people…"
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none" />
        </div>
        <button onClick={onSearch} className="px-5 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-bold rounded-xl">Search</button>
        {active && <button onClick={() => { setActive(''); setQuery('') }} className="px-4 py-3 text-sm text-[var(--text-2)] border border-[var(--border)] rounded-xl">Clear</button>}
      </div>

      {!active && (
        <>
          {/* Media toggle */}
          <div className="flex justify-center gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-fit mx-auto">
            {(['movie','tv'] as Media[]).map((m) => (
              <button key={m} onClick={() => { setMedia(m); setCat('trending'); setGenre(null) }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${media===m?'bg-[var(--bg-hover)] text-[var(--text)]':'text-[var(--text-3)]'}`}>
                {m === 'movie' ? 'Movies' : 'TV Shows'}
              </button>
            ))}
          </div>
          {/* Categories */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {CATS[media].map((c) => (
              <button key={c.key} onClick={() => { setCat(c.key); setGenre(null) }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  cat===c.key && !genre ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-hover)]'}`}>
                {c.icon}{c.label}
              </button>
            ))}
          </div>
          {/* Genres */}
          {genres.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {genres.map((g) => (
                <button key={g.id} onClick={() => setGenre(genre === g.id ? null : g.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    genre===g.id ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {error && <p className="text-center text-[var(--text-3)] py-8">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((it, i) => <MovieCard key={`${it.id}-${i}`} item={it} />)}
      </div>

      {!active && page < pages && (
        <div className="flex justify-center pt-2">
          <button onClick={() => load(page + 1, false)} disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--brand)] text-sm font-semibold text-[var(--text-2)] disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : null} Load more
          </button>
        </div>
      )}
      {active && page < pages && (
        <div className="flex justify-center pt-2">
          <button onClick={() => load(page + 1, false)} disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--brand)] text-sm font-semibold text-[var(--text-2)] disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : null} Load more results
          </button>
        </div>
      )}
    </div>
  )
}
