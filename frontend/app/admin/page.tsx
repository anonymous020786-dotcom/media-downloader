'use client'
import { useEffect, useState } from 'react'
import { Download, CheckCircle2, XCircle, Clock, TrendingUp, RefreshCw } from 'lucide-react'
import { fetchStats, adminDownloads } from '@/lib/api'
import SystemHealth from '@/components/admin/SystemHealth'

export default function AdminDashboard() {
  const [queue, setQueue] = useState({ waiting:0, active:0, completed:0, failed:0, total:0 })
  const [dl, setDl] = useState<any>({ total:0, today:0, by_type:[], by_format:[], recent:[] })
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [q, d] = await Promise.all([fetchStats().catch(()=>null), adminDownloads().catch(()=>null)])
      if (q) setQueue(q)
      if (d) setDl(d)
    } finally { setLoading(false) }
  }
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t) }, [])

  const CARDS = [
    { label: 'Total Downloads', value: dl.total ?? 0,        icon: <Download size={18} />,     color: 'text-blue-400 bg-blue-900/20' },
    { label: 'Today',           value: dl.today ?? 0,        icon: <TrendingUp size={18} />,   color: 'text-emerald-400 bg-emerald-900/20' },
    { label: 'Active Now',      value: queue.active,         icon: <Clock size={18} />,        color: 'text-cyan-400 bg-cyan-900/20' },
    { label: 'In Queue',        value: queue.waiting,        icon: <Clock size={18} />,        color: 'text-violet-400 bg-violet-900/20' },
    { label: 'Completed',       value: queue.completed,      icon: <CheckCircle2 size={18} />, color: 'text-emerald-400 bg-emerald-900/20' },
    { label: 'Failed',          value: queue.failed,         icon: <XCircle size={18} />,      color: 'text-red-400 bg-red-900/20' },
  ]

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-3)]">Real-time overview of MediaDL</p>
        </div>
        <button onClick={load} className={`p-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] ${loading ? 'animate-spin' : ''}`}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {CARDS.map((c) => (
          <div key={c.label} className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.color}`}>{c.icon}</div>
            <p className="text-2xl font-black text-[var(--text)]">{Number(c.value).toLocaleString()}</p>
            <p className="text-[11px] text-[var(--text-3)] uppercase tracking-wide mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* System health */}
      <SystemHealth />

      {/* Breakdown charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* By media type */}
        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text)] mb-4">By Media Type</h2>
          {(dl.by_type ?? []).length === 0
            ? <p className="text-sm text-[var(--text-3)]">No data yet</p>
            : (() => {
                const max = Math.max(...dl.by_type.map((r: any) => r.cnt), 1)
                const COLORS: Record<string,string> = { video:'bg-blue-500', image:'bg-cyan-500', playlist:'bg-violet-500', profile:'bg-pink-500', page:'bg-slate-500', file:'bg-amber-500', torrent:'bg-orange-500' }
                return (
                  <div className="space-y-3">
                    {dl.by_type.map((r: any) => (
                      <div key={r.media_type}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--text-2)] capitalize">{r.media_type || 'unknown'}</span>
                          <span className="font-bold text-[var(--text)] tabular-nums">{r.cnt.toLocaleString()}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${COLORS[r.media_type] ?? 'bg-indigo-500'}`}
                            style={{ width: `${Math.round((r.cnt / max) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()
          }
        </div>

        {/* By format */}
        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text)] mb-4">Top Formats</h2>
          {(dl.by_format ?? []).length === 0
            ? <p className="text-sm text-[var(--text-3)]">No data yet</p>
            : (() => {
                const max = Math.max(...dl.by_format.map((r: any) => r.cnt), 1)
                const FMT_COLORS: Record<string,string> = { mp4:'bg-blue-500', mp3:'bg-pink-500', webm:'bg-violet-500', mkv:'bg-indigo-500', m4a:'bg-rose-500', original:'bg-slate-500' }
                return (
                  <div className="space-y-3">
                    {dl.by_format.slice(0, 8).map((r: any) => (
                      <div key={r.format}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--text-2)] uppercase font-mono">{r.format || 'n/a'}</span>
                          <span className="font-bold text-[var(--text)] tabular-nums">{r.cnt.toLocaleString()}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${FMT_COLORS[r.format] ?? 'bg-emerald-500'}`}
                            style={{ width: `${Math.round((r.cnt / max) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()
          }
        </div>
      </div>

      {/* Recent */}
      <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
        <h2 className="text-sm font-bold text-[var(--text)] mb-4">Recent Downloads</h2>
        {(dl.recent ?? []).length === 0 ? <p className="text-sm text-[var(--text-3)]">No downloads recorded yet</p> : (
          <div className="space-y-1.5">
            {dl.recent.slice(0, 15).map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0 text-xs">
                <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${r.status==='completed'?'bg-emerald-900/40 text-emerald-300':r.status==='failed'?'bg-red-900/40 text-red-300':'bg-slate-800 text-slate-400'}`}>{r.status}</span>
                <span className="text-[var(--text-2)] uppercase">{r.format}</span>
                <span className="text-[var(--text-3)] truncate flex-1">{r.url}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
