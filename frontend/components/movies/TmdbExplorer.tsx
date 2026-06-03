'use client'
import { useMemo, useState } from 'react'
import { Play, Loader2, Code2, ChevronRight, Search } from 'lucide-react'
import { tmdbRaw, img } from '@/lib/tmdb'
import { TMDB_CATALOG, ALL_ENDPOINTS, ENDPOINT_COUNT, type Endpoint } from '@/lib/tmdb-catalog'
import MovieCard from './MovieCard'

function buildPath(ep: Endpoint, vals: Record<string, string>) {
  let p = ep.path
  ep.pathParams?.forEach((pp) => { p = p.replace(`{${pp.name}}`, encodeURIComponent(vals[pp.name] || pp.default || '')) })
  return p
}

export default function TmdbExplorer() {
  const [selected, setSelected] = useState<Endpoint>(ALL_ENDPOINTS[0])
  const [vals, setVals] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [lastPath, setLastPath] = useState('')

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return TMDB_CATALOG
    return TMDB_CATALOG
      .map((g) => ({ ...g, endpoints: g.endpoints.filter((e) =>
        e.name.toLowerCase().includes(f) || e.path.toLowerCase().includes(f) || g.category.toLowerCase().includes(f)) }))
      .filter((g) => g.endpoints.length)
  }, [filter])

  function selectEp(ep: Endpoint) {
    setSelected(ep); setResult(null); setError('')
    const init: Record<string, string> = {}
    ;[...(ep.pathParams ?? []), ...(ep.query ?? [])].forEach((p) => { if (p.default) init[p.name] = p.default })
    setVals(init)
  }

  async function run() {
    setLoading(true); setError(''); setResult(null)
    try {
      const path = buildPath(selected, vals)
      const q: Record<string, string> = {}
      selected.query?.forEach((p) => { if (vals[p.name]) q[p.name] = vals[p.name] })
      setLastPath(`/api/tmdb${path}${Object.keys(q).length ? '?' + new URLSearchParams(q).toString() : ''}`)
      const data = await tmdbRaw(path, q)
      setResult(data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const inputs = [...(selected.pathParams ?? []).map((p) => ({ ...p, kind: 'path' as const })),
                  ...(selected.query ?? []).map((p) => ({ ...p, kind: 'query' as const }))]

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Filter ${ENDPOINT_COUNT} endpoints…`}
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-2 text-xs text-[var(--text)] outline-none" />
        </div>
        <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-3">
          {groups.map((g) => (
            <div key={g.category}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-3)] px-2 mb-1">{g.category}</p>
              {g.endpoints.map((e) => (
                <button key={e.id} onClick={() => selectEp(e)}
                  className={`w-full flex items-center gap-1 text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    selected.id === e.id ? 'bg-[var(--brand)] text-white' : 'text-[var(--text-2)] hover:bg-[var(--bg-hover)]'}`}>
                  <ChevronRight size={11} className="shrink-0 opacity-60" />{e.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0">
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 mb-5">
          <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
            <h2 className="text-lg font-black text-[var(--text)]">{selected.name}</h2>
            <code className="text-[11px] text-[var(--brand)] bg-[var(--bg-hover)] px-2 py-1 rounded font-mono">GET {selected.path}</code>
          </div>
          {selected.desc && <p className="text-xs text-[var(--text-3)] mb-3">{selected.desc}</p>}

          {inputs.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {inputs.map((p) => (
                <div key={p.name}>
                  <label className="block text-[11px] font-semibold text-[var(--text-2)] mb-1">
                    {p.name}{p.required && <span className="text-red-400"> *</span>}
                    <span className="ml-1 text-[9px] uppercase text-[var(--text-3)]">{p.kind}</span>
                  </label>
                  <input value={vals[p.name] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [p.name]: e.target.value }))}
                    placeholder={p.placeholder || p.default || ''}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none" />
                </div>
              ))}
            </div>
          )}

          <button onClick={run} disabled={loading}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white text-sm font-bold rounded-xl">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Run
          </button>
          {lastPath && <p className="mt-3 text-[11px] text-[var(--text-3)] font-mono break-all">{lastPath}</p>}
        </div>

        {error && <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">{error}</div>}
        {result && <ResultView ep={selected} data={result} />}
      </div>
    </div>
  )
}

function ResultView({ ep, data }: { ep: Endpoint; data: any }) {
  const kind = ep.render ?? 'json'
  const list: any[] = Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.cast) ? data.cast
    : Array.isArray(data?.profiles) ? data.profiles
    : Array.isArray(data) ? data : []

  if ((kind === 'media' || kind === 'people') && list.length) {
    return (
      <div>
        {data.total_results != null && <p className="text-xs text-[var(--text-3)] mb-3">{data.total_results} results · page {data.page}/{data.total_pages}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {list.map((it, i) => <MovieCard key={`${it.id}-${i}`} item={it} />)}
        </div>
      </div>
    )
  }
  if (kind === 'cast' && list.length) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {list.slice(0, 36).map((c, i) => (
          <div key={`${c.id}-${i}`} className="text-center">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] mb-1">
              {c.profile_path && /* eslint-disable-next-line @next/next/no-img-element */
                <img src={img(c.profile_path, 'w185')} alt={c.name} loading="lazy" className="w-full h-full object-cover" />}
            </div>
            <p className="text-xs font-semibold text-[var(--text)] truncate">{c.name}</p>
            <p className="text-[10px] text-[var(--text-3)] truncate">{c.character || c.job || (c.roles?.[0]?.character) || ''}</p>
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'images') {
    const imgs = [...(data.backdrops ?? []), ...(data.posters ?? []), ...(data.profiles ?? []), ...(data.logos ?? []), ...(data.stills ?? [])]
    if (imgs.length) return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {imgs.slice(0, 40).map((im, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <a key={i} href={img(im.file_path, 'original')} target="_blank" rel="noopener noreferrer">
            <img src={img(im.file_path, 'w500')} alt="" loading="lazy" className="w-full rounded-lg border border-[var(--border)]" />
          </a>
        ))}
      </div>
    )
  }
  if (kind === 'videos') {
    const vids = (data.results ?? []).filter((v: any) => v.site === 'YouTube')
    if (vids.length) return (
      <div className="grid sm:grid-cols-2 gap-3">
        {vids.map((v: any) => (
          <a key={v.key} href={`https://www.youtube.com/watch?v=${v.key}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://img.youtube.com/vi/${v.key}/mqdefault.jpg`} alt="" className="w-24 h-14 rounded-lg object-cover" />
            <div className="min-w-0"><p className="text-sm font-semibold text-[var(--text)] truncate">{v.name}</p><p className="text-[11px] text-[var(--text-3)]">{v.type}</p></div>
          </a>
        ))}
      </div>
    )
  }
  // Fallback: pretty JSON (covers config, changes, translations, certifications, etc.)
  return (
    <div className="rounded-2xl bg-[#0d1117] border border-[var(--border)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] text-[var(--text-3)] text-xs"><Code2 size={13} /> JSON response</div>
      <pre className="p-4 text-[11px] text-[var(--text-2)] overflow-x-auto max-h-[60vh] font-mono">{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
