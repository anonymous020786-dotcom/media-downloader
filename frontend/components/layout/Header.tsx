'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Download, ChevronDown, LogIn } from 'lucide-react'
import { UserButton, useUser } from '@clerk/nextjs'
import ThemeChanger from '@/components/widgets/ThemeChanger'
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'
import NotifBell from '@/components/widgets/NotifBell'

const NAV = [
  { label: 'Downloaders', href: '#', children: [
    { label: 'YouTube',    href: '/youtube-downloader'    },
    { label: 'Instagram',  href: '/instagram-downloader'  },
    { label: 'TikTok',     href: '/tiktok-downloader'     },
    { label: 'Twitter/X',  href: '/twitter-downloader'    },
    { label: 'Facebook',   href: '/facebook-downloader'   },
    { label: 'Reddit',     href: '/reddit-downloader'     },
    { label: 'Twitch',     href: '/twitch-downloader'     },
    { label: 'Vimeo',      href: '/vimeo-downloader'      },
    { label: 'Pinterest',  href: '/pinterest-downloader'  },
    { label: 'SoundCloud', href: '/soundcloud-downloader' },
    { label: '1,000+ Supported Sites →', href: '/supported-sites' },
  ]},
  { label: 'Sites',     href: '/supported-sites' },
  { label: 'Movies',    href: '/movies'    },
  { label: 'News',      href: '/news'      },
  { label: 'People',    href: '/people'    },
  { label: 'Features',  href: '/services'  },
  { label: 'Pricing',   href: '/pricing'   },
  { label: 'History',   href: '/history'   },
  { label: 'Blog',      href: '/blog'      },
  { label: 'Support',   href: '/contact'   },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdown,   setDropdown]   = useState(false)
  const { isSignedIn, isLoaded } = useUser()

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-xl transition-colors">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/logo.svg" alt="MediaDL" width={32} height={32} className="rounded-xl" />
          <span className="font-black text-[var(--text)] text-lg tracking-tight">
            Media<span className="gradient-text">DL</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV.map((item) =>
            item.children ? (
              <div key={item.label} className="relative"
                onMouseEnter={() => setDropdown(true)}
                onMouseLeave={() => setDropdown(false)}
              >
                <button className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
                  {item.label}<ChevronDown size={13} />
                </button>
                {dropdown && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl py-1.5 z-50">
                    {item.children.map((c) => (
                      <Link key={c.href} href={c.href}
                        className="block px-4 py-2 text-sm text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link key={item.label} href={item.href}
                className="px-3 py-2 rounded-xl text-sm text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
                {item.label}
              </Link>
            )
          )}
        </nav>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <NotifBell />
          <ThemeChanger />

          {isLoaded && !isSignedIn && (
            <Link href="/sign-in"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
              <LogIn size={14} /> Sign in
            </Link>
          )}

          <Link href="/download"
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/30">
            <Download size={14} /> Download Free
          </Link>

          {isLoaded && isSignedIn && (
            <UserButton appearance={{ elements: { avatarBox: 'w-8 h-8' } }} />
          )}

          <button onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-xl border border-[var(--border)] text-[var(--text-2)]">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-4 space-y-1">
          {NAV.map((item) =>
            item.children ? (
              <div key={item.label}>
                <p className="text-xs font-bold text-[var(--text-3)] uppercase tracking-widest px-3 py-2">{item.label}</p>
                {item.children.map((c) => (
                  <Link key={c.href} href={c.href} onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 text-sm text-[var(--text-2)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--bg-hover)]">
                    {c.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm text-[var(--text-2)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--bg-hover)]">
                {item.label}
              </Link>
            )
          )}
          <Link href="/download" onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center gap-2 mt-3 py-3 bg-[var(--brand)] text-white font-bold rounded-xl text-sm">
            <Download size={14} /> Start Downloading Free
          </Link>
          {isLoaded && !isSignedIn && (
            <Link href="/sign-in" onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 mt-2 py-3 border border-[var(--border)] text-[var(--text-2)] font-semibold rounded-xl text-sm">
              <LogIn size={14} /> Sign in
            </Link>
          )}
        </div>
      )}
    </header>
  )
}
