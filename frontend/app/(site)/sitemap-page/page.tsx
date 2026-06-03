import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPlatformSlugs } from '@/lib/platforms'
import { LEGAL_SLUGS } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Sitemap', description: 'All pages on MediaDL.', alternates: { canonical: '/sitemap-page' },
}

const GROUPS: Record<string, { label: string; href: string }[]> = {
  Main: [
    { label: 'Home', href: '/' },
    { label: 'Download Tool', href: '/download' },
    { label: 'About', href: '/about' },
    { label: 'Services', href: '/services' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Blog', href: '/blog' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Contact', href: '/contact' },
  ],
}

export default function SitemapPage() {
  const platforms = getAllPlatformSlugs().map((s) => ({ label: s.replace('-downloader','').replace(/^\w/, c=>c.toUpperCase()) + ' Downloader', href: `/${s}` }))
  const legal = LEGAL_SLUGS.map((s) => ({ label: s.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '), href: `/${s}` }))

  const allGroups = { ...GROUPS, 'Platform Downloaders': platforms, 'Legal & Compliance': legal }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-10">Sitemap</h1>
      <div className="grid md:grid-cols-3 gap-10">
        {Object.entries(allGroups).map(([group, links]) => (
          <div key={group}>
            <h2 className="text-xs font-bold text-[var(--text-3)] uppercase tracking-widest mb-4">{group}</h2>
            <ul className="space-y-2.5">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-[var(--text-2)] hover:text-[var(--brand)] transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
