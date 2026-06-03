import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Download, Check, ArrowRight, HelpCircle } from 'lucide-react'
import { getPlatformBySlug, getAllPlatformSlugs, PLATFORMS } from '@/lib/platforms'
import HeroInput from '@/components/landing/HeroInput'

interface Params { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return getAllPlatformSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const p = getPlatformBySlug(slug)
  if (!p) return { title: 'Not Found' }
  return {
    title: `${p.name} Downloader — ${p.tagline} | MediaDL`,
    description: p.description,
    keywords: [`${p.name.toLowerCase()} downloader`, `download ${p.name.toLowerCase()} videos`, `${p.name.toLowerCase()} video download`, 'free downloader'],
    openGraph: { title: `${p.name} Downloader — ${p.tagline}`, description: p.description },
    alternates: { canonical: `/${p.slug}` },
  }
}

export default async function PlatformPage({ params }: Params) {
  const { slug } = await params
  const p = getPlatformBySlug(slug)
  if (!p) notFound()

  // FAQ schema
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: p.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const otherPlatforms = PLATFORMS.filter((x) => x.slug !== p.slug).slice(0, 8)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* HERO */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className={`hero-blob w-96 h-96 bg-gradient-to-br ${p.color} opacity-20 -top-32 left-1/4`} />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${p.color} text-3xl mb-6 shadow-2xl`}>
            {p.emoji}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4">
            {p.name} <span className="gradient-text">Downloader</span>
          </h1>
          <p className="text-lg text-[var(--text-2)] max-w-2xl mx-auto mb-8 leading-relaxed">
            {p.description}
          </p>
          <HeroInput />
        </div>
      </section>

      {/* FORMATS & QUALITIES */}
      <section className="py-12 border-y border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-3)] uppercase tracking-widest mb-4">Supported Formats</h2>
            <div className="flex flex-wrap gap-2">
              {p.formats.map((f) => (
                <span key={f} className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm font-semibold text-[var(--text-2)]">{f}</span>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-3)] uppercase tracking-widest mb-4">Available Qualities</h2>
            <div className="flex flex-wrap gap-2">
              {p.qualities.map((q) => (
                <span key={q} className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm font-semibold text-[var(--text-2)]">{q}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW TO */}
      <section className="py-16 max-w-5xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-black text-center mb-10">How to Download from {p.name}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {p.steps.map((step, i) => (
            <div key={i} className="relative p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br ${p.color} text-white text-sm font-black mb-3`}>{i + 1}</span>
              <p className="text-sm text-[var(--text-2)] leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/download" className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-bold rounded-xl transition-colors">
            <Download size={16} /> Open Download Tool <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-16 bg-[var(--bg-surface)] border-y border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-black text-center mb-10">{p.name} Download Features</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {p.features.map((f) => (
              <div key={f} className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Check size={12} className="text-emerald-400" />
                </div>
                <span className="text-sm font-semibold text-[var(--text-2)]">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 max-w-3xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-black text-center mb-10">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {p.faqs.map((f, i) => (
            <details key={i} className="group rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
              <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer list-none">
                <HelpCircle size={16} className="text-[var(--brand)] shrink-0" />
                <span className="font-semibold text-[var(--text)] text-sm flex-1">{f.q}</span>
                <span className="text-[var(--text-3)] group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <p className="px-5 pb-4 pl-14 text-sm text-[var(--text-2)] leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* OTHER PLATFORMS */}
      <section className="py-16 bg-[var(--bg-surface)] border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-xl font-black text-center mb-8">Download from Other Platforms</h2>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {otherPlatforms.map((o) => (
              <Link key={o.slug} href={`/${o.slug}`}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-gradient-to-br ${o.color} opacity-70 hover:opacity-100 hover:scale-105 transition-all`}>
                <span className="text-xl">{o.emoji}</span>
                <span className="text-[10px] text-white font-bold text-center leading-tight">{o.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
