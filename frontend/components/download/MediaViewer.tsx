'use client'
import { useEffect, useState } from 'react'
import { X, Download, HardDriveDownload, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { saveToLocation } from '@/lib/save'

export interface ViewerItem { url: string; name: string }

interface Props {
  items:   ViewerItem[]
  index:   number
  onClose: () => void
}

const VIDEO_EXT = new Set(['mp4','webm','mkv','mov','m4v','avi','ts','flv'])
const AUDIO_EXT = new Set(['mp3','m4a','opus','ogg','flac','wav','aac'])

function kindOf(name: string): 'video' | 'audio' | 'image' {
  const e = (name.split('.').pop() || '').toLowerCase()
  if (VIDEO_EXT.has(e)) return 'video'
  if (AUDIO_EXT.has(e)) return 'audio'
  return 'image'
}

export default function MediaViewer({ items, index, onClose }: Props) {
  const [i, setI] = useState(index)
  const [zoom, setZoom] = useState(1)
  const item = items[i]
  const kind = item ? kindOf(item.name) : 'image'

  const prev = () => { setZoom(1); setI((p) => (p - 1 + items.length) % items.length) }
  const next = () => { setZoom(1); setI((p) => (p + 1) % items.length) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [items.length])

  if (!item) return null

  const save = async () => {
    const r = await saveToLocation(item.url, item.name)
    if (r === 'picker') toast.success('Saved to your chosen location')
    else if (r === 'error') toast.error('Could not save file')
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm animate-fade-in">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <span className="text-sm text-white/90 font-medium truncate flex-1">{item.name}</span>
        <span className="text-xs text-white/40 shrink-0">{i + 1} / {items.length}</span>
        {kind === 'image' && (
          <>
            <button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"><ZoomOut size={16} /></button>
            <button onClick={() => setZoom((z) => Math.min(5, z + 0.5))} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"><ZoomIn size={16} /></button>
          </>
        )}
        <button onClick={save} title="Save to location…" className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"><HardDriveDownload size={16} /></button>
        <a href={item.url} download={item.name} title="Quick download" className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"><Download size={16} /></a>
        <button onClick={onClose} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"><X size={18} /></button>
      </div>

      {/* Stage */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden p-4">
        {items.length > 1 && (
          <button onClick={prev} className="absolute left-3 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"><ChevronLeft size={22} /></button>
        )}

        {kind === 'video' && (
          <video key={item.url} src={item.url} controls autoPlay
            className="max-h-full max-w-full rounded-lg shadow-2xl" style={{ maxHeight: '80vh' }} />
        )}
        {kind === 'audio' && (
          <div className="w-full max-w-md p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
            <audio key={item.url} src={item.url} controls autoPlay className="w-full" />
          </div>
        )}
        {kind === 'image' && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.url} alt={item.name}
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-transform"
            style={{ maxHeight: '82vh', transform: `scale(${zoom})`, cursor: zoom > 1 ? 'move' : 'zoom-in' }}
            onClick={() => setZoom((z) => (z >= 3 ? 1 : z + 1))} />
        )}

        {items.length > 1 && (
          <button onClick={next} className="absolute right-3 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"><ChevronRight size={22} /></button>
        )}
      </div>

      {/* Thumbnail strip for images */}
      {items.length > 1 && (
        <div className="shrink-0 flex gap-1.5 overflow-x-auto px-4 py-2 border-t border-white/10">
          {items.map((it, idx) => (
            <button key={it.url} onClick={() => { setZoom(1); setI(idx) }}
              className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 ${idx === i ? 'border-[var(--brand)]' : 'border-transparent opacity-50 hover:opacity-100'}`}>
              {kindOf(it.name) === 'image'
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={it.url} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center bg-white/10 text-white/60 text-[9px]">{(it.name.split('.').pop() || '').toUpperCase()}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
