'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [sent,    setSent]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 shadow-xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={28} className="text-green-400" />
        </div>
        <h2 className="text-xl font-black text-[var(--text)] mb-2">Check your inbox</h2>
        <p className="text-sm text-[var(--text-3)] mb-6">
          Password reset link sent to <strong className="text-[var(--text-2)]">{email}</strong>.
        </p>
        <Link href="/sign-in" className="btn-primary px-8 py-2.5 text-sm font-bold">Back to sign in</Link>
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 shadow-xl">
      <div className="text-center mb-7">
        <h1 className="text-2xl font-black text-[var(--text)] mb-1">Reset password</h1>
        <p className="text-sm text-[var(--text-3)]">We'll email you a secure reset link</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <AlertCircle size={14} className="shrink-0" /> {error}
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-2)]">Email</label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="you@example.com" autoComplete="email"
              className="input pl-9 h-11 text-sm w-full" />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full h-11 text-sm font-bold disabled:opacity-50">
          {loading ? <><Loader2 size={14} className="animate-spin mr-2" />Sending…</> : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-sm text-[var(--text-3)] mt-6">
        <Link href="/sign-in" className="text-[var(--brand)] hover:text-[var(--brand-light)] font-semibold">← Back to sign in</Link>
      </p>
    </div>
  )
}
