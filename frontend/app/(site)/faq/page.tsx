import type { Metadata } from 'next'
import Link from 'next/link'
import { HelpCircle, Download } from 'lucide-react'
import { fetchFaq, type FaqItem } from '@/lib/api'

export const metadata: Metadata = {
  title: 'FAQ — Frequently Asked Questions',
  description: 'Answers to common questions about MediaDL: supported sites, formats, quality, playlists, privacy, and more.',
  alternates: { canonical: '/faq' },
}

export const revalidate = 300

const FALLBACK: FaqItem[] = [
  { id:1, question:'What websites does MediaDL support?', answer:'MediaDL supports 1000+ websites including YouTube, Instagram, TikTok, Twitter/X, Facebook, Reddit, Vimeo, Twitch, SoundCloud and many more.', category:'General', sort_order:1 },
  { id:2, question:'Is MediaDL free?', answer:'Yes, MediaDL is completely free with no download limits and no account required.', category:'General', sort_order:2 },
  { id:3, question:'Can I download entire playlists?', answer:'Yes! Use Playlist mode to download entire playlists or channels.', category:'Features', sort_order:3 },
]

export default async function FaqPage() {
  let items: FaqItem[] = FALLBACK
  try { items = await fetchFaq() } catch { /* fallback */ }

  const categories = [...new Set(items.map((i) => i.category))]
  const faqSchema = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type':'Question', name:f.question, acceptedAnswer:{ '@type':'Answer', text:f.answer } })),
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text)] mb-4">
          Frequently Asked <span className="gradient-text">Questions</span>
        </h1>
        <p className="text-lg text-[var(--text-2)]">Everything you need to know about MediaDL.</p>
      </div>

      {categories.map((cat) => (
        <div key={cat} className="mb-10">
          <h2 className="text-xs font-bold text-[var(--text-3)] uppercase tracking-widest mb-4">{cat}</h2>
          <div className="space-y-3">
            {items.filter((i) => i.category === cat).map((f) => (
              <details key={f.id} className="group rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
                <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer list-none">
                  <HelpCircle size={16} className="text-[var(--brand)] shrink-0" />
                  <span className="font-semibold text-[var(--text)] text-sm flex-1">{f.question}</span>
                  <span className="text-[var(--text-3)] group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="px-5 pb-4 pl-14 text-sm text-[var(--text-2)] leading-relaxed">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      ))}

      <div className="text-center mt-12 p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
        <p className="text-[var(--text-2)] mb-5">Still have questions?</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/contact" className="px-5 py-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:border-[var(--border-hover)] transition-colors">Contact Support</Link>
          <Link href="/download" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-bold transition-colors"><Download size={14}/>Start Downloading</Link>
        </div>
      </div>
    </div>
  )
}
