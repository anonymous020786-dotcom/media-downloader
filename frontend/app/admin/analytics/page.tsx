'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  Download, TrendingUp, Users, MessageSquare, FileText,
  CheckCircle2, XCircle, RefreshCw, BarChart2, Globe,
} from 'lucide-react'
import { adminAnalytics } from '@/lib/api'

// ── Mini SVG bar chart ────────────────────────────────────────────────────────
function BarChart({ data, color = '#6366f1', height = 80 }: {
  data: { label: string; value: number }[]
  color?: string
  height?: number
}) {
  if (!data.length) return <p className="text-xs text-[var(--text-3)] py-4">No data</p>
  const max   = Math.max(...data.map((d) => d.value), 1)
  const w     = 100 / data.length
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${data.length * 12} ${height + 20}`} className="w-full" preserveAspectRatio="none" style={{ minWidth: data.length * 8 }}>
        {data.map((d, i) => {
          const bh = Math.max(2, (d.value / max) * height)
          return (
            <g key={i}>
              <rect
                x={i * 12 + 1}
                y={height - bh}
                width={10}
                height={bh}
                rx={2}
                fill={color}
                opacity={0.85}
              />
              {data.length <= 14 && (
                <text
                  x={i * 12 + 6}
                  y={height + 14}
                  textAnchor="middle"
                  fontSize="5"
                  fill="#4b5563"
                >
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Horizontal progress bar ───────────────────────────────────────────────────
function HBar({ label, value, total, color = 'bg-indigo-500' }: {
  label: string; value: number; total: number; color?: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--text-2)] truncate max-w-[180px]">{label || '(unknown)'}</span>
        <span className="font-bold text-[var(--text)] tabular-nums ml-2">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function Card({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string
}) {
  return (
    <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>{icon}</div>
      <p className="text-2xl font-black text-[var(--text)] tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-[11px] text-[var(--text-3)] uppercase tracking-wide mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-[var(--text-3)] mt-1">{sub}</p>}
    </div>
  )
}

const RANGE_OPTIONS = [
  { label: '7d',  days: 7  },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

const TYPE_COLORS: Record<string, string> = {
  video:'bg-blue-500', image:'bg-cyan-500', playlist:'bg-violet-500',
  profile:'bg-pink-500', page:'bg-slate-500', file:'bg-amber-500',
}
const FMT_COLORS: Record<string, string> = {
  mp4:'bg-blue-500', mp3:'bg-pink-500', webm:'bg-violet-500',
  mkv:'bg-indigo-500', m4a:'bg-rose-500', original:'bg-slate-500',
}

export default function AdminAnalytics() {
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days,    setDays]    = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await adminAnalytics(days)) }
    catch { /* show stale data */ }
    finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  const s   = data?.summary ?? {}
  const dlByDay: { label: string; value: number }[] = (data?.dl_by_day ?? []).map((r: any) => ({
    label: new Date(r.day).toLocaleDateString('en', { month: 'numeric', day: 'numeric' }),
    value: r.cnt,
  }))
  const dlByHour: { label: string; value: number }[] = Array.from({ length: 24 }, (_, h) => ({
    label: `${h}`,
    value: (data?.dl_by_hour ?? []).find((r: any) => r.hour === h)?.cnt ?? 0,
  }))
  const msgByDay: { label: string; value: number }[] = (data?.msg_by_day ?? []).map((r: any) => ({
    label: new Date(r.day).toLocaleDateString('en', { month: 'numeric', day: 'numeric' }),
    value: r.cnt,
  }))

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">Analytics</h1>
          <p className="text-sm text-[var(--text-3)]">Real-time insights across downloads, messages & content</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Range selector */}
          <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1">
            {RANGE_OPTIONS.map((r) => (
              <button key={r.days} onClick={() => setDays(r.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${days === r.days ? 'bg-[var(--brand)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text)]'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={load}
            className={`p-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] ${loading ? 'animate-spin' : ''}`}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <Card label="Total Downloads" value={s.dl_total ?? 0}    icon={<Download size={18}/>}      color="text-blue-400 bg-blue-900/20" />
        <Card label="This Month"      value={s.dl_month ?? 0}    icon={<TrendingUp size={18}/>}     color="text-emerald-400 bg-emerald-900/20"
          sub={`Today: ${(s.dl_today ?? 0).toLocaleString()}`} />
        <Card label="Success Rate"    value={`${s.success_rate ?? 0}%`} icon={<CheckCircle2 size={18}/>} color="text-cyan-400 bg-cyan-900/20"
          sub={`${(s.dl_failed ?? 0).toLocaleString()} failed`} />
        <Card label="Unique Users"    value={s.unique_users ?? 0} icon={<Users size={18}/>}         color="text-violet-400 bg-violet-900/20" />
        <Card label="Messages"        value={s.msg_total ?? 0}   icon={<MessageSquare size={18}/>}  color="text-pink-400 bg-pink-900/20"
          sub={`${s.msg_unread ?? 0} unread · ${s.msg_replied ?? 0} replied`} />
        <Card label="Blog Posts"      value={s.blog_published ?? 0} icon={<FileText size={18}/>}   color="text-amber-400 bg-amber-900/20"
          sub={`${s.blog_total ?? 0} total`} />
        <Card label="This Week"       value={s.dl_week ?? 0}     icon={<BarChart2 size={18}/>}      color="text-indigo-400 bg-indigo-900/20" />
        <Card label="Failed"          value={s.dl_failed ?? 0}   icon={<XCircle size={18}/>}        color="text-red-400 bg-red-900/20" />
      </div>

      {/* Downloads over time */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text)] mb-1">Downloads — last {days} days</h2>
          <p className="text-xs text-[var(--text-3)] mb-4">{dlByDay.reduce((a, b) => a + b.value, 0).toLocaleString()} total in range</p>
          <BarChart data={dlByDay} color="#6366f1" height={80} />
        </div>

        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text)] mb-1">Downloads by hour — today</h2>
          <p className="text-xs text-[var(--text-3)] mb-4">{dlByHour.reduce((a, b) => a + b.value, 0).toLocaleString()} downloads today</p>
          <BarChart data={dlByHour} color="#06b6d4" height={80} />
        </div>
      </div>

      {/* Type + format breakdown */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text)] mb-4">By Media Type</h2>
          <div className="space-y-3">
            {(data?.by_type ?? []).map((r: any) => (
              <HBar key={r.media_type} label={r.media_type || 'unknown'} value={r.cnt}
                total={s.dl_total ?? 1} color={TYPE_COLORS[r.media_type] ?? 'bg-indigo-500'} />
            ))}
            {!(data?.by_type?.length) && <p className="text-xs text-[var(--text-3)]">No data yet</p>}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text)] mb-4">Top Formats</h2>
          <div className="space-y-3">
            {(data?.by_format ?? []).slice(0, 8).map((r: any) => (
              <HBar key={r.format} label={(r.format || 'n/a').toUpperCase()} value={r.cnt}
                total={s.dl_total ?? 1} color={FMT_COLORS[r.format] ?? 'bg-emerald-500'} />
            ))}
            {!(data?.by_format?.length) && <p className="text-xs text-[var(--text-3)]">No data yet</p>}
          </div>
        </div>
      </div>

      {/* Top domains + messages chart */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text)] mb-1 flex items-center gap-2">
            <Globe size={14} className="text-[var(--brand)]" /> Top Domains — last {days} days
          </h2>
          <p className="text-xs text-[var(--text-3)] mb-4">Most frequently downloaded from</p>
          <div className="space-y-3">
            {(data?.top_domains ?? []).filter((r: any) => r.domain).map((r: any) => (
              <HBar key={r.domain} label={r.domain} value={r.cnt}
                total={Math.max(...(data?.top_domains ?? []).map((x: any) => x.cnt), 1)} color="bg-indigo-500" />
            ))}
            {!(data?.top_domains?.filter((r: any) => r.domain).length) && <p className="text-xs text-[var(--text-3)]">No domain data yet</p>}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text)] mb-1">Messages — last 30 days</h2>
          <p className="text-xs text-[var(--text-3)] mb-4">{msgByDay.reduce((a, b) => a + b.value, 0).toLocaleString()} contact messages received</p>
          <BarChart data={msgByDay} color="#ec4899" height={80} />
        </div>
      </div>

      {/* Quality breakdown */}
      {(data?.by_quality?.length > 0) && (
        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] mb-6">
          <h2 className="text-sm font-bold text-[var(--text)] mb-4">Quality Preferences</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {(data?.by_quality ?? []).map((r: any) => {
              const pct = s.dl_total > 0 ? Math.round((r.cnt / s.dl_total) * 100) : 0
              return (
                <div key={r.quality} className="flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                  <span className="text-xs font-semibold text-[var(--text-2)] uppercase">{r.quality || 'n/a'}</span>
                  <div className="text-right">
                    <span className="text-sm font-black text-[var(--text)] tabular-nums">{r.cnt.toLocaleString()}</span>
                    <span className="text-[10px] text-[var(--text-3)] ml-1">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
