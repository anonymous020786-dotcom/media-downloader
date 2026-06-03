import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, Check, ArrowRight, Star, Zap, Shield, Globe, Film, ImageIcon, Music, List, Smartphone } from 'lucide-react'
import HeroInput from '@/components/landing/HeroInput'
import HeroHeadline from '@/components/landing/HeroHeadline'
import DeviceSupport from '@/components/landing/DeviceSupport'

export const metadata: Metadata = {
  title: 'MediaDL — Download Any Video or Image from Any Website Free',
  description: 'Free online video & image downloader. YouTube, Instagram, TikTok, Twitter, Facebook + 1000 more sites. HD/4K/8K, MP4, MP3, bulk download, playlists. No install required.',
}

const STATS = [
  { value: '1,000+', label: 'Websites Supported' },
  { value: '50M+',   label: 'Downloads Served' },
  { value: '20+',    label: 'Output Formats' },
  { value: '99.9%',  label: 'Uptime' },
]

const STEPS = [
  { n: '01', icon: '📋', title: 'Copy the URL', desc: 'Copy the video or image URL from any website — YouTube, Instagram, TikTok, Twitter, or anywhere else.' },
  { n: '02', icon: '📥', title: 'Paste & Analyze', desc: 'Paste the URL into the box above. MediaDL instantly detects the media type, quality options, and formats.' },
  { n: '03', icon: '🎯', title: 'Select Format & Quality', desc: 'Choose your preferred format (MP4, MP3, WebM…) and quality (Best, 4K, 1080p, 720p). Preview before downloading.' },
  { n: '04', icon: '⬇️', title: 'Download Instantly', desc: 'Click Download. Your file is processed server-side and saved directly to your downloads folder.' },
]

const FEATURES = [
  { icon: <Film size={20} />, title: 'HD/4K/8K Downloads', desc: 'Download videos in any available resolution — from 360p up to 8K. Best quality automatically selected.', color: 'text-blue-400 bg-blue-900/20' },
  { icon: <Zap size={20} />, title: '10× Faster Downloads', desc: 'Parallel fragment downloading (16 simultaneous connections) delivers speeds up to 10× faster than standard tools.', color: 'text-amber-400 bg-amber-900/20' },
  { icon: <List size={20} />, title: 'Playlist & Profiles', desc: 'Download entire YouTube playlists, channel archives, and social media profiles in one click — unlimited items.', color: 'text-violet-400 bg-violet-900/20' },
  { icon: <Globe size={20} />, title: '1,000+ Sites', desc: 'Powered by yt-dlp with support for YouTube, Instagram, TikTok, Twitter, Facebook, Reddit, Vimeo, Twitch and 994 more.', color: 'text-emerald-400 bg-emerald-900/20' },
  { icon: <ImageIcon size={20} />, title: 'Bulk Image Scraping', desc: 'Paste any webpage URL and scrape all images at once. Preview them first, select which ones you want, then download.', color: 'text-cyan-400 bg-cyan-900/20' },
  { icon: <Music size={20} />, title: 'MP4, MP3 + 20 Formats', desc: 'Convert to MP4, WebM, MKV, AVI, MOV, MP3, M4A, Opus, and more. HLS/DASH/AES-128 encrypted streams supported.', color: 'text-pink-400 bg-pink-900/20' },
  { icon: <Shield size={20} />, title: 'No Ads. No Limits.', desc: 'No watermarks, no registration, no download limits, no tracking. Pure fast downloads with zero interruptions.', color: 'text-red-400 bg-red-900/20' },
  { icon: <Smartphone size={20} />, title: 'Works Everywhere', desc: 'Fully browser-based. No software or extension to install. Works on iPhone, Android, Mac, Windows, Linux.', color: 'text-slate-400 bg-slate-900/20' },
]

const PLATFORMS = [
  { name:'YouTube',    emoji:'▶',  href:'/youtube-downloader',    color:'bg-red-600/80'          },
  { name:'Instagram',  emoji:'📷', href:'/instagram-downloader',  color:'bg-gradient-to-br from-pink-500/80 to-violet-600/80' },
  { name:'TikTok',     emoji:'♪',  href:'/tiktok-downloader',     color:'bg-gray-800/80'          },
  { name:'Twitter/X',  emoji:'𝕏',  href:'/twitter-downloader',    color:'bg-black/80'             },
  { name:'Facebook',   emoji:'f',  href:'/facebook-downloader',   color:'bg-blue-700/80'          },
  { name:'Reddit',     emoji:'👾', href:'/reddit-downloader',     color:'bg-orange-600/80'        },
  { name:'Vimeo',      emoji:'🎬', href:'/vimeo-downloader',      color:'bg-teal-600/80'          },
  { name:'Twitch',     emoji:'🎮', href:'/twitch-downloader',     color:'bg-purple-700/80'        },
  { name:'Pinterest',  emoji:'📌', href:'/pinterest-downloader',  color:'bg-red-700/80'           },
  { name:'SoundCloud', emoji:'☁', href:'/soundcloud-downloader', color:'bg-orange-500/80'        },
  { name:'Dailymotion',emoji:'▶',  href:'/dailymotion-downloader',color:'bg-blue-600/80'          },
  { name:'Tumblr',     emoji:'t',  href:'/tumblr-downloader',     color:'bg-indigo-700/80'        },
  { name:'Flickr',     emoji:'🌸', href:'/flickr-downloader',     color:'bg-pink-600/80'          },
  { name:'Imgur',      emoji:'🖼', href:'/imgur-downloader',      color:'bg-green-700/80'         },
  { name:'Bilibili',   emoji:'📺', href:'/bilibili-downloader',   color:'bg-cyan-700/80'          },
  { name:'1000+ Sites',emoji:'🌐', href:'/download',              color:'bg-[var(--bg-hover)]'    },
]

