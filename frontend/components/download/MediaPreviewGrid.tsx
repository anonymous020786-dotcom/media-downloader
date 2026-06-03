'use client'
import { useState, useMemo } from 'react'
import Image from 'next/image'
import { Check, X, Download, CheckSquare, Square, Film, ImageIcon, Loader2 } from 'lucide-react'
import { fmtDuration } from '@/lib/api'

export interface PreviewItem {
  url:        string
  title?:     string
  thumbnail?: string
  duration?:  number
  type:       'image' | 'video'
}

interface Props {
  items:     PreviewItem[]
  kind:      'image' | 'video'
  total:     number      // total available (may exceed items shown)
  title?:    string
  format:    string
  onConfirm: (selected: PreviewItem[]) => void
  onClose:   () => void
}

export default function MediaPreviewGrid({ items, kind, total, title, format, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(items.map((_, i) => i)))
  const [submitting, setSubmitting] = useState(false)

  const allSelected  = selected.size === items.length
  const noneSelected = selected.size === 0

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }
  const selectAll  = () => setSelected(new Set(items.map((_, i) => i)))
  const selectNone = () => setSelected(new Set())
  const invert     = () => setSelected((prev) => new Set(items.map((_, i) => i).filter((i) => !prev.has(i))))

  const selectedItems = useMemo(() => items.filter((_, i) => selected.has(i)), [items, selected])

  const confirm = () => {
    if (noneSelected) return
    setSubmitting(true)
    onConfirm(selectedItems)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/80 backdrop-blur-sm animate-fade-in">
      {/* Top bar */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {kind === 'video' ? <Film size={16} className="text-blue-400 shrink-0" /> : <ImageIcon size={16} className="text-cyan-400 shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--text)] truncate">{title || `${total} ${kind === 'video' ? 'videos' : 'images'} found`}</p>
              <p className="text-[11px] text-[var(--text-3)]">
                {selected.size} of {items.length} selected
                {total > items.length && ` · ${total.toLocaleString()} total available`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-lg text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Selection toolbar */}
        <div className="max-w-7xl mx-auto px-4 pb-3 flex flex-wrap items-center gap-2">
          <button onClick={allSelected ? selectNone : selectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors">
            {allSelected ? <Square size={13} /> : <CheckSquare size={13} />}
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          <button onClick={invert}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors">
            Invert
          </button>
          <span className="text-xs text-[var(--text-3)] ml-auto hidden sm:inline">Click any item to toggle</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className={kind === 'video'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
            : 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2'}>
            {items.map((item, i) => {
              const isSel = selected.has(i)
              return (
                <button key={i} onClick={() => toggle(i)}
                  className={`group relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                    isSel ? 'border-[var(--brand)] ring-2 ring-[var(--brand)]/30' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}>
                  {/* Thumbnail */}
                  <div className={`relative bg-[var(--bg-card)] ${kind === 'video' ? 'aspect-video' : 'aspect-square'}`}>
                    {(item.thumbnail || (kind === 'image' && item.url)) ? (
                      <Image
                        src={item.thumbnail || item.url} alt={item.title || ''}
                        fill unoptimized loading="lazy"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {kind === 'video' ? <Film size={24} className="text-[var(--text-3)]" /> : <ImageIcon size={24} className="text-[var(--text-3)]" />}
                      </div>
                    )}
                    {/* Checkbox overlay */}
                    <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                      isSel ? 'bg-[var(--brand)]' : 'bg-black/50 backdrop-blur'
                    }`}>
                      {isSel && <Check size={13} className="text-white" />}
                    </div>
                    {/* Duration */}
                    {item.duration ? (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-semibold">
                        {fmtDuration(item.duration)}
                      </span>
                    ) : null}
                  </div>
                  {/* Title for videos */}
                  {kind === 'video' && (
                    <p className="px-2 py-1.5 text-[11px] text-[var(--text-2)] line-clamp-2 bg-[var(--bg-card)] leading-tight">
                      {item.title || `Video ${i + 1}`}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-[var(--text-2)]">
            <strong className="text-[var(--text)]">{selected.size}</strong> selected · {format.toUpperCase()}
          </span>
          <button onClick={confirm} disabled={noneSelected || submitting}
            className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors">
            {submitting
              ? <><Loader2 size={15} className="spin" />Queueing…</>
              : <><Download size={15} />Download {selected.size} selected</>}
          </button>
        </div>
      </div>
    </div>
  )
}
