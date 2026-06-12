import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Home, Download, Info, Settings, Tag, BookOpen, HelpCircle,
  Mail, DollarSign, Newspaper, Users, Clock, Calendar, Globe,
  Wand2, Camera, Film, Shield, FileText, Lock, AlertCircle,
  Briefcase, UserCheck, Server, BarChart2, MessageSquare,
  ChevronRight, Hash, Zap, Star, Play, Music, ImageIcon,
} from 'lucide-react'
import { getAllPlatformSlugs } from '@/lib/platforms'
import { LEGAL_SLUGS } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Sitemap — All Pages on MediaDL',
  description: 'Browse every page on MediaDL: download tools, platform guides, legal docs, blog articles, and more.',
  alternates: { canonical: '/sitemap-page' },
}

// ── Section definitions ───────────────────────────────────────────────────────
interface SitemapLink { label: string; href: string; badge?: string }

interface SitemapSection {
  id:       string
  title:    string
  icon:     React.ReactNode
  color:    string
  bgColor:  string
  links:    SitemapLink[]
}

const SECTIONS: SitemapSection[] = [
  {
    id: 'main', title: 'Main Pages', icon: <Home size={16} />,
    color: 'text-indigo-400', bgColor: 'bg-indigo-500/10 border-indigo-500/20',
    links: [
      { label: 'Home',            href: '/',               badge: 'Popular' },
      { label: 'Download Tool',   href: '/download',       badge: 'Core'    },
      { label: 'About Us',        href: '/about'           },
      { label: 'Services',        href: '/services'        },
      { label: 'Pricing',         href: '/pricing'         },
      { label: 'Blog',            href: '/blog'            },
      { label: 'FAQ',             href: '/faq'             },
      { label: 'Contact',         href: '/contact'         },
      { label: 'Supported Sites', href: '/supported-sites' },
    ],
  },
  {
    id: 'tools', title: 'Tools', icon: <Wand2 size={16} />,
    color: 'text-violet-400', bgColor: 'bg-violet-500/10 border-violet-500/20',
    links: [
      { label: 'Download Tool',    href: '/download',       badge: 'Free' },
      { label: 'Format Converter', href: '/tools/convert'               },
      { label: 'Screen Capture',   href: '/screen-capture'              },
      { label: 'Download History', href: '/history'                     },
      { label: 'Schedules',        href: '/schedules'                   },
    ],
  },
  {
    id: 'explore', title: 'Explore', icon: <Film size={16} />,
    color: 'text-cyan-400', bgColor: 'bg-cyan-500/10 border-cyan-500/20',
    links: [
      { label: 'Movies & TV',       href: '/movies'           },
      { label: 'Browse Explorer',   href: '/movies/explorer'  },
      { label: 'Movie Reference',   href: '/movies/reference' },
      { label: 'People / Cast',     href: '/movies/people'    },
      { label: 'News Feed',         href: '/news'             },
      { label: 'Social People',     href: '/people'           },
    ],
  },
  {
    id: 'account', title: 'Account', icon: <UserCheck size={16} />,
    color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    links: [
      { label: 'Sign In',      href: '/sign-in'  },
      { label: 'Sign Up',      href: '/sign-up'  },
      { label: 'My History',   href: '/history'  },
      { label: 'My Schedules', href: '/schedules'},
      { label: 'Watchlist',    href: '/movies/account' },
    ],
  },
  {
    id: 'admin', title: 'Admin', icon: <Server size={16} />,
    color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20',
    links: [
      { label: 'Dashboard',   href: '/admin',            badge: 'Auth' },
      { label: 'Analytics',   href: '/admin/analytics',  badge: 'Auth' },
      { label: 'Downloads',   href: '/admin/downloads',  badge: 'Auth' },
      { label: 'Messages',    href: '/admin/messages',   badge: 'Auth' },
      { label: 'Blog Mgmt',   href: '/admin/blog',       badge: 'Auth' },
      { label: 'Users',       href: '/admin/users',      badge: 'Admin' },
      { label: 'Settings',    href: '/admin/settings',   badge: 'Admin' },
    ],
  },
  {
    id: 'legal', title: 'Legal & Compliance', icon: <Shield size={16} />,
    color: 'text-slate-400', bgColor: 'bg-slate-500/10 border-slate-500/20',
    links: LEGAL_SLUGS.map((s) => ({
      label: s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
      href:  `/${s}`,
    })),
  },
]

// Badge colours
const BADGE_COLORS: Record<string, string> = {
  Popular: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  Core:    'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Free:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Auth:    'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Admin:   'bg-red-500/20 text-red-300 border-red-500/30',
}

