'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart, Bookmark, Star, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { isLoggedIn, accountStates, setFavorite, setWatchlist, rate, unrate } from '@/lib/tmdb-account'

export default function TitleActions({ media, id }: { media: 'movie'|'tv'; id: number }) {
  const [authed, setAuthed] = useState(false)
  const [fav, setFav] = useState(false)
  const [watch, setWatch] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [busy, setBusy] = useState('')
  const [showRate, setShowRate] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) return
    setAuthed(true)
    accountStates(media, id).then((s) => {
      setFav(!!s.favorite); setWatch(!!s.watchlist)
      setRating(s.rated && typeof s.rated === 'object' ? s.rated.value : null)
    }).catch(() => {})
  }, [media, id])

  if (!authed) {
    return (
      <Link href="/movies/account" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] hover:border-[var(--brand)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
        <Heart size={14} /> Sign in to TMDB to save & rate
      </Link>
    )
  }

  async function toggleFav() {
    setBusy('fav')
    try { await setFavorite(media, id, !fav); setFav(!fav); toast.success(!fav ? 'Added to favorites' : 'Removed from favorites') }
    catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }
  async function toggleWatch() {
    setBusy('watch')
    try { await setWatchlist(media, id, !watch); setWatch(!watch); toast.success(!watch ? 'Added to watchlist' : 'Removed from watchlist') }
    catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }
  async function doRate(v: number) {
    setBusy('rate')
    try {
      if (v === 0) { await unrate(media, id); setRating(null); toast.success('Rating removed') }
      else { await rate(media, id, v); setRating(v); toast.success(`Rated ${v}/10`) }
      setShowRate(false)
    } catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }

  const btn = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors'
  return (
    <div className="flex flex-wrap items-center gap-2 relative">
      <button onClick={toggleFav} disabled={busy==='fav'}
        className={`${btn} ${fav ? 'border-rose-500/60 text-rose-400 bg-rose-500/10' : 'border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]'}`}>
        {busy==='fav' ? <Loader2 size={14} className="animate-spin"/> : <Heart size={14} className={fav?'fill-rose-400':''} />} Favorite
      </button>
      <button onClick={toggleWatch} disabled={busy==='watch'}
        className={`${btn} ${watch ? 'border-[var(--brand)] text-[var(--brand)] bg-[var(--brand)]/10' : 'border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]'}`}>
        {busy==='watch' ? <Loader2 size={14} className="animate-spin"/> : <Bookmark size={14} className={watch?'fill-current':''} />} Watchlist
      </button>
      <button onClick={() => setShowRate((s) => !s)}
        className={`${btn} ${rating ? 'border-amber-500/60 text-amber-400 bg-amber-500/10' : 'border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]'}`}>
        <Star size={14} className={rating?'fill-amber-400':''} /> {rating ? `${rating}/10` : 'Rate'}
      </button>
      {showRate && (
        <div className="absolute top-full left-0 mt-2 z-20 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl">
          <div className="flex flex-wrap gap-1 w-56">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
              <button key={v} onClick={() => doRate(v)} disabled={busy==='rate'}
                className={`w-9 h-9 rounded-lg text-xs font-bold ${rating===v?'bg-amber-500 text-white':'bg-[var(--bg-hover)] text-[var(--text-2)] hover:bg-[var(--brand)] hover:text-white'}`}>{v}</button>
            ))}
          </div>
          {rating != null && <button onClick={() => doRate(0)} className="mt-2 text-xs text-red-400 hover:underline">Remove rating</button>}
        </div>
      )}
    </div>
  )
}
