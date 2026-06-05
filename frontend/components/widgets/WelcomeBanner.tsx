'use client'
import { useEffect, useState } from 'react'
import {
  Download, Zap, Shield, Globe, X, ChevronRight,
  Film, Music, Image as ImageIcon, Users,
} from 'lucide-react'
import Link from 'next/link'

const STORAGE_KEY = 'welcome_seen_v2'

const FEATURES = [
  { icon: <Globe    size={18} className="text-indigo-400" />, title: '1,000+ Sites',     desc: 'YouTube, Instagram, TikTok, Twitter, Reddit & thousands more' },
  { icon: <Zap      size={18} className="text-cyan-400"   />, title: 'Instant & Free',   desc: 'No signup required. HD, 4K, MP3, MP4, playlists, bulk scraping' },
  { icon: <Shield   size={18} className="text-emerald-400"/>, title: 'Privacy First',    desc: 'Downloads go directly to your device. No data stored.' },
  { icon: <Users    size={18} className="text-violet-400" />, title: 'Smart Features',   desc: 'Scheduled downloads, recurring jobs, proxy support, subtitles' },
]

const STATS = [
  { label: 'Downloads', value: '50M+',  icon: <Download size={14} className="text-indigo-400"/> },
  { label: 'Sites',     value: '1000+', icon: <Globe size={14} className="text-cyan-400"/> },
  { label: 'Formats',   value: '20+',   icon: <Film size={14} className="text-violet-400"/> },
  { label: 'Free',      value: '100%',  icon: <Zap size={14} className="text-emerald-400"/> },
]

export default function WelcomeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (!seen) {
        // Small delay so page is fully rendered first
        setTimeout(() => setVisible(true), 900)
      }
    } catch {}
  }, [])

  const dismiss = (dontShow = false) => {
    setVisible(false)
    if (dontShow) {
      try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    }
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div
        className="relative w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl overflow-hidden shadow-2xl"
        style={{ animation: 'fade-up 0.35s ease-out both' }}
      >
        {/* Close */}
        <button
          onClick={() => dismiss()}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors z-10">
          <X size={16} />
        </button>

        {/* Hero gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500" />

        {/* Logo + headline */}
        <div className="px-7 pt-7 pb-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="MediaDL" className="w-10 h-10 rounded-2xl" />
            <span className="text-2xl font-black text-[var(--text)]">Media<span className="gradient-text">DL</span></span>
          </div>
          <h1 className="text-xl font-black text-[var(--text)] mb-2 leading-tight">
            Download anything from anywhere 🚀
          </h1>
          <p className="text-sm text-[var(--text-2)] leading-relaxed max-w-sm mx-auto">
            Free, fast and unlimited. Paste any video or image URL and download it in seconds.
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 border-t border-b border-[var(--border)] divide-x divide-[var(--border)]">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center py-3 gap-1">
              {s.icon}
              <span className="text-sm font-black text-[var(--text)]">{s.value}</span>
              <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wide">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Feature list */}
        <div className="px-7 py-5 space-y-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text)]">{f.title}</p>
                <p className="text-xs text-[var(--text-2)] leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-7 pb-7 space-y-3">
          <Link href="/download" onClick={() => dismiss(true)}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-black text-sm rounded-2xl transition-colors shadow-lg shadow-indigo-900/40">
            <Download size={16} /> Start Downloading — It's Free
            <ChevronRight size={15} />
          </Link>
          <button
            onClick={() => dismiss(true)}
            className="w-full py-2.5 text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
            Don't show this again
          </button>
        </div>

        {/* Footer credit */}
        <div className="border-t border-[var(--border)] px-7 py-3 text-center">
          <p className="text-[11px] text-[var(--text-3)]">
            Built by <span className="text-[var(--text-2)] font-semibold">Naushad Alam</span>, India 🇮🇳 ·{' '}
            <a href="mailto:contact@zestcommerce.in" className="text-[var(--brand)] hover:underline">contact@zestcommerce.in</a>
          </p>
        </div>
      </div>
    </div>
  )
}
