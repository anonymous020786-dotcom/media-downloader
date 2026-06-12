import type { Metadata } from 'next'
import {
  Play, Globe, Zap, Shield, Download, Film,
  Music, Image as ImageIcon, Layers, ChevronRight,
} from 'lucide-react'
import PlayerClient from './PlayerClient'

export const metadata: Metadata = {
  title: 'Video Player — Play & Download Any Video Online',
  description: 'Advanced online video player. Play YouTube, TikTok, MP4, HLS, DASH streams and 14,000+ sites directly in your browser. Download any format with one click.',
  alternates: { canonical: '/player' },
}

const FEATURES = [
  { icon: <Play size={14} />, label: 'Universal playback', desc: 'MP4, WebM, HLS, DASH, Twitch, YouTube, TikTok…' },
  { icon: <Download size={14} />, label: 'In-player download', desc: 'See all formats while watching — queue in one click' },
  { icon: <Layers size={14} />, label: 'Quality selector', desc: 'Choose resolution & bitrate from analyzed streams' },
  { icon: <Shield size={14} />, label: 'No install needed', desc: 'Runs entirely in your browser, nothing to download' },
  { icon: <Zap size={14} />, label: 'HLS & DASH support', desc: 'Adaptive streaming via hls.js, works with any CDN' },
  { icon: <Globe size={14} />, label: '14,000+ sites', desc: 'Powered by yt-dlp, gallery-dl, and headless analysis' },
]

const EXAMPLES = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://www.tiktok.com/@username/video/1234567890',
  'https://vimeo.com/148751763',
  'https://example.com/video.m3u8',
  'https://example.com/video.mp4',
  'https://www.twitch.tv/videos/1234567890',
]

interface PageProps {
  searchParams: Promise<{ url?: string }>
}

export default async function PlayerPage({ searchParams }: PageProps) {
  const { url } = await searchParams
  const initialUrl = url ? decodeURIComponent(url) : ''

  return (
    <div className="min-h-screen bg-[var(--bg)]">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative border-b border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
          <div className="hero-blob w-[300px] h-[300px] bg-violet-600/10 -top-20 -right-10" />
          <div className="hero-blob w-[200px] h-[200px] bg-cyan-600/10 top-10 left-10 [animation-delay:1.5s]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge bg-violet-500/15 text-violet-400 border border-violet-500/25">
              <Film size={10} /> Video Player
            </span>
            <span className="badge bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
              14,000+ sites
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[var(--text)] mb-2 leading-tight">
            Play any video — <span className="gradient-text">then download it</span>
          </h1>
          <p className="text-[var(--text-2)] text-sm sm:text-base max-w-xl">
            Paste a URL from YouTube, TikTok, a direct .mp4 or .m3u8 HLS stream, and more.
            Watch it live in the browser, then choose any format to download.
          </p>
        </div>
      </section>

      {/* ── Player ──────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <PlayerClient initialUrl={initialUrl} />
      </section>

      {/* ── Example URLs ────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <h2 className="text-sm font-bold text-[var(--text)] mb-4">Try an example</h2>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((u) => (
              <a
                key={u}
                href={`/player?url=${encodeURIComponent(u)}`}
                className="px-3 py-1.5 text-xs font-mono rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors truncate max-w-[260px]"
                title={u}
              >
                {u.replace('https://', '').slice(0, 45)}{u.length > 53 ? '…' : ''}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature grid ────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h2 className="text-lg font-bold text-[var(--text)] mb-6">What the player supports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.label} className="card p-4 flex gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-[var(--brand)]/10 border border-[var(--brand)]/20 text-[var(--brand)] shrink-0">
                {f.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">{f.label}</p>
                <p className="text-xs text-[var(--text-3)] mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Supported formats callout ────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-1">
              <h2 className="text-base font-bold text-[var(--text)] mb-1">Supported stream types</h2>
              <div className="flex flex-wrap gap-1.5">
                {['MP4','WebM','HLS (.m3u8)','MPEG-DASH (.mpd)','MKV','AVI','MOV','OGG','3GP','M4V',
                  'MP3','M4A','AAC','Opus','FLAC','WAV'].map(t => (
                  <span key={t} className="badge bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-2)]">{t}</span>
                ))}
              </div>
            </div>
            <a href="/download"
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-bold rounded-xl shadow-[var(--shadow-brand)] transition-colors shrink-0">
              <Download size={14} /> Full Download Tool <ChevronRight size={13} />
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
