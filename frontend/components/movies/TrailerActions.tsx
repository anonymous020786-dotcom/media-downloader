'use client'
import { useState } from 'react'
import { Play, Download, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { queueDownload } from '@/lib/api'

export interface Video { key: string; name: string; site: string; type: string; official?: boolean }

export default function TrailerActions({ videos, title }: { videos: Video[]; title: string }) {
  const yt = videos.filter((v) => v.site === 'YouTube')
  const [playing, setPlaying] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  if (yt.length === 0) return <p className="text-sm text-[var(--text-3)]">No trailers available.</p>

  async function download(v: Video) {
    setBusy(v.key)
    try {
      const { jobId } = await queueDownload({
        url: `https://www.youtube.com/watch?v=${v.key}`,
        mediaType: 'video', format: 'mp4', quality: 'best',
        title: `${title} — ${v.name}`,
      })
      toast.success('Trailer queued', { description: `job ${jobId.slice(0, 8)}` })
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy('') }
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-3">
        {yt.slice(0, 6).map((v) => (
          <div key={v.key} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
            <button onClick={() => setPlaying(v.key)}
              className="relative w-24 h-14 shrink-0 rounded-lg overflow-hidden bg-black group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://img.youtube.com/vi/${v.key}/mqdefault.jpg`} alt={v.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
              <Play size={20} className="absolute inset-0 m-auto text-white fill-white/90" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text)] truncate">{v.name}</p>
              <p className="text-[11px] text-[var(--text-3)]">{v.type}{v.official ? ' · official' : ''}</p>
            </div>
            <button onClick={() => download(v)} disabled={busy === v.key}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold">
              {busy === v.key ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download
            </button>
          </div>
        ))}
      </div>

      {playing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setPlaying(null)}>
          <button className="absolute top-5 right-5 text-white/80 hover:text-white"><X size={26} /></button>
          <div className="w-full max-w-4xl aspect-video" onClick={(e) => e.stopPropagation()}>
            <iframe className="w-full h-full rounded-xl" src={`https://www.youtube.com/embed/${playing}?autoplay=1`}
              title="Trailer" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
          </div>
        </div>
      )}
    </>
  )
}
