'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Mail, Lock, AlertCircle } from 'lucide-react'
import OtpInput from '@/components/ui/OtpInput'
import MfaChallenge from '@/components/auth/MfaChallenge'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function MicrosoftIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" fill="none">
      <rect x="0"    y="0"    width="10" height="10" fill="#f25022" />
      <rect x="11"   y="0"    width="10" height="10" fill="#7fba00" />
      <rect x="0"    y="11"   width="10" height="10" fill="#00a4ef" />
      <rect x="11"   y="11"   width="10" height="10" fill="#ffb900" />
    </svg>
  )
}

function GoogleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function GitHubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}

export default function SignInPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirect_url') ?? '/download'
  const supabase     = createClient()

  const [tab,        setTab]        = useState<'password' | 'otp'>('password')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [oauthLoad,  setOauthLoad]  = useState('')
  const [error,      setError]      = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)

  // OTP tab state
  const [otpEmail,     setOtpEmail]     = useState('')
  const [otpSent,      setOtpSent]      = useState(false)
  const [otp,          setOtp]          = useState('')
  const [otpLoading,   setOtpLoading]   = useState(false)
  const [otpError,     setOtpError]     = useState('')
  const [resendTimer,  setResendTimer]  = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startResendTimer() {
    setResendTimer(30)
    timerRef.current = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0 }
        return t - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  async function checkMfaThenContinue() {
    // After a successful primary login, check whether MFA step-up is required.
    try {
      const t = (await supabase.auth.getSession()).data.session?.access_token ?? ''
      const r = await fetch(`${API}/api/mfa/methods`, { headers: { Authorization: `Bearer ${t}` } })
      if (r.ok) {
        const d = await r.json()
        if (d.mfaEnabled) { setMfaRequired(true); return }
      }
    } catch { /* fall through — don't block login if MFA check fails */ }
    router.push(redirectTo)
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return }
    await checkMfaThenContinue()
  }

  async function handleMfaCancel() {
    await supabase.auth.signOut()
    setMfaRequired(false)
    setError('Signed out. Verification is required to continue.')
  }

  async function handleOAuth(provider: 'google' | 'github' | 'azure') {
    setOauthLoad(provider); setError('')
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect_url=${encodeURIComponent(redirectTo)}` },
    })
  }

  async function handleMagicLink() {
    if (!email) { setError('Enter your email first'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?redirect_url=${encodeURIComponent(redirectTo)}` },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    alert(`Magic link sent to ${email} — check your inbox!`)
  }

  async function handleSendOtp() {
    if (!otpEmail) { setOtpError('Enter your email'); return }
    setOtpLoading(true); setOtpError('')
    try {
      // Use Supabase's built-in OTP flow so verifyOtp works
      const { error: err } = await supabase.auth.signInWithOtp({ email: otpEmail })
      if (err) { setOtpError(err.message); setOtpLoading(false); return }
      setOtpSent(true)
      startResendTimer()
    } catch (e: any) {
      setOtpError(e.message)
    }
    setOtpLoading(false)
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) { setOtpError('Enter all 6 digits'); return }
    setOtpLoading(true); setOtpError('')
    const { error: err } = await supabase.auth.verifyOtp({ email: otpEmail, token: otp, type: 'email' })
    setOtpLoading(false)
    if (err) { setOtpError(err.message); return }
    await checkMfaThenContinue()
  }

  async function handleResendOtp() {
    if (resendTimer > 0) return
    setOtp('')
    await handleSendOtp()
  }

  if (mfaRequired) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 shadow-xl">
        <MfaChallenge
          onSuccess={() => { router.push(redirectTo); router.refresh() }}
          onCancel={handleMfaCancel}
        />
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 shadow-xl">
      <div className="text-center mb-7">
        <h1 className="text-2xl font-black text-[var(--text)] mb-1">Welcome back</h1>
        <p className="text-sm text-[var(--text-3)]">Sign in to your MediaDL account</p>
      </div>

      {/* OAuth buttons */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {([
          { id: 'google',  label: 'Google',    Icon: GoogleIcon },
          { id: 'github',  label: 'GitHub',    Icon: GitHubIcon },
          { id: 'azure',   label: 'Microsoft', Icon: MicrosoftIcon },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => handleOAuth(id)} disabled={!!oauthLoad}
            className="flex items-center justify-center gap-1.5 px-2 py-2.5 border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50">
            {oauthLoad === id ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-xs text-[var(--text-3)]">or with email</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      {/* Tabs */}
      <div className="flex border border-[var(--border)] rounded-xl overflow-hidden mb-5">
        {(['password', 'otp'] as const).map(t => (
          <button key={t} type="button" onClick={() => { setTab(t); setError(''); setOtpError('') }}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === t ? 'bg-[var(--brand)] text-white' : 'text-[var(--text-2)] hover:bg-[var(--bg-hover)]'}`}>
            {t === 'password' ? 'Password' : 'OTP'}
          </button>
        ))}
      </div>

      {tab === 'password' && (
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

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-2)]">Password</label>
              <Link href="/forgot-password" className="text-xs text-[var(--brand)] hover:text-[var(--brand-light)]">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••" autoComplete="current-password"
                className="input pl-9 pr-10 h-11 text-sm w-full" />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text-2)]">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="remember" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border border-[var(--border)] accent-[var(--brand)] cursor-pointer" />
            <label htmlFor="remember" className="text-xs text-[var(--text-2)] cursor-pointer">Remember me</label>
          </div>

          <button type="submit" disabled={loading}
            className="btn-primary w-full h-11 text-sm font-bold disabled:opacity-50">
            {loading ? <><Loader2 size={14} className="animate-spin mr-2" />Signing in…</> : 'Sign in'}
          </button>

          <button type="button" onClick={handleMagicLink} disabled={loading}
            className="w-full h-10 text-sm font-semibold text-[var(--text-3)] hover:text-[var(--text-2)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-hover)] transition-colors">
            Send magic link instead
          </button>
        </form>
      )}

      {tab === 'otp' && (
        <div className="space-y-4">
          {otpError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertCircle size={14} className="shrink-0" /> {otpError}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-2)]">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input type="email" value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" disabled={otpSent}
                className="input pl-9 h-11 text-sm w-full disabled:opacity-60" />
            </div>
          </div>

          {!otpSent ? (
            <button type="button" onClick={handleSendOtp} disabled={otpLoading || !otpEmail}
              className="btn-primary w-full h-11 text-sm font-bold disabled:opacity-50">
              {otpLoading ? <><Loader2 size={14} className="animate-spin mr-2" />Sending…</> : 'Send OTP'}
            </button>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-2)] block text-center">Enter 6-digit code</label>
                <OtpInput value={otp} onChange={setOtp} disabled={otpLoading} />
                <p className="text-xs text-[var(--text-3)] text-center">Code sent to {otpEmail}</p>
              </div>

              <button type="button" onClick={handleVerifyOtp} disabled={otpLoading || otp.length < 6}
                className="btn-primary w-full h-11 text-sm font-bold disabled:opacity-50">
                {otpLoading ? <><Loader2 size={14} className="animate-spin mr-2" />Verifying…</> : 'Verify & Sign In'}
              </button>

              <div className="text-center">
                {resendTimer > 0 ? (
                  <span className="text-xs text-[var(--text-3)]">Resend in {resendTimer}s</span>
                ) : (
                  <button type="button" onClick={handleResendOtp} className="text-xs text-[var(--brand)] hover:underline">
                    Resend OTP
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <p className="text-center text-sm text-[var(--text-3)] mt-6">
        No account?{' '}
        <Link href={`/sign-up${redirectTo !== '/download' ? `?redirect_url=${encodeURIComponent(redirectTo)}` : ''}`}
          className="text-[var(--brand)] hover:text-[var(--brand-light)] font-semibold">
          Sign up free
        </Link>
      </p>
    </div>
  )
}
