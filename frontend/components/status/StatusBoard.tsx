'use client'
import { useEffect, useState } from 'react'
import { Activity, RefreshCw, CheckCircle2, XCircle, HardDrive, Boxes, AlertTriangle } from 'lucide-react'
import { fetchSystemStatus, fmtBytes, type SystemStatus } from '@/lib/api'

const SERVICE_LABELS: Record<string, string> = {
  redis: 'Queue (Redis)',
  mysql: 'Database (MySQL)',
  python: 'Download engine',
}

const BANNER: Record<SystemStatus['status'], { text: string; cls: string }> = {
  operational:  { text: 'All systems operational',        cls: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40' },
  degraded:     { text: 'Degraded performance',           cls: 'bg-amber-900/30 text-amber-300 border-amber-700/40' },
  major_outage: { text: 'Major outage — some downloads may be unavailable', cls: 'bg-red-900/30 text-red-300 border-red-700/40' },
}

export default function StatusBoard() {
  const [s, setS]         = useState<SystemStatus | null>(null)
  const [err, setErr]     = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setS(await fetchSystemStatus()); setErr(false) }
    catch { setErr(true) }
    finally { setLoading(false) }
  }
  useEffect(() => { load(); const t = setInterval(load, 20_000); return () => clearInterval(t) }, [])

  const banner = s ? BANNER[s.status] : null

  const incidentCls = s?.incident?.severity === 'critical'
    ? 'bg-red-900/30 text-red-200 border-red-700/50'
    : s?.incident?.severity === 'info'
    ? 'bg-sky-900/30 text-sky-200 border-sky-700/50'
    : 'bg-amber-900/30 text-amber-200 border-amber-700/50'

  return (
    <div className="space-y-6">
      {/* Admin-set incident notice */}
      {s?.incident?.active && (
        <div className={`flex items-start gap-2.5 px-5 py-4 rounded-2xl border ${incidentCls}`}>
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium whitespace-pre-line">{s.incident.message}</p>
        </div>
      )}

      {/* Overall banner */}
      <div className={`flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border ${
        err ? 'bg-red-900/30 text-red-300 border-red-700/40' : banner?.cls ?? 'bg-[var(--bg-card)] text-[var(--text-2)] border-[var(--border)]'
      }`}>
        <span className="flex items-center gap-2.5 font-bold">
          <Activity size={18} className={loading ? 'animate-pulse' : ''} />
          {err ? 'Status unavailable' : banner?.text ?? 'Checking…'}
        </span>
        <button onClick={load} aria-label="Refresh"
          className={`p-2 rounded-lg border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] ${loading ? 'animate-spin' : ''}`}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Services */}
      <div className="grid sm:grid-cols-3 gap-3">
        {s && Object.entries(s.checks).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
            <span className="text-sm font-medium text-[var(--text-2)]">{SERVICE_LABELS[k] ?? k}</span>
            {v === 'ok'
              ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-400"><CheckCircle2 size={13} /> Operational</span>
              : <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-red-400"><XCircle size={13} /> Down</span>}
          </div>
        ))}
      </div>

      {/* Disk + sites */}
      <div className="grid sm:grid-cols-2 gap-3">
        {s?.disk && (
          <div className="px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--text-2)]"><HardDrive size={14} /> Storage</span>
              <span className="text-[var(--text-3)]">{fmtBytes(s.disk.free)} free of {fmtBytes(s.disk.total)}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
              <div className={`h-full rounded-full ${s.disk.percent_used >= 90 ? 'bg-red-500' : s.disk.percent_used >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, s.disk.percent_used)}%` }} />
            </div>
          </div>
        )}
        {s?.sites && (
          <div className="px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-2)] mb-1">
              <Boxes size={14} /> Supported sites
            </div>
            <p className="text-2xl font-black text-[var(--text)]">{s.sites.named_extractors.toLocaleString()}<span className="text-sm font-medium text-[var(--text-3)]"> named extractors</span></p>
            <p className="text-[11px] text-[var(--text-3)]">+ generic fallback (effectively unlimited)</p>
          </div>
        )}
      </div>

      {/* Engine versions */}
      {s && Object.keys(s.engines).length > 0 && (
        <div className="px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">Engine versions</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
            {Object.entries(s.engines).map(([name, ver]) => (
              <div key={name} className="flex items-center justify-between text-xs border-b border-[var(--border)] pb-1">
                <span className="text-[var(--text-2)]">{name}</span>
                <span className="font-mono text-[var(--text-3)]">{ver ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {s && <p className="text-center text-[11px] text-[var(--text-3)]">Last updated {new Date(s.updated_at).toLocaleTimeString()} · auto-refreshes every 20s</p>}
    </div>
  )
}
