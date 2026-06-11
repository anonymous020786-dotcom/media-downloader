'use client'
import { useEffect, useState } from 'react'
import { History, ChevronDown, ChevronUp, RefreshCw, CheckCircle2, XCircle, Clock, Film, ImageIcon, Globe, FileText } from 'lucide-react'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

interface HistoryItem {
  id:           number
  job_id:       string | null
  url:          string
  media_type:   string
  format:       string
  quality:      string | null
  status:       string
  title:        string | null
  files:        string[]
  created_at:   string
}

function MediaIcon({ type }: { type: string }) {
  if (type === 'image') return <ImageIcon size={11} className="text-cyan-400" />
  if (type === 'page')  return <Globe size={11} className="text-emerald-400" />
  if (type === 'file' || type === 'torrent') return <FileText size={11} className="text-amber-400" />
  return <Film size={11} className="text-blue-400" />
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 size={11} className="text-emerald-400" />
  if (status === 'failed')    return <XCircle size={11} className="text-red-400" />
  return <Clock size={11} className="text-slate-500" />
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function HistoryPanel() {
  const [open,    setOpen]    = useState(false)
  const [items,   setItems]   = useState<HistoryItem[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)

  const load = async (p = 1) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/history?page=${p}&limit=20`)
      const data = await res.json()
      if (p === 1) {
        setItems(data.items)
      } else {
        setItems((prev) => [...prev, ...data.items])
      }
      setTotal(data.total)
      setPage(p)
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { if (open) load(1) }, [open])

  const hostname = (url: string) => { try { return new URL(url).hostname.replace('www.', '') } catch { return url } }

  return (
    <div className="rounded-xl border border-[#21293a] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-400 hover:text-slate-200 hover:bg-[#1a2235] transition-colors"
      >
        <span className="flex items-center gap-2">
          <History size={13} />
          <span className="font-medium">Download history</span>
          {total > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-700 text-slate-400">{total}</span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="border-t border-[#21293a] bg-[#0d1117]">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-[10px] text-slate-600">{total} total downloads</span>
            <button type="button" onClick={() => load(1)} title="Refresh history"
              className="text-slate-600 hover:text-slate-400 transition-colors">
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {items.length === 0 && !loading && (
            <p className="px-4 pb-4 text-xs text-slate-600">No downloads recorded yet.</p>
          )}

          <div className="divide-y divide-[#181f2e]">
            {items.map((item) => (
              <div key={item.id} className="px-4 py-2.5 flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <MediaIcon type={item.media_type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate leading-snug">
                    {item.title ?? hostname(item.url)}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{hostname(item.url)}</span>
                    <span>·</span>
                    <span>{item.media_type}/{item.format}</span>
                    {item.files.length > 0 && <><span>·</span><span>{item.files.length} file{item.files.length !== 1 ? 's' : ''}</span></>}
                    <span>·</span>
                    <span>{relativeTime(item.created_at)}</span>
                  </p>
                </div>
                <div className="mt-0.5 shrink-0">
                  <StatusIcon status={item.status} />
                </div>
              </div>
            ))}
          </div>

          {items.length < total && (
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() => load(page + 1)}
                disabled={loading}
                className="w-full py-1.5 rounded-lg border border-[#21293a] text-xs text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading…' : `Load more (${total - items.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
