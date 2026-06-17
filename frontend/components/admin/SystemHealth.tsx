'use client'
import { useEffect, useState } from 'react'
import { Activity, RefreshCw, Download, CheckCircle2, XCircle, Boxes, HardDrive } from 'lucide-react'
import { toast } from 'sonner'
import { fetchHealthDeep, adminEngines, adminUpdateEngines, fetchSupportedSites, fetchDisk, fmtBytes, type DeepHealth, type SupportedSites, type DiskInfo } from '@/lib/api'

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
      {ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}{label}
    </span>
  )
}

export default function SystemHealth() {
  const [h, setH] = useState<DeepHealth | null>(null)
  const [sites, setSites] = useState<SupportedSites | null>(null)
  const [disk, setDisk] = useState<DiskInfo | null>(null)
  const [engineVers, setEngineVers] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [hd, s, e, d] = await Promise.all([
        fetchHealthDeep().catch(() => null),
        fetchSupportedSites().catch(() => null),
        adminEngines().catch(() => null),
        fetchDisk().catch(() => null),
      ])
      setH(hd); setSites(s); setEngineVers(e?.engines ?? {}); setDisk(d)
    } finally { setLoading(false) }
  }
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [])

  async function updateEngines() {
    setUpdating(true)
    try {
      const r = await adminUpdateEngines()
      toast.success(r.changed?.length ? `Updated: ${r.changed.join(', ')}` : 'Engines already up to date', { description: r.note })
      load()
    } catch (e: any) { toast.error(e.message) } finally { setUpdating(false) }
  }

  const checks = h?.checks ?? {}
  const versions = engineVers
  const overallOk = h?.status === 'ok'

  return (
    <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[var(--text)] flex items-center gap-2"><Activity size={15} className={overallOk ? 'text-emerald-400' : 'text-amber-400'} /> System Health</h2>
        <div className="flex items-center gap-2">
          <button onClick={updateEngines} disabled={updating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white text-xs font-bold">
            {updating ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />} Update engines
          </button>
          <button onClick={load} className={`p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-2)] ${loading ? 'animate-spin' : ''}`}><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Service status */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Pill ok={overallOk} label={`Overall: ${h?.status ?? '…'}`} />
        {['redis', 'mysql', 'python', 'downloads_dir'].map((k) => k in checks && (
          <Pill key={k} ok={checks[k] === 'ok'} label={`${k}: ${checks[k]}`} />
        )).filter(Boolean)}
      </div>

      {/* Disk usage */}
      {disk && disk.total > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-[var(--text-3)]">
              <HardDrive size={12} /> Disk
            </span>
            <span className="text-[var(--text-2)]">
              {fmtBytes(disk.used)} / {fmtBytes(disk.total)} used · {fmtBytes(disk.free)} free
              <span className="text-[var(--text-3)]"> · downloads {fmtBytes(disk.downloads_bytes)}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
            <div className={`h-full rounded-full ${disk.percent_used >= 90 ? 'bg-red-500' : disk.percent_used >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, disk.percent_used)}%` }} />
          </div>
        </div>
      )}

      {/* Engines + versions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">Engines</p>
          <div className="space-y-1.5">
            {Object.entries(versions).map(([name, ver]) => (
              <div key={name} className="flex items-center justify-between text-xs border-b border-[var(--border)] pb-1">
                <span className="flex items-center gap-1.5 text-[var(--text-2)]">
                  {ver ? <CheckCircle2 size={11} className="text-emerald-400" /> : <XCircle size={11} className="text-red-400" />}
                  {name}
                </span>
                <span className="font-mono text-[var(--text-3)]">{ver ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-3)] mb-2">Supported Sites</p>
          {sites ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-[var(--text)]"><Boxes size={13} className="text-[var(--brand)]" /><span className="text-lg font-black">{sites.named_extractors.toLocaleString()}</span> named extractors</div>
              {Object.entries(sites.by_engine).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[var(--text-3)] border-b border-[var(--border)] pb-1"><span>{k}</span><span className="font-mono">{v.toLocaleString()}</span></div>
              ))}
              <p className="text-[var(--text-3)] pt-1">+ generic fallback (effectively unlimited)</p>
            </div>
          ) : <p className="text-xs text-[var(--text-3)]">—</p>}
        </div>
      </div>
    </div>
  )
}
