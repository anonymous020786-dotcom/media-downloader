'use client'
import { useState } from 'react'
import { X, Download, FileText } from 'lucide-react'

interface Props {
  onClose:  () => void
  onSubmit: (urls: string[]) => void
}

export default function BulkModal({ onClose, onSubmit }: Props) {
  const [text, setText] = useState('')

  const urls = text.split('\n').map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l))
  const dupes = urls.length - new Set(urls).size

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#161b27] border border-[#21293a] rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#21293a]">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            <h2 className="text-white font-semibold">Bulk Import URLs</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <p className="text-slate-500 text-xs leading-relaxed">
            Paste one URL per line — videos, images, or page URLs all work.
            Each URL is analyzed individually and queued with its best default format.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"https://youtube.com/watch?v=...\nhttps://example.com/photo.jpg\nhttps://gallery.site/page"}
            rows={9}
            className="w-full bg-[#0d1117] border border-[#21293a] focus:border-blue-500/60 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none font-mono transition-colors"
          />
          {urls.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-blue-400 font-medium">{urls.length} URL{urls.length !== 1 ? 's' : ''} detected</span>
              {dupes > 0 && <span className="text-amber-500">{dupes} duplicate{dupes > 1 ? 's' : ''} will be skipped</span>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-[#21293a]">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { if (urls.length) { onSubmit([...new Set(urls)]); onClose() } }}
            disabled={urls.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Download size={14} />
            Queue {urls.length > 0 ? `${[...new Set(urls)].length} ` : ''}Download{urls.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
