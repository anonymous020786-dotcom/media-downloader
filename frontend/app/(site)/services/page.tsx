import type { Metadata } from 'next'
import Link from 'next/link'
import { Film, ImageIcon, Music, List, Globe, Zap, Layers, Subtitles, Cookie, Shuffle, HardDrive, Cpu, ArrowRight, Download } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Services & Features — Everything MediaDL Can Do',
  description: 'Explore all MediaDL features: video download, audio extraction, image scraping, playlist & profile download, HLS streams, format conversion, and more.',
  alternates: { canonical: '/services' },
}

const SERVICES = [
  { icon: <Film size={24} />,      title: 'Video Download',       desc: 'Download videos from 1000+ sites in MP4, WebM, MKV, AVI, MOV. Up to 8K resolution with quality selection.', color: 'text-blue-400 bg-blue-900/20' },
  { icon: <Music size={24} />,     title: 'Audio Extraction',     desc: 'Extract audio as MP3 (320kbps), M4A, Opus, OGG, or FLAC from any video. Perfect for music and podcasts.', color: 'text-pink-400 bg-pink-900/20' },
  { icon: <ImageIcon size={24} />, title: 'Image Download',       desc: 'Download images in original quality or convert to JPG, PNG, WebP, AVIF, BMP. Single or bulk.', color: 'text-cyan-400 bg-cyan-900/20' },
  { icon: <Globe size={24} />,     title: 'Bulk Image Scraping',  desc: 'Scrape every image from any webpage — including paginated galleries. Preview and select before downloading.', color: 'text-emerald-400 bg-emerald-900/20' },
  { icon: <List size={24} />,      title: 'Playlist Download',    desc: 'Download entire YouTube playlists, SoundCloud sets, and channels. Set a limit or grab everything.', color: 'text-violet-400 bg-violet-900/20' },
  { icon: <Layers size={24} />,    title: 'Profile Download',     desc: 'Download all videos and photos from a social media profile — Instagram, TikTok, Twitter, and more.', color: 'text-amber-400 bg-amber-900/20' },
  { icon: <Zap size={24} />,       title: 'HLS / DASH Streams',   desc: 'Download live and on-demand HLS (m3u8) and DASH streams, including AES-128 encrypted streams via FFmpeg.', color: 'text-orange-400 bg-orange-900/20' },
  { icon: <Subtitles size={24} />, title: 'Subtitle Download',    desc: 'Download and embed subtitles in your videos. Multi-language support with automatic embedding.', color: 'text-teal-400 bg-teal-900/20' },
  { icon: <Shuffle size={24} />,   title: 'Format Conversion',    desc: 'Convert between 20+ formats on the fly. Server-side FFmpeg conversion for maximum compatibility.', color: 'text-rose-400 bg-rose-900/20' },
  { icon: <Cookie size={24} />,    title: 'Cookie Authentication',desc: 'Paste browser cookies to download members-only, age-restricted, or premium content you have access to.', color: 'text-yellow-400 bg-yellow-900/20' },
  { icon: <Cpu size={24} />,       title: 'Parallel Downloads',   desc: '16× concurrent fragment downloading and a 5-worker queue for blazing-fast bulk operations.', color: 'text-indigo-400 bg-indigo-900/20' },
  { icon: <HardDrive size={24} />, title: 'Storage Manager',      desc: 'Browse, re-download, and manage all your downloaded files directly from the web interface.', color: 'text-slate-400 bg-slate-900/20' },
]

export default function ServicesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-14">
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text)] mb-4">
          Everything You Need to <span className="gradient-text">Download Media</span>
        </h1>
        <p className="text-lg text-[var(--text-2)] max-w-2xl mx-auto">
          One powerful tool for every media download need — videos, audio, images, playlists, profiles, and streams.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
        {SERVICES.map((s, i) => (
          <div key={s.title}
            className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:-translate-y-1 transition-all animate-fade-up"
            style={{ animationDelay: `${i * 0.05}s` }}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${s.color}`}>{s.icon}</div>
            <h3 className="font-bold text-[var(--text)] mb-2">{s.title}</h3>
            <p className="text-sm text-[var(--text-2)] leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="text-center">
        <Link href="/download" className="inline-flex items-center gap-2 px-7 py-3.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-bold rounded-xl transition-colors">
          <Download size={17} /> Start Downloading <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  )
}
