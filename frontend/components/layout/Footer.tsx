import Link from 'next/link'
import Image from 'next/image'
import { BUILD_INFO } from '@/lib/buildInfo'

const YEAR = new Date().getFullYear()

const LINKS = {
  Product: [
    { label: 'Download Tool',        href: '/download'              },
    { label: 'Format Converter',     href: '/tools/convert'         },
    { label: 'YouTube Downloader',   href: '/youtube-downloader'    },
    { label: 'Instagram Downloader', href: '/instagram-downloader'  },
    { label: 'TikTok Downloader',    href: '/tiktok-downloader'     },
    { label: 'All 14,000+ Sites',    href: '/supported-sites'       },
  ],
  Company: [
    { label: 'About',    href: '/about'   },
    { label: 'Services', href: '/services'},
    { label: 'Contact',  href: '/contact' },
  ],
  Support: [
    { label: 'FAQ',            href: '/faq'             },
    { label: 'Supported Sites',href: '/supported-sites' },
    { label: 'How It Works',   href: '/#how-it-works'   },
    { label: 'System Status',  href: '/status'          },
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
            <p className="text-sm text-[var(--text-2)] leading-relaxed max-w-xs">
              Download any video or image from any website. 14,000+ sites, unlimited downloads, HD/4K/8K quality.
            </p>
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
              'FastAPI', 'Python', 'yt-dlp', 'gallery-dl', 'streamlink',
              'FFmpeg', 'aria2', 'Playwright', 'Socket.IO',
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
          <p>© {YEAR} MediaDL · All rights reserved.</p>
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
