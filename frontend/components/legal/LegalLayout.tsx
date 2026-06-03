import Link from 'next/link'
import { Shield } from 'lucide-react'

export interface LegalSection { heading: string; body: string[] }

interface Props {
  title:     string
  updated:   string
  intro:     string
  sections:  LegalSection[]
}

const RELATED = [
  { label: 'Privacy Policy',   href: '/privacy-policy'   },
  { label: 'Terms of Service', href: '/terms-of-service' },
  { label: 'Cookie Policy',    href: '/cookie-policy'    },
  { label: 'DMCA',             href: '/dmca'             },
  { label: 'GDPR',             href: '/gdpr'             },
  { label: 'CCPA',             href: '/ccpa'             },
]

export default function LegalLayout({ title, updated, intro, sections }: Props) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-2)] mb-4">
          <Shield size={12} className="text-[var(--brand)]" /> Legal
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-2">{title}</h1>
        <p className="text-sm text-[var(--text-3)]">Last updated: {updated}</p>
      </div>

      {/* Intro */}
      <p className="text-[var(--text-2)] leading-relaxed mb-10 text-[15px]">{intro}</p>

      {/* Sections */}
      <div className="space-y-8">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-lg font-bold text-[var(--text)] mb-3">{i + 1}. {s.heading}</h2>
            {s.body.map((p, j) => (
              <p key={j} className="text-[var(--text-2)] leading-relaxed mb-3 text-[15px]">{p}</p>
            ))}
          </section>
        ))}
      </div>

      {/* Related */}
      <div className="mt-14 pt-8 border-t border-[var(--border)]">
        <h3 className="text-xs font-bold text-[var(--text-3)] uppercase tracking-widest mb-4">Related Policies</h3>
        <div className="flex flex-wrap gap-2">
          {RELATED.map((r) => (
            <Link key={r.href} href={r.href}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors">
              {r.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
