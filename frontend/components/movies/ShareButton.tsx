'use client'
import { useState } from 'react'
import { Share2, Link2, Check, X } from 'lucide-react'
import { toast } from 'sonner'

// Native share where supported, with a copy-link + social fallback menu.
export default function ShareButton({ title, text }: { title: string; text?: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href : ''

  async function nativeOrMenu() {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await (navigator as any).share({ title, text: text || title, url }); return } catch { /* user cancelled or unsupported */ }
    }
    setOpen((o) => !o)
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success('Link copied'); setTimeout(() => setCopied(false), 1500) }
    catch { toast.error('Could not copy') }
  }

  const share = (href: string) => { window.open(href, '_blank', 'noopener,noreferrer'); setOpen(false) }
  const enc = encodeURIComponent
  const socials = [
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(title + ' ' + url)}` },
    { label: 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}` },
    { label: 'Reddit', href: `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}` },
  ]

  return (
    <div className="relative inline-block">
      <button onClick={nativeOrMenu}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--brand)] transition-colors">
        <Share2 size={14} /> Share
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 z-30 w-48 p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl">
          <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-[var(--border)]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-3)]">Share</span>
            <button onClick={() => setOpen(false)} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={13} /></button>
          </div>
          <button onClick={copy} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[var(--text-2)] hover:bg-[var(--bg-hover)]">
            {copied ? <Check size={14} className="text-emerald-400" /> : <Link2 size={14} />} Copy link
          </button>
          {socials.map((s) => (
            <button key={s.label} onClick={() => share(s.href)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[var(--text-2)] hover:bg-[var(--bg-hover)]">
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
