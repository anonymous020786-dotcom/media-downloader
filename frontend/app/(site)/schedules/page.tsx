'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthContext'
import { CalendarClock, Trash2, RefreshCw, LogIn, Plus, Clock, RepeatIcon } from 'lucide-react'
import { toast } from 'sonner'
import { fetchSchedules, deleteSchedule, type ScheduleRow } from '@/lib/api'

function cronLabel(pattern: string) {
  if (pattern === '0 * * * *') return 'Every hour'
  if (pattern === '0 9 * * *') return 'Daily at 9 am'
  if (pattern === '0 9 * * 1') return 'Every Monday at 9 am'
  return pattern
}

function nextRun(ts: number) {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = Date.now()
  const diff = ts - now
  if (diff < 0) return 'Soon'
  if (diff < 60_000) return 'In <1 min'
  if (diff < 3_600_000) return `In ${Math.round(diff / 60_000)} min`
  if (diff < 86_400_000) return `In ${Math.round(diff / 3_600_000)}h`
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SchedulesPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const [rows,    setRows]    = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try { setRows(await fetchSchedules()) } catch { setRows([]) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (key: string) => {
    if (!confirm('Cancel this recurring schedule? This will not affect downloads already in progress.')) return
    setDeleting(key)
    try {
      await deleteSchedule(key)
      setRows((prev) => prev.filter((r) => r.key !== key))
      toast.success('Schedule cancelled')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDeleting(null)
    }
  }

  if (isLoaded && !isSignedIn) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <CalendarClock size={40} strokeWidth={1.2} className="mx-auto mb-4 text-[var(--text-3)]" />
        <h1 className="text-2xl font-black text-[var(--text)] mb-2">Sign in to manage schedules</h1>
        <p className="text-[var(--text-2)] mb-6">Recurring download schedules are tied to your account.</p>
        <Link href="/sign-in" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white font-semibold text-sm">
          <LogIn size={15} /> Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)] flex items-center gap-2">
            <CalendarClock size={26} className="text-[var(--brand)]" /> Recurring Schedules
          </h1>
          <p className="text-sm text-[var(--text-3)] mt-1">
            Downloads that repeat automatically on a schedule
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} title="Refresh"
            className={`p-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors ${loading ? 'animate-spin' : ''}`}>
            <RefreshCw size={15} />
          </button>
          <Link href="/download"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-semibold transition-colors">
            <Plus size={14} /> New schedule
          </Link>
        </div>
      </div>

      {/* How-to hint */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-indigo-950/30 border border-indigo-700/30 text-xs text-indigo-300">
        <RepeatIcon size={14} className="shrink-0 mt-0.5 text-indigo-400" />
        <span>
          To create a recurring download, go to <Link href="/download" className="underline">Download</Link>, paste a URL, expand <strong>Advanced options</strong>, and set <strong>Repeat</strong> to Hourly, Daily, or Weekly.
        </span>
      </div>

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <div className="text-center py-20 space-y-3">
          <CalendarClock size={44} strokeWidth={1} className="mx-auto text-[var(--text-3)]" />
          <p className="text-[var(--text-3)] text-sm">No recurring schedules yet</p>
          <Link href="/download" className="inline-flex items-center gap-1.5 text-sm text-[var(--brand)] underline">
            <Plus size={13} /> Create your first schedule
          </Link>
        </div>
      )}

      {/* Schedule list */}
      {rows.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)] overflow-hidden">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-4 px-4 py-4 hover:bg-[var(--bg-hover)] transition-colors group">
              <div className="w-9 h-9 rounded-xl bg-indigo-950/50 border border-indigo-800/40 flex items-center justify-center shrink-0">
                <RepeatIcon size={15} className="text-indigo-400" />
              </div>

              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-[var(--text)] truncate" title={row.key}>
                  {row.name || 'download'}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-[var(--text-3)]">
                  <span className="flex items-center gap-1">
                    <RepeatIcon size={9} /> {cronLabel(row.pattern)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={9} /> Next: {nextRun(row.next)}
                  </span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[var(--bg-hover)] text-[var(--text-3)] shrink-0 hidden sm:block">
                {row.pattern}
              </span>

              <button
                onClick={() => handleDelete(row.key)}
                disabled={deleting === row.key}
                className="shrink-0 p-2 rounded-xl text-[var(--text-3)] hover:text-red-400 hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                title="Cancel schedule"
              >
                {deleting === row.key
                  ? <RefreshCw size={14} className="animate-spin" />
                  : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-center text-[var(--text-3)]">
        Cancelled schedules stop future runs but do not affect downloads already queued.
      </p>
    </div>
  )
}
