'use client'
import { useState } from 'react'
import { Play, X } from 'lucide-react'

// "Watch Trailer" button in the detail hero → opens an inline YouTube player.
export default function HeroTrailer({ videoKey, label = 'Watch Trailer' }: { videoKey?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  if (!videoKey) return null
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-bold transition-colors">
        <Play size={15} className="fill-white" /> {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(false)}>
          <button className="absolute top-5 right-5 text-white/80 hover:text-white"><X size={26} /></button>
          <div className="w-full max-w-4xl aspect-video" onClick={(e) => e.stopPropagation()}>
            <iframe className="w-full h-full rounded-xl" src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
              title="Trailer" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
          </div>
        </div>
      )}
    </>
  )
}
