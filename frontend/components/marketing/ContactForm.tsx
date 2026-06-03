'use client'
import { useState } from 'react'
import { Send, CheckCircle2, Loader2 } from 'lucide-react'
import { submitContact } from '@/lib/api'

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
      await submitContact(form)
      setStatus('sent')
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch (err: any) {
      setStatus('error'); setError(err.message)
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center justify-center text-center p-10 rounded-2xl bg-[var(--bg-card)] border border-emerald-800/40 h-full">
        <CheckCircle2 size={40} className="text-emerald-400 mb-4" />
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
    <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">Name</label>
          <input required value={form.name} onChange={set('name')}
            className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] outline-none transition-colors" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">Email</label>
          <input required type="email" value={form.email} onChange={set('email')}
            className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] outline-none transition-colors" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">Subject</label>
        <input value={form.subject} onChange={set('subject')}
          className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] outline-none transition-colors" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">Message</label>
        <textarea required rows={5} value={form.message} onChange={set('message')}
          className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] outline-none resize-none transition-colors" />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <p className="text-[10px] text-[var(--text-3)]">
        This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.
      </p>

      <button type="submit" disabled={status === 'sending'}
        className="flex items-center justify-center gap-2 w-full py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors">
        {status === 'sending' ? <><Loader2 size={15} className="spin" />Sending…</> : <><Send size={15} />Send Message</>}
      </button>
    </form>
  )
}
