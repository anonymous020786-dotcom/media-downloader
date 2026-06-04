'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Send, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { submitContact } from '@/lib/api'
import { getRecaptchaToken } from '@/lib/recaptcha'

const INPUT = 'w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 rounded-xl px-3 py-2.5 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-3)]'

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending'); setError('')
    try {
      const recaptchaToken = await getRecaptchaToken('contact_form')
      await submitContact({ ...form, recaptchaToken: recaptchaToken ?? undefined })
      setStatus('sent')
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch (err: any) {
      setStatus('error'); setError(err.message)
    }
  }

  if (status === 'sent') {
    return (
      <div role="alert" className="flex flex-col items-center justify-center text-center p-10 rounded-2xl bg-[var(--bg-card)] border border-emerald-800/40 h-full">
        <CheckCircle2 size={40} className="text-emerald-400 mb-4" aria-hidden="true" />
        <h3 className="text-lg font-bold text-[var(--text)] mb-2">Message Sent!</h3>
        <p className="text-sm text-[var(--text-2)] mb-5">Thanks for reaching out. We'll reply within 24 hours.</p>
        <button onClick={() => setStatus('idle')}
          className="px-5 py-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
          Send another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cf-name" className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">Name <span aria-hidden="true" className="text-red-400">*</span></label>
          <input id="cf-name" required autoComplete="name" value={form.name} onChange={set('name')}
            placeholder="Your full name" aria-required="true" className={INPUT} />
        </div>
        <div>
          <label htmlFor="cf-email" className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">Email <span aria-hidden="true" className="text-red-400">*</span></label>
          <input id="cf-email" required type="email" autoComplete="email" value={form.email} onChange={set('email')}
            placeholder="you@example.com" aria-required="true" className={INPUT} />
        </div>
      </div>
      <div>
        <label htmlFor="cf-subject" className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">Subject</label>
        <input id="cf-subject" value={form.subject} onChange={set('subject')}
          placeholder="What's this about?" autoComplete="off" className={INPUT} />
      </div>
      <div>
        <label htmlFor="cf-message" className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">Message <span aria-hidden="true" className="text-red-400">*</span></label>
        <textarea id="cf-message" required rows={5} value={form.message} onChange={set('message')}
          placeholder="Tell us how we can help…" aria-required="true"
          className={`${INPUT} resize-none`} />
      </div>

      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

      <p className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)]">
        <ShieldCheck size={11} className="text-emerald-500 shrink-0" aria-hidden="true" />
        Protected by reCAPTCHA ·{' '}
        <Link href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-2)] underline">Privacy</Link>
        {' & '}
        <Link href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-2)] underline">Terms</Link>
      </p>

      <button type="submit" disabled={status === 'sending'}
        aria-disabled={status === 'sending'}
        className="flex items-center justify-center gap-2 w-full py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors focus:ring-2 focus:ring-[var(--brand)]/40 focus:outline-none">
        {status === 'sending'
          ? <><Loader2 size={15} className="spin" aria-hidden="true" />Sending…</>
          : <><Send size={15} aria-hidden="true" />Send Message</>}
      </button>
    </form>
  )
}
