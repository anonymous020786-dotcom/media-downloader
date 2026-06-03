import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, X, Zap, Crown, Building2, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pricing — Free Forever, Premium Optional',
  description: 'MediaDL is free forever. Optional premium plans add faster speeds, bulk limits, and priority support. Compare plans.',
  alternates: { canonical: '/pricing' },
}

const PLANS = [
  {
    name: 'Free', price: '$0', period: 'forever', icon: <Zap size={20} />,
    highlight: false, cta: 'Start Free', href: '/download',
    features: [
      { t: '1000+ supported sites', ok: true },
      { t: 'HD / 4K / 8K downloads', ok: true },
      { t: 'MP4, MP3 + 20 formats', ok: true },
      { t: 'Unlimited single downloads', ok: true },
      { t: 'Bulk & playlist downloads', ok: true },
      { t: 'No ads', ok: false },
      { t: 'Priority queue', ok: false },
    ],
  },
  {
    name: 'Pro', price: '$6', period: 'per month', icon: <Crown size={20} />,
    highlight: true, cta: 'Go Pro', href: '/download',
    features: [
      { t: 'Everything in Free', ok: true },
      { t: 'Ad-free experience', ok: true },
      { t: '10× faster priority queue', ok: true },
      { t: 'Unlimited playlist size', ok: true },
      { t: 'Batch up to 500 URLs', ok: true },
      { t: 'Cookie & proxy support', ok: true },
      { t: 'Priority email support', ok: true },
    ],
  },
  {
    name: 'Business', price: '$29', period: 'per month', icon: <Building2 size={20} />,
    highlight: false, cta: 'Contact Sales', href: '/contact',
    features: [
      { t: 'Everything in Pro', ok: true },
      { t: 'API access', ok: true },
      { t: 'Unlimited batch downloads', ok: true },
      { t: 'Dedicated infrastructure', ok: true },
      { t: 'Team accounts', ok: true },
      { t: 'SLA & uptime guarantee', ok: true },
      { t: 'Dedicated account manager', ok: true },
    ],
  },
]

export default function PricingPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-14">
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text)] mb-4">
          Simple, <span className="gradient-text">Transparent Pricing</span>
        </h1>
        <p className="text-lg text-[var(--text-2)] max-w-xl mx-auto">
          Start free forever. Upgrade anytime for faster speeds and more power. No hidden fees.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {PLANS.map((p) => (
          <div key={p.name}
            className={`relative p-7 rounded-2xl border transition-all ${
              p.highlight
                ? 'bg-gradient-to-b from-indigo-900/30 to-[var(--bg-card)] border-[var(--brand)] shadow-2xl shadow-indigo-900/30 md:-translate-y-3'
                : 'bg-[var(--bg-card)] border-[var(--border)]'
            }`}>
            {p.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--brand)] text-white text-[10px] font-bold uppercase tracking-wider">
                Most Popular
              </span>
            )}
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${p.highlight ? 'bg-[var(--brand)] text-white' : 'bg-[var(--bg-hover)] text-[var(--text-2)]'}`}>
              {p.icon}
            </div>
            <h3 className="text-lg font-black text-[var(--text)]">{p.name}</h3>
            <div className="flex items-baseline gap-1 mt-2 mb-6">
              <span className="text-4xl font-black text-[var(--text)]">{p.price}</span>
              <span className="text-sm text-[var(--text-3)]">/{p.period}</span>
            </div>
            <ul className="space-y-3 mb-7">
              {p.features.map((f) => (
                <li key={f.t} className="flex items-center gap-2.5 text-sm">
                  {f.ok
                    ? <Check size={15} className="text-emerald-400 shrink-0" />
                    : <X size={15} className="text-[var(--text-ghost)] shrink-0" />}
                  <span className={f.ok ? 'text-[var(--text-2)]' : 'text-[var(--text-3)] line-through'}>{f.t}</span>
                </li>
              ))}
            </ul>
            <Link href={p.href}
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-colors ${
                p.highlight
                  ? 'bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white'
                  : 'bg-[var(--bg-hover)] hover:bg-[var(--border)] text-[var(--text)] border border-[var(--border)]'
              }`}>
              {p.cta} <ArrowRight size={14} />
            </Link>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-[var(--text-3)]">
        All plans include our core downloader. Cancel anytime. 7-day money-back guarantee on paid plans.{' '}
        <Link href="/refund-policy" className="underline hover:text-[var(--text-2)]">Refund policy</Link>.
      </p>
    </div>
  )
}
