import Link from 'next/link'
import Image from 'next/image'
import { BUILD_INFO } from '@/lib/buildInfo'

const YEAR = new Date().getFullYear()

const LINKS = {
  Product: [
    { label: 'Download Tool',        href: '/download'              },
    { label: 'Video Player',         href: '/player'                },
    { label: 'YouTube Downloader',   href: '/youtube-downloader'    },
    { label: 'Instagram Downloader', href: '/instagram-downloader'  },
    { label: 'TikTok Downloader',    href: '/tiktok-downloader'     },
    { label: 'All 14,000+ Sites',    href: '/supported-sites'       },
  ],
  Company: [
    { label: 'About',    href: '/about'   },
    { label: 'Services', href: '/services'},
    { label: 'Pricing',  href: '/pricing' },
    { label: 'Blog',     href: '/blog'    },
    { label: 'Contact',  href: '/contact' },
  ],
  Support: [
    { label: 'FAQ',            href: '/faq'             },
    { label: 'Supported Sites',href: '/supported-sites' },
    { label: 'How It Works',   href: '/#how-it-works'   },
    { label: 'Report Issue',   href: '/contact'         },
    { label: 'Sitemap',        href: '/sitemap-page'    },
  ],
  Legal: [
    { label: 'Privacy Policy',   href: '/privacy-policy'   },
    { label: 'Terms of Service', href: '/terms-of-service' },
    { label: 'Cookie Policy',    href: '/cookie-policy'    },
    { label: 'DMCA',             href: '/dmca'             },
    { label: 'GDPR',             href: '/gdpr'             },
    { label: 'Accessibility',    href: '/accessibility'    },
  ],
  'Related Tools': [
    { label: 'YouTube to MP3',      href: '/youtube-downloader'    },
    { label: 'Instagram Saver',     href: '/instagram-downloader'  },
    { label: 'TikTok No Watermark', href: '/tiktok-downloader'     },
    { label: 'Twitter Video DL',    href: '/twitter-downloader'    },
    { label: 'SoundCloud to MP3',   href: '/soundcloud-downloader' },
    { label: 'Format Converter',    href: '/tools/convert'         },
  ],
}

const SOCIAL = [
  { name: 'Twitter/X', href: 'https://twitter.com/mediadl', svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.733-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  { name: 'GitHub',    href: 'https://github.com/mediadl',  svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg> },
  { name: 'Discord',   href: 'https://discord.gg/mediadl',  svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028z"/></svg> },
  { name: 'YouTube',   href: 'https://youtube.com/@mediadl', svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    })
  } catch {
    return iso
  }
}

const ENV_BADGE: Record<string, string> = {
  production:  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  development: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  test:        'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

export default function Footer() {
  const bi = BUILD_INFO
  const commitShort = bi.commitHash.length > 7 ? bi.commitHash.slice(0, 7) : bi.commitHash

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-surface)] mt-20">
      <div className="max-w-7xl mx-auto px-4 py-16">

        {/* Top row */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-8 mb-12">

          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <Image src="/logo.svg" alt="MediaDL" width={32} height={32} className="rounded-xl" />
              <span className="font-black text-[var(--text)] text-lg">Media<span className="gradient-text">DL</span></span>
            </Link>
            <p className="text-sm text-[var(--text-2)] leading-relaxed mb-3 max-w-xs">
              Download any video or image from any website. 14,000+ sites, unlimited downloads, HD/4K/8K quality.
            </p>
            <p className="text-xs text-[var(--text-3)] mb-1">
              Built by <span className="text-[var(--text-2)] font-semibold">Naushad Alam</span> · India 🇮🇳
            </p>
            <a href="mailto:contact@zestcommerce.in"
              className="text-xs text-[var(--brand)] hover:text-[var(--accent)] transition-colors mb-5 block">
              contact@zestcommerce.in
            </a>
            <div className="flex items-center gap-2">
              {SOCIAL.map((s) => (
                <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.name}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] transition-all">
                  {s.svg}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([col, items]) => (
            <div key={col}>
              <h3 className="text-xs font-bold text-[var(--text-3)] uppercase tracking-widest mb-4">{col}</h3>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href}
                      className="text-sm text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Build version strip ────────────────────────────────────────────── */}
        <div className="border border-[var(--border)] rounded-2xl bg-[var(--bg-card)] px-4 py-4 mb-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">

            {/* Title */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              <span className="text-xs font-bold text-[var(--text)] uppercase tracking-widest">Build Info</span>
            </div>

            {/* Version */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">Version</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-[var(--brand)]/15 text-[var(--brand)] border border-[var(--brand)]/25">
                v{bi.version}
              </span>
            </div>

            {/* Environment */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">Env</span>
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md border ${ENV_BADGE[bi.env] ?? ENV_BADGE.development}`}>
                {bi.env}
              </span>
            </div>

            {/* Commit */}
            {commitShort !== 'local' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">Commit</span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text-2)]">
                  {commitShort}
                </span>
              </div>
            )}

            {/* Next.js */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">Next.js</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text-2)]">
                {bi.nextVersion || '16'}
              </span>
            </div>

            {/* Node */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">Node</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text-2)]">
                {bi.nodeVersion}
              </span>
            </div>

            {/* Build time */}
            {bi.buildTime && (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">Built</span>
                <time
                  dateTime={bi.buildTime}
                  className="text-[10px] font-mono text-[var(--text-2)]"
                  title={bi.buildTime}
                >
                  {buildDate(bi.buildTime)}
                </time>
              </div>
            )}
          </div>

          {/* Stack badges row */}
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap gap-1.5">
            {[
              'Next.js 16', 'TypeScript', 'Tailwind CSS', 'Express.js',
              'FastAPI', 'Python', 'yt-dlp', 'gallery-dl', 'FFmpeg',
              'MySQL 8', 'Redis 7', 'BullMQ', 'Kafka', 'Docker', 'Nginx', 'Clerk',
            ].map(t => (
              <span key={t}
                className="px-2 py-0.5 text-[9px] font-semibold rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text-3)] hover:border-[var(--border-hover)] hover:text-[var(--text-2)] transition-colors">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[var(--border)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-3)]">
          <p>© {YEAR} MediaDL. Built by <span className="text-[var(--text-2)]">Naushad Alam</span>, India 🇮🇳 · All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy"   className="hover:text-[var(--text-2)] transition-colors">Privacy</Link>
            <Link href="/terms-of-service" className="hover:text-[var(--text-2)] transition-colors">Terms</Link>
            <Link href="/dmca"             className="hover:text-[var(--text-2)] transition-colors">DMCA</Link>
            <Link href="/sitemap-page"     className="hover:text-[var(--text-2)] transition-colors">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
