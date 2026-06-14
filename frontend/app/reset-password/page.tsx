'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Lock, AlertCircle, CheckCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState(false)
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash — the SDK handles exchange automatically.
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setConfirm(true)
    })
  }, []) // eslint-disable-line

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => router.push('/sign-in'), 2500)
  }

  if (done) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 shadow-xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={28} className="text-green-400" />
        </div>
        <h2 className="text-xl font-black text-[var(--text)] mb-2">Password updated!</h2>
        <p className="text-sm text-[var(--text-3)]">Redirecting to sign in…</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 shadow-xl">
      <div className="text-center mb-7">
        <h1 className="text-2xl font-black text-[var(--text)] mb-1">Set new password</h1>
        <p className="text-sm text-[var(--text-3)]">Choose a strong password for your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <AlertCircle size={14} className="shrink-0" /> {error}
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-2)]">New password</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              required minLength={8} placeholder="••••••••" autoComplete="new-password"
              className="input pl-9 pr-10 h-11 text-sm w-full" />
            <button type="button" onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]">
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading || !confirm}
          className="btn-primary w-full h-11 text-sm font-bold disabled:opacity-50">
          {loading ? <><Loader2 size={14} className="animate-spin mr-2" />Updating…</> : 'Update password'}
        </button>
        {!confirm && (
          <p className="text-xs text-[var(--text-3)] text-center">Waiting for recovery session…</p>
        )}
      </form>

      <p className="text-center text-sm text-[var(--text-3)] mt-6">
        <Link href="/sign-in" className="text-[var(--brand)] font-semibold">← Back to sign in</Link>
      </p>
    </div>
  )
}
