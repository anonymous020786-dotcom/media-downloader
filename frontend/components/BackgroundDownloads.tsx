'use client'
import { useEffect, useState, useCallback } from 'react'
import { Download, X, Loader2, ChevronDown, ChevronUp, StopCircle } from 'lucide-react'
import { toast } from 'sonner'
import { fetchActiveJobs, stopAllJobs, fmtSpeed, fmtEta, type ActiveJob } from '@/lib/api'

/**
 * Global floating widget that shows what's downloading in the background and
 * lets the user stop everything. Polls /api/jobs/active every 2s while there is
 * activity. Hidden entirely when nothing is downloading.
 */
export default function BackgroundDownloads() {
  const [jobs, setJobs]   = useState<ActiveJob[]>([])
  const [open, setOpen]   = useState(true)
  const [stopping, setStopping] = useState(false)

  const poll = useCallback(async () => {
    try { setJobs(await fetchActiveJobs()) } catch { /* signed out / backend down */ }
  }, [])

  useEffect(() => {
    poll()
    // Poll faster while active, slower when idle.
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [poll])

  async function stopAll() {
    setStopping(true)
    try {
      const r = await stopAllJobs()
      toast.success(`Stopped ${r.stopped} download${r.stopped === 1 ? '' : 's'}`)
      setJobs([])
      poll()
    } catch (e: any) { toast.error(e.message) }
    finally { setStopping(false) }
  }

  if (jobs.length === 0) return null

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--bg-hover)] border-b border-[var(--border)]">
        <Download size={15} className="text-[var(--brand)] animate-pulse" />
        <span className="text-sm font-bold text-[var(--text)]">
          Downloading <span className="text-[var(--brand)]">{jobs.length}</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={stopAll} disabled={stopping}
            title="Stop all downloads"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-600/15 text-rose-400 border border-rose-500/30 hover:bg-rose-600/25 disabled:opacity-50">
            {stopping ? <Loader2 size={12} className="animate-spin" /> : <StopCircle size={12} />} Stop all
          </button>
          <button type="button" onClick={() => setOpen(o => !o)} title={open ? 'Collapse' : 'Expand'}
            className="p-1 rounded-lg text-[var(--text-3)] hover:text-[var(--text)]">
            {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {/* List */}
      {open && (
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-[var(--border)]">
          {jobs.map((j) => {
            const pct = Math.max(0, Math.min(100, j.progress.progress ?? 0))
            const st  = j.progress.status
            return (
              <div key={j.jobId} className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-[12px] font-medium text-[var(--text)]" title={j.title || j.url}>
                    {j.title || j.progress.filename || j.url}
                  </span>
                  <span className="shrink-0 text-[10px] font-mono text-[var(--text-3)] tabular-nums">{pct}%</span>
                </div>
                {/* progress bar */}
                <div className="mt-1.5 h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${st === 'processing' ? 'bg-amber-500' : 'bg-[var(--brand)]'}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-3)]">
                  <span className="capitalize">{st}</span>
                  {j.progress.speed ? <span>· {fmtSpeed(j.progress.speed)}</span> : null}
                  {j.progress.eta ? <span>· ETA {fmtEta(j.progress.eta)}</span> : null}
                  {j.progress.total_files && j.progress.total_files > 1
                    ? <span>· {j.progress.completed_files ?? 0}/{j.progress.total_files} files</span> : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
