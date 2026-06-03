import type { Metadata } from 'next'
import { Mail, MessageCircle, MapPin, Clock } from 'lucide-react'
import ContactForm from '@/components/marketing/ContactForm'

export const metadata: Metadata = {
  title: 'Contact Us — Get in Touch',
  description: 'Contact the MediaDL team for support, business inquiries, DMCA notices, or feedback. We respond within 24 hours.',
  alternates: { canonical: '/contact' },
}

const CHANNELS = [
  { icon: <Mail size={18} />,          title: 'General Support', value: 'support@mediadl.app',  href: 'mailto:support@mediadl.app' },
  { icon: <MessageCircle size={18} />, title: 'Live Chat',       value: 'Available 24/7',        href: '#' },
  { icon: <Clock size={18} />,         title: 'Response Time',   value: 'Within 24 hours',       href: '#' },
  { icon: <MapPin size={18} />,        title: 'DMCA Notices',    value: 'dmca@mediadl.app',      href: 'mailto:dmca@mediadl.app' },
]

export default function ContactPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-14">
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text)] mb-4">
          Get in <span className="gradient-text">Touch</span>
        </h1>
        <p className="text-lg text-[var(--text-2)] max-w-xl mx-auto">
          Have a question, feedback, or business inquiry? We'd love to hear from you.
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Channels */}
        <div className="md:col-span-2 space-y-4">
          {CHANNELS.map((c) => (
            <a key={c.title} href={c.href}
              className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/15 text-[var(--brand)] flex items-center justify-center shrink-0">{c.icon}</div>
              <div>
                <p className="text-sm font-bold text-[var(--text)]">{c.title}</p>
                <p className="text-sm text-[var(--text-2)]">{c.value}</p>
              </div>
            </a>
          ))}
        </div>

        {/* Form */}
        <div className="md:col-span-3">
          <ContactForm />
        </div>
      </div>
    </div>
  )
}
