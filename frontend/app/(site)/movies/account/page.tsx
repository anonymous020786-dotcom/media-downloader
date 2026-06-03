'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { LogIn, LogOut, Loader2, Heart, Bookmark, Star, ListVideo, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  isLoggedIn, getAccount, startLogin, logout,
  accountList, accountLists, createList, deleteList, type TmdbAccount,
} from '@/lib/tmdb-account'
import { img } from '@/lib/tmdb'

type Tab = 'watchlist' | 'favorite' | 'rated' | 'lists'
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'watchlist', label: 'Watchlist', icon: <Bookmark size={14} /> },
  { key: 'favorite',  label: 'Favorites', icon: <Heart size={14} /> },
  { key: 'rated',     label: 'Rated',     icon: <Star size={14} /> },
  { key: 'lists',     label: 'My Lists',  icon: <ListVideo size={14} /> },
]

export default function AccountPage() {
  const [ready, setReady] = useState(false)
  const [account, setAccount] = useState<TmdbAccount | null>(null)
  const [tab, setTab] = useState<Tab>('watchlist')
  const [media, setMedia] = useState<'movies'|'tv'>('movies')
  const [items, setItems] = useState<any[]>([])
  const [lists, setLists] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { setAccount(getAccount()); setReady(true) }, [])

  const load = useCallback(async () => {
    if (!isLoggedIn()) return
    setLoading(true)
    try {
      if (tab === 'lists') { const r = await accountLists(); setLists(r.results ?? []) }
      else { const r = await accountList(tab, media); setItems(r.results ?? []) }
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }, [tab, media])

  useEffect(() => { if (ready && account) load() }, [ready, account, load])

  if (!ready) return <div className="py-32 text-center"><Loader2 className="animate-spin mx-auto text-[var(--text-3)]" /></div>

  if (!account) {
    return (
      <div className="max-w-md mx-auto px-4 py-28 text-center">
        <h1 className="text-3xl font-black text-[var(--text)] mb-3">Connect your TMDB account</h1>
        <p className="text-[var(--text-2)] mb-8">Sign in with TMDB to manage your watchlist, favorites, ratings, and custom lists — right here.</p>
        <button onClick={() => startLogin().catch((e) => toast.error(e.message))}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-bold rounded-xl">
          <LogIn size={16} /> Sign in with TMDB
        </button>
        <p className="text-[11px] text-[var(--text-3)] mt-4">You&apos;ll approve access on themoviedb.org, then return here.</p>
      </div>
    )
  }

  async function newList() {
    const name = prompt('List name?')
    if (!name) return
    try { await createList(name); toast.success('List created'); load() } catch (e: any) { toast.error(e.message) }
  }
  async function removeList(id: number) {
    if (!confirm('Delete this list?')) return
    try { await deleteList(id); toast.success('Deleted'); setLists((l) => l.filter((x) => x.id !== id)) } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-6"><ArrowLeft size={14}/>Movies</Link>
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          {account.avatar?.tmdb?.avatar_path
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={img(account.avatar.tmdb.avatar_path,'w185')} alt="" className="w-12 h-12 rounded-full object-cover" />
            : <div className="w-12 h-12 rounded-full bg-[var(--brand)] flex items-center justify-center text-white font-bold text-lg">{(account.username||'U')[0].toUpperCase()}</div>}
          <div>
            <h1 className="text-2xl font-black text-[var(--text)]">{account.name || account.username}</h1>
            <p className="text-xs text-[var(--text-3)]">@{account.username} · TMDB account</p>
          </div>
        </div>
        <button onClick={() => { logout().then(() => { setAccount(null); toast.success('Signed out') }) }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] hover:border-red-500/50 text-sm font-semibold text-[var(--text-2)] hover:text-red-400">
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors ${tab===t.key?'bg-[var(--brand)] text-white border-[var(--brand)]':'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-hover)]'}`}>
            {t.icon}{t.label}
          </button>
        ))}
        {tab !== 'lists' && (
          <div className="ml-auto flex gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            {(['movies','tv'] as const).map((m) => (
              <button key={m} onClick={() => setMedia(m)} className={`px-3 py-1 rounded-lg text-xs font-bold ${media===m?'bg-[var(--bg-hover)] text-[var(--text)]':'text-[var(--text-3)]'}`}>{m==='movies'?'Movies':'TV'}</button>
            ))}
          </div>
        )}
        {tab === 'lists' && <button onClick={newList} className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--brand)] text-white text-sm font-bold"><Plus size={14}/>New list</button>}
      </div>

      {loading ? <div className="py-16 text-center"><Loader2 className="animate-spin mx-auto text-[var(--text-3)]" /></div>
       : tab === 'lists' ? (
        lists.length === 0 ? <p className="text-[var(--text-3)] py-12 text-center">No lists yet.</p> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lists.map((l) => (
              <div key={l.id} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 flex flex-col">
                <p className="font-bold text-[var(--text)]">{l.name}</p>
                <p className="text-xs text-[var(--text-3)] mb-3 line-clamp-2">{l.description || 'No description'}</p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs text-[var(--text-3)]">{l.item_count} items</span>
                  <button onClick={() => removeList(l.id)} className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-red-400"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        )
       ) : (
        items.length === 0 ? <p className="text-[var(--text-3)] py-12 text-center">Nothing in your {tab} yet.</p> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items.map((it) => {
              const m = media === 'movies' ? 'movie' : 'tv'
              const t = it.title || it.name
              return (
                <Link key={it.id} href={`/movies/${m}/${it.id}`} className="group block">
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)]">
                    {it.poster_path && /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={img(it.poster_path,'w300')} alt={t} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />}
                    {it.rating != null && <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 text-[10px] font-bold text-amber-400"><Star size={9} className="fill-amber-400"/>{it.rating}</span>}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--text)] truncate">{t}</p>
                </Link>
              )
            })}
          </div>
        )
       )}
    </div>
  )
}
