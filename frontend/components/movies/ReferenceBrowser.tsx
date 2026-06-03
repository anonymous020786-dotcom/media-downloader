'use client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { tmdbRaw, img } from '@/lib/tmdb'

const TABS = [
  { key: 'genres',   label: 'Genres' },
  { key: 'providers',label: 'Watch Providers' },
  { key: 'certs',    label: 'Certifications' },
  { key: 'config',   label: 'Configuration' },
]

export default function ReferenceBrowser() {
  const [tab, setTab] = useState('genres')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    setLoading(true); setErr(''); setData(null)
    const load = async () => {
      try {
        if (tab === 'genres') {
          const [m, t] = await Promise.all([tmdbRaw('/genre/movie/list'), tmdbRaw('/genre/tv/list')])
          setData({ movie: m.genres, tv: t.genres })
        } else if (tab === 'providers') {
          const [m, t] = await Promise.all([tmdbRaw('/watch/providers/movie', { watch_region: 'US' }), tmdbRaw('/watch/providers/tv', { watch_region: 'US' })])
          setData({ movie: m.results?.slice(0, 40), tv: t.results?.slice(0, 40) })
        } else if (tab === 'certs') {
          const [m, t] = await Promise.all([tmdbRaw('/certification/movie/list'), tmdbRaw('/certification/tv/list')])
          setData({ movie: m.certifications, tv: t.certifications })
        } else {
          const [cfg, langs, countries, jobs] = await Promise.all([
            tmdbRaw('/configuration'), tmdbRaw('/configuration/languages'),
            tmdbRaw('/configuration/countries'), tmdbRaw('/configuration/jobs'),
          ])
          setData({ cfg, langs, countries, jobs })
        }
      } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
    }
    load()
  }, [tab])

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] mb-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab===t.key?'border-[var(--brand)] text-[var(--text)]':'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[var(--text-3)]" /></div>}
      {err && <p className="text-red-400 text-sm">{err}</p>}

      {data && tab === 'genres' && (
        <div className="grid sm:grid-cols-2 gap-8">
          {(['movie','tv'] as const).map((m) => (
            <div key={m}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-3">{m === 'movie' ? 'Movie' : 'TV'} Genres</h3>
              <div className="flex flex-wrap gap-2">
                {data[m]?.map((g: any) => (
                  <a key={g.id} href={`/movies?genre=${g.id}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand)]">{g.name}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && tab === 'providers' && (
        <div className="space-y-8">
          {(['movie','tv'] as const).map((m) => (
            <div key={m}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-3">{m === 'movie' ? 'Movie' : 'TV'} providers (US)</h3>
              <div className="flex flex-wrap gap-3">
                {data[m]?.map((p: any) => (
                  <div key={p.provider_id} className="flex flex-col items-center w-20 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(p.logo_path,'w92')} alt={p.provider_name} title={p.provider_name} className="w-12 h-12 rounded-xl border border-[var(--border)]" />
                    <span className="text-[10px] text-[var(--text-3)] mt-1 truncate w-full">{p.provider_name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && tab === 'certs' && (
        <div className="grid sm:grid-cols-2 gap-8">
          {(['movie','tv'] as const).map((m) => (
            <div key={m}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-3">{m === 'movie' ? 'Movie' : 'TV'} (US)</h3>
              <div className="space-y-2">
                {(data[m]?.US ?? []).sort((a: any, b: any) => a.order - b.order).map((c: any) => (
                  <div key={c.certification} className="flex gap-3 p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                    <span className="px-2 py-0.5 rounded bg-[var(--bg-hover)] text-xs font-bold text-[var(--text)] h-fit">{c.certification}</span>
                    <span className="text-xs text-[var(--text-2)]">{c.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && tab === 'config' && (
        <div className="grid sm:grid-cols-3 gap-6 text-sm">
          <Stat label="Languages" value={data.langs?.length} />
          <Stat label="Countries" value={data.countries?.length} />
          <Stat label="Crew Jobs" value={data.jobs?.reduce((a: number, j: any) => a + (j.jobs?.length ?? 0), 0)} />
          <div className="sm:col-span-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">Image base URL</h3>
            <code className="text-xs text-[var(--brand)]">{data.cfg?.images?.secure_base_url}</code>
            <p className="text-xs text-[var(--text-3)] mt-1">Poster sizes: {data.cfg?.images?.poster_sizes?.join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 text-center">
      <p className="text-3xl font-black text-[var(--text)]">{value ?? '—'}</p>
      <p className="text-xs text-[var(--text-3)] mt-1">{label}</p>
    </div>
  )
}
