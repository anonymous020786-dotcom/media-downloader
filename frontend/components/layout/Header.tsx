'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Menu, X, Download, ChevronDown, LogIn,
  Play, Camera, MessageCircle, Users, Film,
  Music, Globe, Zap, List, User, ChevronRight,
} from 'lucide-react'
import { UserButton, useUser } from '@clerk/nextjs'
import ThemeChanger from '@/components/widgets/ThemeChanger'
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'
import NotifBell from '@/components/widgets/NotifBell'
import AccessibilityPanel from '@/components/widgets/AccessibilityPanel'
import CountrySwitcher from '@/components/widgets/CountrySwitcher'

// ── Nav data ──────────────────────────────────────────────────────────────────
const DOWNLOADERS = [
  { label: 'YouTube',     href: '/youtube-downloader',    icon: <Play           size={14} className="text-red-400"    />, desc: 'Videos, Shorts, Playlists' },
  { label: 'Instagram',   href: '/instagram-downloader',  icon: <Camera         size={14} className="text-pink-400"  />, desc: 'Reels, Stories, Photos' },
  { label: 'TikTok',      href: '/tiktok-downloader',     icon: <Film           size={14} className="text-cyan-400"  />, desc: 'No watermark' },
  { label: 'Twitter / X', href: '/twitter-downloader',    icon: <MessageCircle  size={14} className="text-sky-400"   />, desc: 'Videos & GIFs' },
  { label: 'Facebook',    href: '/facebook-downloader',   icon: <Users          size={14} className="text-blue-400"  />, desc: 'Public videos & reels' },
  { label: 'Reddit',      href: '/reddit-downloader',     icon: <Globe          size={14} className="text-orange-400"/>, desc: 'Videos & images' },
  { label: 'Twitch',      href: '/twitch-downloader',     icon: <Zap            size={14} className="text-violet-400"/>, desc: 'VODs & clips' },
  { label: 'Vimeo',       href: '/vimeo-downloader',      icon: <Film           size={14} className="text-cyan-400"  />, desc: 'HD videos' },
  { label: 'SoundCloud',  href: '/soundcloud-downloader', icon: <Music          size={14} className="text-amber-400" />, desc: 'Tracks & playlists' },
  { label: 'Pinterest',   href: '/pinterest-downloader',  icon: <List           size={14} className="text-red-400"   />, desc: 'Pins & boards' },
]

const NAV_ITEMS = [
  { label: 'Sites',      href: '/supported-sites' },
  { label: 'Movies',     href: '/movies'    },
  { label: 'News',       href: '/news'      },
  { label: 'People',     href: '/people'    },
  { label: 'Tools',      href: '/tools/convert' },
  { label: 'Pricing',    href: '/pricing'   },
  { label: 'Blog',       href: '/blog'      },
  { label: 'History',    href: '/history'   },
]

