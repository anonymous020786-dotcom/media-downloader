'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Zap, Film, ImageIcon, Globe, List, Shield, Cpu, Clipboard, X, Activity } from 'lucide-react'
import { toast } from 'sonner'
import URLInputSection from '@/components/URLInputSection'
import DownloadQueue from '@/components/DownloadQueue'
import StoragePanel from '@/components/StoragePanel'
import HistoryPanel from '@/components/download/HistoryPanel'
import type { Job } from '@/lib/types'
import { fetchStats } from '@/lib/api'

interface Stats { waiting: number; active: number; completed: number; failed: number; total: number }

const BADGES = [
  { icon: <Film size={9}/>,      label: 'Video · Audio',        color: 'text-blue-400'    },
  { icon: <ImageIcon size={9}/>, label: 'Images · Galleries',   color: 'text-cyan-400'    },
  { icon: <List size={9}/>,      label: 'Playlists · Channels', color: 'text-violet-400'  },
  { icon: <Globe size={9}/>,     label: 'Profile scraping',     color: 'text-emerald-400' },
  { icon: <Zap size={9}/>,       label: 'HLS + AES-128',        color: 'text-amber-400'   },
  { icon: <Shield size={9}/>,    label: 'Cookie bypass',        color: 'text-pink-400'    },
  { icon: <Cpu size={9}/>,       label: '16× fragments',        color: 'text-[var(--text-2)]' },
]

export default function DownloadTool() {
  const params = useSearchParams()
  const initialUrl = params.get('url') ?? ''

  const [pendingJobId, setPendingJobId] = useState<string | undefined>(undefined)
  const [pendingJob,   setPendingJob]   = useState<Omit<Job,'progress'|'bullId'> | undefined>(undefined)
  const [stats,        setStats]        = useState<Stats>({ waiting:0, active:0, completed:0, failed:0, total:0 })
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null)
  const [urlForInput,  setUrlForInput]  = useState<string | undefined>(undefined)
  const prevId = useRef<string | undefined>(undefined)
  const clipboardChecked = useRef(false)

  useEffect(() => {
    const load = () => fetchStats().then(setStats).catch(() => {})
    load(); const t = setInterval(load, 5000); return () => clearInterval(t)
  }, [])

  // Clipboard detection — check once on first focus (needs permission or user gesture)
  useEffect(() => {
    const check = async () => {
      if (clipboardChecked.current) return
      clipboardChecked.current = true
      try {
        if (!navigator.clipboard?.readText) return
        const text = await navigator.clipboard.readText()
        const trimmed = text?.trim()
        if (trimmed && trimmed.startsWith('http') && trimmed.length < 2000 && !initialUrl) {
          setClipboardUrl(trimmed)
        }
      } catch { /* clipboard permission denied — silently ignore */ }
    }
    window.addEventListener('focus', check, { once: true })
    setTimeout(check, 500)
    return () => window.removeEventListener('focus', check)
  }, [initialUrl])

  const handleQueued = useCallback((jobId: string, job: Omit<Job,'progress'|'bullId'>) => {
    if (jobId === prevId.current) return
    prevId.current = jobId
    setPendingJobId(jobId); setPendingJob(job)
    setStats((s) => ({ ...s, waiting: s.waiting+1, total: s.total+1 }))
    toast.success('Added to queue', { description: job.title ?? job.url, duration: 3000 })
  }, [])

  const applyClipboard = () => {
    setUrlForInput(clipboardUrl!)
    setClipboardUrl(null)
  }

  const hasActivity = stats.active > 0 || stats.waiting > 0 || stats.failed > 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Clipboard banner */}
      {clipboardUrl && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-950/40 border border-indigo-700/40">
          <Clipboard size={14} className="text-indigo-400 shrink-0" />
          <p className="flex-1 min-w-0 text-xs text-indigo-300 truncate">
            URL detected in clipboard: <span className="font-mono text-indigo-200">{clipboardUrl}</span>
          </p>
          <button
            onClick={applyClipboard}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
          >
            Use it
          </button>
          <button onClick={() => setClipboardUrl(null)} className="text-indigo-600 hover:text-indigo-400">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-[var(--text)]">
          Download <span className="gradient-text">Unlimited</span> Media
        </h1>
        <p className="text-[var(--text-2)] text-sm max-w-xl mx-auto leading-relaxed">
          Single video · Full playlists · Entire profiles · Unlimited images.
          HLS, DASH, encrypted streams. 1000+ sites. No blocks. No limits.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {BADGES.map((b, i) => (
            <span key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold ${b.color} bg-[var(--bg-card)] border border-[var(--border)]`}>
              {b.icon}{b.label}
            </span>
          ))}
        </div>
      </div>

      {/* Input */}
      <URLInputSection onQueued={handleQueued} initialUrl={urlForInput ?? initialUrl} />

      {/* Divider + live stats */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-[var(--border)]" />
        <span className="text-[10px] text-[var(--text-3)] uppercase tracking-[0.2em] font-bold flex items-center gap-1.5">
          {hasActivity && <Activity size={9} className="text-cyan-400" />}
          Queue
        </span>
        <div className="flex-1 border-t border-[var(--border)]" />
        {hasActivity && (
          <div className="flex items-center gap-2 text-[10px] shrink-0">
            {stats.active > 0 && (
              <span className="flex items-center gap-1 text-cyan-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                {stats.active} active
              </span>
            )}
            {stats.waiting > 0 && (
              <span className="text-slate-500">{stats.waiting} queued</span>
            )}
            {stats.failed > 0 && (
              <span className="text-red-500 font-semibold">{stats.failed} failed</span>
            )}
            {stats.completed > 0 && (
              <span className="text-emerald-600">{stats.completed} done</span>
            )}
          </div>
        )}
      </div>

      <DownloadQueue
        newJobId={pendingJobId}
        newJob={pendingJob}
        onJobAdded={() => { setPendingJobId(undefined); setPendingJob(undefined) }}
      />

      <StoragePanel />
      <HistoryPanel />

      {/* Bookmarklet */}
      <div className="rounded-xl border border-[#21293a] p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-400 flex items-center gap-2">
          <Zap size={12} className="text-amber-400" />
          Browser bookmarklet
        </p>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Drag the button below to your bookmarks bar. Click it on any page to send the current URL straight to MediaDL.
        </p>
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a
          href={`javascript:(function(){window.open('${typeof window !== 'undefined' ? window.location.origin : ''}/download?url='+encodeURIComponent(location.href),'_blank');})()`}
          className="inline-block px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-600/40 text-amber-300 text-xs font-bold hover:bg-amber-600/30 transition-colors cursor-grab"
          onClick={(e) => e.preventDefault()}
          draggable
        >
          ⬇ MediaDL
        </a>
      </div>
    </div>
  )
}
