'use client'
import { useEffect, useState } from 'react'
import { HardDrive, Trash2, RefreshCw, FolderOpen, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import type { StorageJob } from '@/lib/types'
import { fetchStorage, deleteStorage, fileDownloadUrl, fmtBytes } from '@/lib/api'
import { toast } from 'sonner'

const STORAGE_WARNING_GB = 8

export default function StoragePanel() {
  const [open,    setOpen]    = useState(false)
  const [data,    setData]    = useState<{ jobs: StorageJob[]; total_bytes: number; total_jobs: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await fetchStorage()) } catch { } finally { setLoading(false) }
  }

  useEffect(() => { if (open) load() }, [open])

  const handleDelete = async (jobId: string) => {
    await deleteStorage(jobId).catch(() => {})
    setData((prev) => {
      if (!prev) return prev
      const jobs = prev.jobs.filter((j) => j.job_id !== jobId)
      return { ...prev, jobs, total_bytes: jobs.reduce((s, j) => s + j.total_size, 0), total_jobs: jobs.length }
    })
  }

  const handleClearAll = async () => {
    if (!data || data.jobs.length === 0) return
    if (!confirm(`Delete all ${data.total_jobs} stored download${data.total_jobs !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setClearing(true)
    let ok = 0
    for (const j of data.jobs) {
      try { await deleteStorage(j.job_id); ok++ } catch { }
    }
    await load()
    setClearing(false)
    toast.success(`Cleared ${ok} download${ok !== 1 ? 's' : ''}`)
  }

  const totalGB   = (data?.total_bytes ?? 0) / (1024 ** 3)
  const usedPct   = Math.min(100, (totalGB / STORAGE_WARNING_GB) * 100)
  const isWarning = usedPct >= 80

  return (
    <div className="rounded-2xl border border-[#21293a] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#161b27] hover:bg-[#1a2235] transition-colors"
      >
        <span className="flex items-center gap-2 text-slate-400 text-sm">
          <HardDrive size={14} />
          <span className="font-medium">Downloaded files</span>
          {data && data.total_jobs > 0 && (
            <span className="text-[10px] text-slate-500">
              {data.total_jobs} job{data.total_jobs !== 1 ? 's' : ''} · {fmtBytes(data.total_bytes)}
            </span>
          )}
          {isWarning && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
              <AlertTriangle size={10} /> Storage high
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {open && data && data.total_jobs > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleClearAll() }}
              disabled={clearing}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-red-500 hover:bg-red-900/20 transition-colors font-semibold"
              title="Delete all stored files"
            >
              {clearing ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={10} />}
              Clear all
            </button>
          )}
          {open && (
            <button onClick={(e) => { e.stopPropagation(); load() }}
              className={`p-1 rounded hover:text-white text-slate-500 transition-colors ${loading ? 'animate-spin' : ''}`}>
              <RefreshCw size={12} />
            </button>
          )}
          {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </span>
      </button>

      {open && (
        <div className="bg-[#0d1117] border-t border-[#21293a]">
          {/* Disk usage bar */}
          {data && data.total_bytes > 0 && (
            <div className="px-4 pt-3 pb-2 space-y-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-600">Server storage used</span>
                <span className={isWarning ? 'text-amber-400 font-semibold' : 'text-slate-600'}>
                  {fmtBytes(data.total_bytes)} / ~{STORAGE_WARNING_GB} GB
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#21293a] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isWarning ? 'bg-amber-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {loading && !data ? (
              <div className="flex items-center justify-center py-8 text-slate-600 text-sm">
                <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
              </div>
            ) : !data || data.jobs.length === 0 ? (
              <div className="text-center py-8 text-slate-700 text-sm flex flex-col items-center gap-2">
                <FolderOpen size={32} strokeWidth={1} />
                No downloaded files yet
              </div>
            ) : (
              data.jobs.map((job) => (
                <div key={job.job_id} className="border-b border-[#21293a] last:border-0">
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-mono text-slate-600 truncate">{job.job_id}</p>
                      <p className="text-[11px] text-slate-400">
                        {job.file_count} file{job.file_count !== 1 ? 's' : ''} · {fmtBytes(job.total_size)}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(job.job_id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors ml-2"
                      title="Delete this job's files">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="px-4 pb-2.5 flex flex-wrap gap-1.5">
                    {job.files.map((f) => (
                      <a
                        key={f.name}
                        href={fileDownloadUrl(job.job_id, f.name)}
                        download={f.name}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]
                          bg-[#161b27] hover:bg-[#1e2535] border border-[#21293a] hover:border-slate-600
                          text-slate-400 hover:text-emerald-300 transition-colors font-mono"
                        title={`${f.name} (${fmtBytes(f.size)})`}
                      >
                        ↓ {f.name.length > 28 ? f.name.slice(0, 26) + '…' : f.name}
                        <span className="text-slate-700 text-[9px]">({fmtBytes(f.size)})</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