const TESTIMONIALS = [
  { name:'Alex M.', role:'Content Creator', stars:5, text:'MediaDL is the only downloader that consistently works for all platforms I use. The playlist download feature saved me hours.' },
  { name:'Sarah K.', role:'Social Media Manager', stars:5, text:'I use MediaDL daily to archive content. The bulk download and preview features are game-changers. Nothing else comes close.' },
  { name:'James R.', role:'Video Editor', stars:5, text:'Downloaded a 4K playlist of 200 videos overnight without a single failure. The quality selection and conversion work perfectly.' },
  { name:'Priya S.', role:'Researcher', stars:5, text:'Fetched 1,400 images from a gallery site in minutes. The preview grid before downloading is brilliant — never downloaded anything I didn\'t want.' },
  { name:'Tom H.', role:'Podcaster', stars:5, text:'I use MediaDL to download audio from YouTube interviews. MP3 extraction at 320kbps is flawless. Essential tool.' },
  { name:'Elena V.', role:'Photographer', stars:5, text:'Migrated my entire Instagram archive using MediaDL. Downloaded 3 years of posts in one session. Absolutely essential.' },
]

export default function LandingPage() {
  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Background blobs */}
        <div className="hero-blob w-96 h-96 bg-indigo-600/20 -top-32 -left-32" style={{ animationDelay:'0s' }} />
        <div className="hero-blob w-80 h-80 bg-violet-600/20 top-0 right-0" style={{ animationDelay:'2s' }} />
        <div className="hero-blob w-64 h-64 bg-cyan-600/10 bottom-0 left-1/2" style={{ animationDelay:'4s' }} />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-2)] mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
            Free • 1,000+ Sites • No Registration Required
          </div>

          <HeroHeadline />

          {/* Hero URL input */}
          <div className="animate-fade-up stagger-3">
            <HeroInput />
          </div>

          {/* Stats row */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 animate-fade-up stagger-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-black gradient-text">{s.value}</p>
                <p className="text-xs text-[var(--text-3)] mt-1 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SUPPORTED PLATFORMS ───────────────────────────────────────────── */}
      <section className="py-16 border-y border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-xs text-[var(--text-3)] uppercase tracking-widest font-bold mb-8">
            Download from 1,000+ websites
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {PLATFORMS.map((p) => (
              <Link key={p.name} href={p.href}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl ${p.color} opacity-70 hover:opacity-100 hover:scale-105 transition-all duration-200`}>
                <span className="text-2xl">{p.emoji}</span>
                <span className="text-[10px] text-white font-bold text-center leading-tight">{p.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 max-w-7xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-3">How to Download?</h2>
          <p className="text-[var(--text-2)] max-w-xl mx-auto">Download any video or image in 4 simple steps — no sign-up required.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.n}
              className="relative p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-focus)] transition-all group">
              <div className="text-4xl mb-4">{s.icon}</div>
              <span className="text-xs font-bold text-[var(--brand)] uppercase tracking-widest">Step {s.n}</span>
              <h3 className="text-base font-bold text-[var(--text)] mt-1 mb-2">{s.title}</h3>
              <p className="text-sm text-[var(--text-2)] leading-relaxed">{s.desc}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight size={16} className="absolute -right-3 top-8 text-[var(--text-3)] hidden lg:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-3">Why Choose MediaDL?</h2>
            <p className="text-[var(--text-2)] max-w-xl mx-auto">Everything you need to download media from the web — fast, free, and without limits.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <div key={f.title}
                className={`p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:-translate-y-1 transition-all animate-fade-up`}
                style={{ animationDelay: `${i * 0.08}s` }}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-[var(--text)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-2)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* 6 bullet points — direct xmate.best parity */}
          <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-indigo-900/30 to-violet-900/20 border border-indigo-800/30">
            <h3 className="text-xl font-black text-[var(--text)] mb-6 text-center">Download Unlimited — Everything Included</h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                'HD / 4K / 8K video downloads',
                'MP4, MP3 and 20+ formats',
                '10× faster parallel downloads',
                '1,000+ supported websites',
                'Unlimited batch downloads',
                'No ads, no watermarks, no limits',
              ].map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-emerald-400" />
                  </div>
                  <span className="text-sm text-[var(--text-2)]">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── DEVICE SUPPORT ───────────────────────────────────────────────── */}
      <DeviceSupport />

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="py-20 max-w-7xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-3">Loved by Creators Worldwide</h2>
          <p className="text-[var(--text-2)]">Join millions who download smarter with MediaDL.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <div key={t.name}
              className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all animate-fade-up"
              style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} size={13} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-[var(--text-2)] leading-relaxed mb-4">"{t.text}"</p>
              <div>
                <p className="text-sm font-bold text-[var(--text)]">{t.name}</p>
                <p className="text-xs text-[var(--text-3)]">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[var(--bg-surface)] border-t border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-4">
            Start Downloading <span className="gradient-text">Right Now</span>
          </h2>
          <p className="text-[var(--text-2)] mb-8 leading-relaxed">
            No registration. No limits. No ads. Just paste a URL and download instantly.
          </p>
          <Link href="/download"
            className="inline-flex items-center gap-3 px-8 py-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-bold text-lg rounded-2xl transition-all shadow-2xl shadow-indigo-900/40 pulse-ring">
            <Download size={20} />
            Download Any Video Free
            <ArrowRight size={18} />
          </Link>
          <p className="mt-4 text-xs text-[var(--text-3)]">
            Supports YouTube · Instagram · TikTok · Twitter · Facebook · 1000+ more
          </p>
        </div>
      </section>
    </>
  )
}