export default function Header() {
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const [megaOpen,     setMegaOpen]     = useState(false)
  const [scrolled,     setScrolled]     = useState(false)
  const [mobileDropOpen, setMobileDropOpen] = useState(false)
  const { isSignedIn, isLoaded } = useUser()
  const pathname = usePathname()
  const megaRef  = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Scroll shadow ────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Close mobile menu on route change ────────────────────────────────────
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // ── Lock body scroll when mobile menu open ────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const openMega  = useCallback(() => { if (closeTimer.current) clearTimeout(closeTimer.current); setMegaOpen(true) }, [])
  const closeMega = useCallback(() => { closeTimer.current = setTimeout(() => setMegaOpen(false), 120) }, [])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-200 ${
          scrolled
            ? 'bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--border)] shadow-[0_2px_20px_rgba(0,0,0,0.4)]'
            : 'bg-[var(--bg)]/80 backdrop-blur-md border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-2 lg:gap-4">

          {/* ── Logo ──────────────────────────────────────────────────────── */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group" aria-label="MediaDL home">
            <div className="relative">
              <Image src="/logo.svg" alt="" width={32} height={32}
                className="rounded-xl transition-transform group-hover:scale-105" priority />
            </div>
            <span className="font-black text-[var(--text)] text-lg tracking-tight hidden xs:block">
              Media<span className="gradient-text">DL</span>
            </span>
          </Link>

          {/* ── Desktop nav ────────────────────────────────────────────────── */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1" role="navigation" aria-label="Main navigation">

            {/* Downloaders mega-menu trigger */}
            <div ref={megaRef} className="relative"
              onMouseEnter={openMega} onMouseLeave={closeMega}>
              <button
                type="button"
                onClick={() => setMegaOpen(v => !v)}
                aria-expanded={megaOpen ? 'true' : 'false'}
                aria-haspopup="true"
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  megaOpen
                    ? 'text-[var(--text)] bg-[var(--bg-hover)]'
                    : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                Downloaders
                <ChevronDown size={13} className={`transition-transform duration-150 ${megaOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Mega-menu */}
              {megaOpen && (
                <div
                  onMouseEnter={openMega} onMouseLeave={closeMega}
                  className="absolute top-full left-0 mt-2 w-[520px] bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.5)] py-3 z-50 animate-slide-down"
                >
                  <div className="px-4 pb-2 border-b border-[var(--border)]">
                    <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest">Popular platforms</p>
                  </div>
                  <div className="grid grid-cols-2 gap-px p-2">
                    {DOWNLOADERS.map((d) => (
                      <Link key={d.href} href={d.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition-colors group"
                      >
                        <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg)] border border-[var(--border)] shrink-0 group-hover:border-[var(--border-hover)]">{d.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text)] leading-tight">{d.label}</p>
                          <p className="text-[11px] text-[var(--text-3)] truncate">{d.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="px-4 pt-2 border-t border-[var(--border)]">
                    <Link href="/supported-sites"
                      className="flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-light)] transition-colors">
                      View all 1,000+ supported sites <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Regular nav items */}
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'text-[var(--text)] bg-[var(--bg-hover)]'
                    : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* ── Right actions ──────────────────────────────────────────────── */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Widgets — hidden on small screens */}
            <span className="hidden xl:flex items-center gap-1">
              <LanguageSwitcher />
              <CountrySwitcher />
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <AccessibilityPanel />
              <NotifBell />
              <ThemeChanger />
            </span>
            <span className="sm:hidden flex items-center gap-1">
              <ThemeChanger />
            </span>

            {/* Sign in */}
            {isLoaded && !isSignedIn && (
              <Link href="/sign-in"
                className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--bg-hover)] transition-colors">
                <LogIn size={14} />
                <span className="hidden lg:inline">Sign in</span>
              </Link>
            )}

            {/* CTA */}
            <Link href="/download"
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-bold rounded-xl transition-all shadow-[var(--shadow-brand)] hover:shadow-[0_6px_28px_rgba(99,102,241,0.4)] hover:-translate-y-px active:translate-y-0">
              <Download size={14} />
              <span className="hidden md:inline">Download Free</span>
              <span className="md:hidden">Download</span>
            </Link>

            {/* User avatar */}
            {isLoaded && isSignedIn && (
              <UserButton appearance={{ elements: { avatarBox: 'w-8 h-8' } }} />
            )}

            {/* Hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(v => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen ? 'true' : 'false'}
              aria-controls="mobile-nav"
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              {mobileOpen
                ? <X size={18} aria-hidden="true" />
                : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile menu overlay ──────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="lg:hidden fixed inset-0 top-16 z-40 flex flex-col bg-[var(--bg-surface)] border-t border-[var(--border)] animate-fade-in overflow-y-auto"
        >
          <div className="flex-1 px-4 py-4 space-y-1">

            {/* Downloaders section */}
            <button
              type="button"
              onClick={() => setMobileDropOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span className="flex items-center gap-2"><Download size={15} /> Downloaders</span>
              <ChevronDown size={14} className={`transition-transform ${mobileDropOpen ? 'rotate-180' : ''}`} />
            </button>

            {mobileDropOpen && (
              <div className="ml-4 space-y-0.5 pb-1 animate-slide-down">
                {DOWNLOADERS.map((d) => (
                  <Link key={d.href} href={d.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
                    {d.icon}
                    <div>
                      <p className="font-medium leading-tight">{d.label}</p>
                      <p className="text-[11px] text-[var(--text-3)]">{d.desc}</p>
                    </div>
                  </Link>
                ))}
                <Link href="/supported-sites"
                  className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[var(--brand)]">
                  All 1,000+ sites <ChevronRight size={11} />
                </Link>
              </div>
            )}

            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}
                className={`flex items-center px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'text-[var(--text)] bg-[var(--bg-hover)]'
                    : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
                }`}>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Bottom actions */}
          <div className="px-4 pb-6 pt-2 space-y-2 border-t border-[var(--border)] safe-bottom">
            <div className="flex items-center gap-2 pb-2">
              <LanguageSwitcher />
              <CountrySwitcher />
              <AccessibilityPanel />
              <NotifBell />
            </div>
            <Link href="/download"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-bold rounded-xl text-sm shadow-[var(--shadow-brand)] transition-colors">
              <Download size={15} /> Start Downloading Free
            </Link>
            {isLoaded && !isSignedIn && (
              <Link href="/sign-in"
                className="flex items-center justify-center gap-2 w-full py-3 border border-[var(--border)] text-[var(--text-2)] font-semibold rounded-xl text-sm hover:bg-[var(--bg-hover)] transition-colors">
                <LogIn size={14} /> Sign in
              </Link>
            )}
            {isLoaded && isSignedIn && (
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--bg-card)]">
                <UserButton appearance={{ elements: { avatarBox: 'w-8 h-8' } }} />
                <span className="text-sm text-[var(--text-2)]">My account</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile overlay backdrop ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 top-16 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
