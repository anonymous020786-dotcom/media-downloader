import type { Metadata } from 'next'
import Link from 'next/link'
import { Target, Zap, Shield, Globe, Heart, Users, Download, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About MediaDL — Our Mission',
  description: 'Learn about MediaDL, the free media downloader supporting 1000+ websites. Our mission, values, and the technology behind the fastest downloader on the web.',
  alternates: { canonical: '/about' },
}

const VALUES = [
  { icon: <Zap size={22} />,    title: 'Speed First',     desc: 'Parallel downloading and optimized infrastructure deliver the fastest downloads possible.' },
  { icon: <Shield size={22} />, title: 'Privacy Focused', desc: 'We do not store your URLs, files, or personal data. Downloads are processed and deleted.' },
  { icon: <Globe size={22} />,  title: 'Universal Access',desc: 'Works on any device, any browser, supporting over 1000 websites worldwide — for free.' },
  { icon: <Heart size={22} />,  title: 'Built for Users', desc: 'No ads interrupting your experience, no forced sign-ups, no artificial limits.' },
]

const STATS = [
  { value: '1,000+', label: 'Sites Supported' },
  { value: '50M+',   label: 'Downloads' },
  { value: '190+',   label: 'Countries' },
  { value: '24/7',   label: 'Availability' },
]

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-2)] mb-5">
          <Target size={12} className="text-[var(--brand)]" /> Our Story
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text)] mb-5">
          Making the web's media <span className="gradient-text">accessible to everyone</span>
        </h1>
        <p className="text-lg text-[var(--text-2)] max-w-2xl mx-auto leading-relaxed">
          MediaDL was built on a simple belief: if you can view it, you should be able to save it.
          We created the fastest, simplest, most universal media downloader — completely free.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
        {STATS.map((s) => (
          <div key={s.label} className="text-center p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
            <p className="text-3xl font-black gradient-text">{s.value}</p>
            <p className="text-xs text-[var(--text-3)] mt-1 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Mission */}
      <div className="grid md:grid-cols-2 gap-10 items-center mb-20">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-[var(--text)] mb-4">Our Mission</h2>
          <p className="text-[var(--text-2)] leading-relaxed mb-4">
            Content creators, researchers, educators, and everyday users all need to save media for legitimate purposes —
            archiving their own work, offline viewing, education, and creative projects.
          </p>
          <p className="text-[var(--text-2)] leading-relaxed">
            MediaDL provides a powerful, ethical tool that respects both users and creators. We support responsible
            downloading and encourage everyone to respect copyright and platform terms.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {VALUES.map((v) => (
            <div key={v.title} className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/15 text-[var(--brand)] flex items-center justify-center mb-3">{v.icon}</div>
              <h3 className="font-bold text-[var(--text)] text-sm mb-1.5">{v.title}</h3>
              <p className="text-xs text-[var(--text-2)] leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tech */}
      <div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-900/30 to-violet-900/20 border border-indigo-800/30 mb-16">
        <h2 className="text-2xl font-black text-[var(--text)] mb-4 text-center">Powered by Best-in-Class Technology</h2>
        <p className="text-[var(--text-2)] text-center max-w-2xl mx-auto leading-relaxed mb-6">
          MediaDL is built on yt-dlp (1000+ site extractors), FFmpeg (HLS/DASH/encrypted streams), a scalable
          Node.js + BullMQ queue, a FastAPI processing service, and a Next.js frontend — all containerized for reliability.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {['Next.js 16','React 19','Express 5','FastAPI','yt-dlp','FFmpeg','BullMQ','Redis','MySQL','Docker'].map((t) => (
            <span key={t} className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm font-semibold text-[var(--text-2)]">{t}</span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link href="/download" className="inline-flex items-center gap-2 px-7 py-3.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-bold rounded-xl transition-colors">
          <Download size={17} /> Try MediaDL Free <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  )
}