// Platform icon heuristic
function platformIcon(slug: string) {
  if (slug.includes('music') || slug.includes('sound') || slug.includes('spotify') || slug.includes('apple-music')) return <Music size={11} />
  if (slug.includes('photo') || slug.includes('image') || slug.includes('pinterest') || slug.includes('flickr')) return <ImageIcon size={11} />
  if (slug.includes('twitch') || slug.includes('live')) return <Zap size={11} />
  if (slug.includes('youtube') || slug.includes('vimeo') || slug.includes('dailymotion')) return <Play size={11} />
  return <Globe size={11} />
}

export default function SitemapPage() {
  const platforms = getAllPlatformSlugs().map((s) => ({
    label: s.replace('-downloader', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + ' Downloader',
    href:  `/${s}`,
    slug:  s,
  }))

  const stats = {
    totalPages:     Object.values(SECTIONS).reduce((n, s) => n + s.links.length, 0) + platforms.length,
    platforms:      platforms.length,
    legalPages:     LEGAL_SLUGS.length,
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative border-b border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
          <div className="hero-blob w-[400px] h-[400px] bg-indigo-600/10 -top-20 -left-20" />
          <div className="hero-blob w-[300px] h-[300px] bg-violet-600/10 top-10 right-10 [animation-delay:2s]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                <Globe size={10} /> Site Map
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[var(--text)] mb-4 leading-tight">
              Every page on <span className="gradient-text">MediaDL</span>
            </h1>
            <p className="text-[var(--text-2)] text-base sm:text-lg leading-relaxed mb-8">
              A complete index of all pages — tools, platforms, guides, and resources.
            </p>
            {/* Stats */}
            <div className="flex flex-wrap gap-4">
              {[
                { label: 'Total pages',      value: stats.totalPages,  color: 'text-indigo-400' },
                { label: 'Platform guides',  value: stats.platforms,   color: 'text-cyan-400'   },
                { label: 'Legal documents',  value: stats.legalPages,  color: 'text-slate-400'  },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                  <span className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</span>
                  <span className="text-xs text-[var(--text-3)] font-medium">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Main sections grid ─────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {SECTIONS.map((section) => (
            <div key={section.id}
              className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden hover:border-[var(--border-hover)] transition-colors">
              {/* Section header */}
              <div className={`flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] ${section.bgColor}`}>
                <span className={section.color}>{section.icon}</span>
                <h2 className={`text-sm font-bold ${section.color}`}>{section.title}</h2>
                <span className="ml-auto text-[10px] font-bold text-[var(--text-3)] bg-[var(--bg)]/40 px-2 py-0.5 rounded-full">
                  {section.links.length}
                </span>
              </div>
              {/* Links */}
              <ul className="divide-y divide-[var(--border)]">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}
                      className="flex items-center justify-between gap-2 px-5 py-3 text-sm text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors group">
                      <span className="flex items-center gap-2 min-w-0">
                        <ChevronRight size={12} className="shrink-0 text-[var(--text-ghost)] group-hover:text-[var(--brand)] transition-colors" />
                        <span className="truncate">{link.label}</span>
                      </span>
                      {link.badge && (
                        <span className={`badge text-[10px] border shrink-0 ${BADGE_COLORS[link.badge] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Platform downloaders ───────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Download size={16} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[var(--text)]">Platform Downloaders</h2>
              <p className="text-xs text-[var(--text-3)]">{platforms.length} dedicated platform guides</p>
            </div>
            <Link href="/supported-sites"
              className="ml-auto hidden sm:flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-light)] transition-colors">
              View all <ChevronRight size={11} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {platforms.map((p) => (
              <Link key={p.href} href={p.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] transition-all group">
                <span className="text-[var(--text-3)] group-hover:text-[var(--brand)] transition-colors shrink-0">
                  {platformIcon(p.slug)}
                </span>
                <span className="truncate font-medium">{p.label.replace(' Downloader', '')}</span>
              </Link>
            ))}
          </div>

          <div className="mt-6 text-center sm:hidden">
            <Link href="/supported-sites"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)]">
              View all {platforms.length} platforms <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── XML sitemap link ───────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-500/10 border border-slate-500/20 text-slate-400 shrink-0">
                <FileText size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">XML Sitemap for search engines</p>
                <p className="text-xs text-[var(--text-3)]">Automatically generated, updated hourly</p>
              </div>
            </div>
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer"
              className="sm:ml-auto flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
              <Globe size={13} /> sitemap.xml <ChevronRight size={12} />
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
