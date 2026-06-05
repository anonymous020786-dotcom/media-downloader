'use client'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Inbox, Trash2, Wifi, WifiOff } from 'lucide-react'
import JobCard from './JobCard'
import type { Job, JobProgress } from '@/lib/types'
import { fetchJobs, deleteJob, retryJob, clearJobs, subscribeProgress } from '@/lib/api'
import { getSocket, isSocketConnected } from '@/lib/socket'

type Filter = 'all' | 'active' | 'done' | 'failed'

interface Props {
  newJobId?: string
  newJob?:   Omit<Job, 'progress' | 'bullId'>
  onJobAdded?: () => void
}

function DownloadQueueInner({ newJobId, newJob, onJobAdded }: Props) {
  const [jobs,    setJobs]    = useState<Job[]>([])
  const [filter,  setFilter]  = useState<Filter>('all')
  const [wsState, setWsState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const subs = useRef<Map<string, () => void>>(new Map())

  // Track Socket.io connection state
  useEffect(() => {
    getSocket() // ensure init
    const check = setInterval(() => {
      const connected = isSocketConnected()
      setWsState(connected ? 'connected' : 'disconnected')
    }, 1000)
    // Also subscribe to socket events when available
    const s = getSocket()
    if (s) {
      s.on('connect',    () => setWsState('connected'))
      s.on('disconnect', () => setWsState('disconnected'))
    }
    return () => {
      clearInterval(check)
      const sock = getSocket()
      if (sock) { sock.off('connect'); sock.off('disconnect') }
    }
  }, [])

  // ── Load existing jobs once on mount ─────────────────────────────────────
  useEffect(() => {
    fetchJobs()
      .then((loaded) => {
        setJobs(loaded)
        loaded.forEach((j) => {
          if (!['completed','failed'].includes(j.progress.status) && !subs.current.has(j.jobId)) {
            subs.current.set(j.jobId,
              subscribeProgress(j.jobId,
                (p) => updateProgress(j.jobId, p),
                () => subs.current.delete(j.jobId)))
          }
        })
      })
      .catch(console.error)
    return () => { subs.current.forEach((u) => u()); subs.current.clear() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── New job from parent ───────────────────────────────────────────────────
  useEffect(() => {
    if (!newJobId || !newJob) return
    const placeholder: Job = { ...newJob, bullId: newJobId, progress: { status: 'queued', progress: 0 } }
    setJobs((prev) => {
      if (prev.some((j) => j.jobId === newJobId)) return prev
      return [placeholder, ...prev]
    })
    subs.current.set(newJobId,
      subscribeProgress(newJobId,
        (p) => updateProgress(newJobId, p),
        () => { subs.current.delete(newJobId); onJobAdded?.() }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newJobId])

  const updateProgress = useCallback((jobId: string, progress: JobProgress) => {
    setJobs((prev) => {
      if (
        progress.status === 'completed' &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        const job = prev.find((j) => j.jobId === jobId)
        if (job && job.progress.status !== 'completed') {
          const label = job.title ?? (() => { try { return new URL(job.url).hostname } catch { return 'download' } })()
          const files = progress.files?.length ?? 0
          new Notification('Download complete ✓', {
            body: `${label}${files > 1 ? ` · ${files} files` : ''}`,
            icon: '/logo.svg',
            tag: `mediadl-${jobId}`,
          })
        }
      }
      return prev.map((j) => j.jobId === jobId ? { ...j, progress } : j)
    })
  }, [])

  const handleDelete = useCallback(async (bullId: string) => {
    await deleteJob(bullId).catch(() => {})
    setJobs((prev) => {
      const j = prev.find((x) => x.bullId === bullId)
      if (j) { subs.current.get(j.jobId)?.(); subs.current.delete(j.jobId) }
      return prev.filter((x) => x.bullId !== bullId)
    })
  }, [])

  const handleRetry = useCallback(async (bullId: string) => {
    await retryJob(bullId).catch(() => {})
    setJobs((prev) => prev.map((j) => {
      if (j.bullId !== bullId) return j
      subs.current.get(j.jobId)?.()
      subs.current.set(j.jobId,
        subscribeProgress(j.jobId,
          (p) => updateProgress(j.jobId, p),
          () => subs.current.delete(j.jobId)))
      return { ...j, progress: { status: 'queued', progress: 0 } }
    }))
  }, [updateProgress])

  const handleClear = useCallback(async (type?: 'completed'|'failed') => {
    await clearJobs(type).catch(() => {})
    setJobs((prev) => prev.filter((j) => {
      if (!type) return !['completed','failed'].includes(j.progress.status)
      return j.progress.status !== (type === 'completed' ? 'completed' : 'failed')
    }))
  }, [])

  // ── Derived state (memoized) ──────────────────────────────────────────────
  const { active, completed, failed } = useMemo(() => ({
    active:    jobs.filter((j) => !['completed','failed'].includes(j.progress.status)).length,
    completed: jobs.filter((j) => j.progress.status === 'completed').length,
    failed:    jobs.filter((j) => j.progress.status === 'failed').length,
  }), [jobs])

  const visible = useMemo(() => jobs.filter((j) => {
    if (filter === 'active') return !['completed','failed'].includes(j.progress.status)
    if (filter === 'done')   return j.progress.status === 'completed'
    if (filter === 'failed') return j.progress.status === 'failed'
    return true
  }), [jobs, filter])

  const tabs = useMemo(() => [
    { key: 'all'    as Filter, label: 'All',    count: jobs.length, accent: 'text-[#f1f5f9]'   },
    { key: 'active' as Filter, label: 'Active', count: active,      accent: 'text-cyan-400'     },
    { key: 'done'   as Filter, label: 'Done',   count: completed,   accent: 'text-emerald-400'  },
    { key: 'failed' as Filter, label: 'Failed', count: failed,      accent: 'text-red-400'      },
  ], [jobs.length, active, completed, failed])

  return (
    <div className="space-y-3">
      {/* Tab bar + clear buttons */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Tabs + WS badge */}
        <div className="flex items-center gap-2">
        <div className="flex gap-0.5 bg-[#161b27] border border-[#21293a] rounded-xl p-1 overflow-x-auto scrollbar-none">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filter === t.key ? 'bg-[#21293a] text-[#f1f5f9]' : 'text-[#475569] hover:text-[#94a3b8]'
              }`}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] font-bold tabular-nums ${filter === t.key ? t.accent : 'text-[#2d3a4f]'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Socket.io connection badge */}
        <div title={wsState === 'connected' ? 'Real-time via WebSocket' : wsState === 'connecting' ? 'Connecting…' : 'Using SSE fallback'}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            wsState === 'connected'
              ? 'text-emerald-400 bg-emerald-900/20 border border-emerald-800/40'
              : wsState === 'connecting'
              ? 'text-amber-400 bg-amber-900/20 border border-amber-800/40'
              : 'text-[#475569] bg-[#161b27] border border-[#21293a]'
          }`}>
          {wsState === 'connected' ? <Wifi size={9} /> : <WifiOff size={9} />}
          <span className="hidden sm:inline">
            {wsState === 'connected' ? 'Live' : wsState === 'connecting' ? '…' : 'SSE'}
          </span>
        </div>
        </div>

        {/* Clear actions */}
        {(completed > 0 || failed > 0) && (
          <div className="flex gap-1.5 shrink-0">
            {completed > 0 && (
              <button onClick={() => handleClear('completed')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-[#475569] hover:text-emerald-400
                           border border-[#21293a] hover:border-emerald-900/60 rounded-xl transition-colors">
                <Trash2 size={10} />Done
              </button>
            )}
            {failed > 0 && (
              <button onClick={() => handleClear('failed')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-[#475569] hover:text-red-400
                           border border-[#21293a] hover:border-red-900/60 rounded-xl transition-colors">
                <Trash2 size={10} />Failed
              </button>
            )}
          </div>
        )}
      </div>

      {/* Job list */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#2d3a4f]">
          <Inbox size={40} strokeWidth={1.2} className="mb-3" />
          <p className="text-sm text-[#475569]">
            {jobs.length === 0 ? 'No downloads yet — paste a URL above' : `No ${filter} downloads`}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((job) => (
            <JobCard key={job.bullId} job={job} onDelete={handleDelete} onRetry={handleRetry} />
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(DownloadQueueInner)
