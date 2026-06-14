'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle, CheckCircle, AtSign, Phone } from 'lucide-react'
import OtpInput from '@/components/ui/OtpInput'
import AvatarUpload from '@/components/ui/AvatarUpload'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const STEPS = ['Account', 'Security', 'Profile', 'Preferences']

const COUNTRY_CODES = [
  { code: '+1', label: 'US/CA' }, { code: '+44', label: 'UK' }, { code: '+91', label: 'IN' },
  { code: '+49', label: 'DE' },  { code: '+33', label: 'FR' }, { code: '+81', label: 'JP' },
  { code: '+86', label: 'CN' },  { code: '+55', label: 'BR' }, { code: '+61', label: 'AU' },
  { code: '+971', label: 'AE' },
]

const COUNTRIES = [
  'United States','United Kingdom','Canada','Australia','Germany','France','India','Japan','Brazil','China',
  'South Korea','Italy','Spain','Mexico','Netherlands','Sweden','Norway','Denmark','Finland','Switzerland',
  'Belgium','Austria','Poland','Portugal','Argentina','Colombia','South Africa','Nigeria','Egypt','UAE',
]

const INDUSTRIES = [
  'Technology','Finance','Healthcare','Education','Media & Entertainment','Retail','Manufacturing',
  'Real Estate','Legal','Consulting','Government','Non-Profit','Agriculture','Transportation','Other',
]

const LANGUAGES = [
  { value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },  { value: 'de', label: 'German' },
  { value: 'ar', label: 'Arabic' },  { value: 'hi', label: 'Hindi' },
  { value: 'pt', label: 'Portuguese' }, { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
]

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars',  ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Number',    ok: /\d/.test(password) },
    { label: 'Symbol',    ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const color = score <= 1 ? 'bg-red-500' : score === 2 ? 'bg-amber-500' : score === 3 ? 'bg-yellow-400' : 'bg-green-500'
  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1.5">
        {[0,1,2,3].map(i => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i < score ? color : 'bg-[var(--border)]'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {checks.map(c => (
          <span key={c.label} className={`text-[10px] flex items-center gap-1 ${c.ok ? 'text-green-400' : 'text-[var(--text-3)]'}`}>
            <CheckCircle size={9} className={c.ok ? 'opacity-100' : 'opacity-30'} /> {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function GoogleIcon() { return <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> }
function GitHubIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg> }
function MicrosoftIcon() { return <svg width="14" height="14" viewBox="0 0 21 21"><rect x="0" y="0" width="10" height="10" fill="#f25022"/><rect x="11" y="0" width="10" height="10" fill="#7fba00"/><rect x="0" y="11" width="10" height="10" fill="#00a4ef"/><rect x="11" y="11" width="10" height="10" fill="#ffb900"/></svg> }

export default function SignUpPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirect_url') ?? '/download'
  const supabase     = createClient()

  const [step,      setStep]      = useState(0)
  const [loading,   setLoading]   = useState(false)
  const [oauthLoad, setOauthLoad] = useState('')
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)
  const [signedUpEmail, setSignedUpEmail] = useState('')

  // Step 1 — Account
  const [avatarFile,   setAvatarFile]   = useState<File | null>(null)
  const [firstName,    setFirstName]    = useState('')
  const [lastName,     setLastName]     = useState('')
  const [username,     setUsername]     = useState('')
  const [usernameOk,   setUsernameOk]   = useState<boolean | null>(null)
  const [usernameMsg,  setUsernameMsg]  = useState('')
  const [email,        setEmail]        = useState('')
  const [phoneCode,    setPhoneCode]    = useState('+1')
  const [phoneNum,     setPhoneNum]     = useState('')

  // Step 2 — Security
  const [password,     setPassword]     = useState('')
  const [confirmPass,  setConfirmPass]  = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [otpSent,      setOtpSent]      = useState(false)
  const [otp,          setOtp]          = useState('')
  const [otpLoading,   setOtpLoading]   = useState(false)

  // Step 3 — Profile
  const [dob,          setDob]          = useState('')
  const [gender,       setGender]       = useState('')
  const [country,      setCountry]      = useState('')
  const [stateRegion,  setStateRegion]  = useState('')
  const [city,         setCity]         = useState('')
  const [postalCode,   setPostalCode]   = useState('')
  const [address1,     setAddress1]     = useState('')
  const [address2,     setAddress2]     = useState('')
  const [bio,          setBio]          = useState('')
  const [website,      setWebsite]      = useState('')

  // Step 4 — Professional & Preferences
  const [occupation,   setOccupation]   = useState('')
  const [company,      setCompany]      = useState('')
  const [industry,     setIndustry]     = useState('')
  const [twitter,      setTwitter]      = useState('')
  const [instagram,    setInstagram]    = useState('')
  const [youtube,      setYoutube]      = useState('')
  const [linkedin,     setLinkedin]     = useState('')
  const [github,       setGithub]       = useState('')
  const [microsoft,    setMicrosoft]    = useState('')
  const [language,     setLanguage]     = useState('en')
  const [newsletter,   setNewsletter]   = useState(false)
  const [agreeTerms,   setAgreeTerms]   = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced username check
  useEffect(() => {
    if (!username) { setUsernameOk(null); setUsernameMsg(''); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const r    = await fetch(`${API}/api/users/check-username?username=${encodeURIComponent(username)}`)
        const data = await r.json()
        if (data.error) { setUsernameOk(false); setUsernameMsg(data.error) }
        else { setUsernameOk(data.available); setUsernameMsg(data.available ? 'Available' : 'Already taken') }
      } catch { setUsernameOk(null) }
    }, 400)
  }, [username])

  async function handleOAuth(provider: 'google' | 'github' | 'azure') {
    setOauthLoad(provider)
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect_url=${encodeURIComponent(redirectTo)}` },
    })
  }

  async function handleSendOtp() {
    if (!email) { setError('Enter your email in Step 1 first'); return }
    setOtpLoading(true)
    try {
      const r    = await fetch(`${API}/api/otp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, type: 'verify' }) })
      const data = await r.json()
      if (!data.success) { setError(data.error ?? 'Failed to send OTP'); return }
      setOtpSent(true)
    } catch (e: any) { setError(e.message) }
    setOtpLoading(false)
  }

  function validateStep(): boolean {
    setError('')
    if (step === 0) {
      if (!firstName.trim()) { setError('First name is required'); return false }
      if (!email.trim())     { setError('Email is required'); return false }
    }
    if (step === 1) {
      if (password.length < 8)        { setError('Password must be at least 8 characters'); return false }
      if (password !== confirmPass)    { setError('Passwords do not match'); return false }
    }
    if (step === 3) {
      if (!agreeTerms)   { setError('You must agree to the Terms of Service'); return false }
      if (!agreePrivacy) { setError('You must agree to the Privacy Policy'); return false }
    }
    return true
  }

  function nextStep() {
    if (!validateStep()) return
    setStep(s => s + 1)
  }

  async function handleSubmit() {
    if (!validateStep()) return
    setLoading(true); setError('')

    try {
      let avatarUrl = ''
      // Profile photo is optional and only works with Supabase Storage at signup
      // time (the user isn't authenticated yet, so the backend upload route — used
      // for Hostinger/S3 — isn't available). If it fails, continue without it; the
      // user can set a photo afterward in Account Settings.
      const storageProvider = process.env.NEXT_PUBLIC_STORAGE_PROVIDER ?? 'supabase'
      if (avatarFile && storageProvider === 'supabase') {
        try {
          const ext  = avatarFile.name.split('.').pop() ?? 'jpg'
          const uid  = crypto.randomUUID()
          const { data: upData, error: upErr } = await supabase.storage.from('avatars').upload(`${uid}.${ext}`, avatarFile, { upsert: true })
          if (!upErr && upData) {
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(upData.path)
            avatarUrl = publicUrl
          }
        } catch { /* non-blocking — photo can be added later in Account Settings */ }
      }

      const { error: signUpErr } = await supabase.auth.signUp({
        email, password,
        options: {
          data: {
            full_name:  `${firstName} ${lastName}`.trim(),
            avatar_url: avatarUrl || undefined,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect_url=${encodeURIComponent(redirectTo)}`,
        },
      })

      if (signUpErr) throw new Error(signUpErr.message)

      setSignedUpEmail(email)
      setDone(true)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 shadow-xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={28} className="text-green-400" />
        </div>
        <h2 className="text-xl font-black text-[var(--text)] mb-2">Check your inbox</h2>
        <p className="text-sm text-[var(--text-3)] mb-6">
          We sent a verification link to <strong className="text-[var(--text-2)]">{signedUpEmail}</strong>.
          Click it to activate your account.
        </p>
        <Link href="/sign-in" className="btn-primary px-8 py-2.5 text-sm font-bold">Back to sign in</Link>
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 shadow-xl">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black text-[var(--text)] mb-1">Create account</h1>
        <p className="text-sm text-[var(--text-3)]">Free forever. No credit card required.</p>
      </div>

      {/* Step indicator */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-[var(--brand)] text-white' : 'bg-[var(--border)] text-[var(--text-3)]'
              }`}>
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={`text-[10px] font-semibold ${i === step ? 'text-[var(--brand)]' : 'text-[var(--text-3)]'}`}>{label}</span>
            </div>
          ))}
        </div>
        <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
          <div
            className={`h-full bg-[var(--brand)] rounded-full transition-all duration-300 ${
              step === 0 ? 'w-0' : step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'
            }`}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 mb-4">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {/* STEP 1 — Account */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="flex justify-center">
            <AvatarUpload
              size="lg"
              initials={firstName ? firstName[0] : undefined}
              onChange={f => setAvatarFile(f)}
              onRemove={() => setAvatarFile(null)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">First name *</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                placeholder="Jane" className="input h-10 text-sm w-full" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">Last name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                placeholder="Doe" className="input h-10 text-sm w-full" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-2)]">Username</label>
            <div className="relative">
              <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="jane_doe" className="input pl-9 h-10 text-sm w-full" />
            </div>
            {username && usernameMsg && (
              <p className={`text-xs flex items-center gap-1 ${usernameOk ? 'text-green-400' : 'text-red-400'}`}>
                {usernameOk ? <CheckCircle size={10} /> : <AlertCircle size={10} />} {usernameMsg}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-2)]">Email *</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="jane@example.com" autoComplete="email" className="input pl-9 h-10 text-sm w-full" />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="phone-num" className="text-xs font-semibold text-[var(--text-2)]">Phone (optional)</label>
            <div className="flex gap-2">
              <select
                id="phone-code"
                aria-label="Phone country code"
                value={phoneCode}
                onChange={e => setPhoneCode(e.target.value)}
                className="input h-10 text-sm w-24 shrink-0"
              >
                {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code} {c.label}</option>)}
              </select>
              <div className="relative flex-1">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                <input
                  id="phone-num"
                  type="tel"
                  value={phoneNum}
                  onChange={e => setPhoneNum(e.target.value)}
                  placeholder="555 000 0000"
                  aria-label="Phone number"
                  className="input pl-9 h-10 text-sm w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-xs text-[var(--text-3)]">or sign up with</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'google',  label: 'Google',    Icon: GoogleIcon },
              { id: 'github',  label: 'GitHub',    Icon: GitHubIcon },
              { id: 'azure',   label: 'Microsoft', Icon: MicrosoftIcon },
            ] as const).map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => handleOAuth(id)} disabled={!!oauthLoad}
                className="flex items-center justify-center gap-1.5 px-2 py-2.5 border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50">
                {oauthLoad === id ? <Loader2 size={12} className="animate-spin" /> : <Icon />}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2 — Security */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-2)]">Password *</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••" autoComplete="new-password" className="input pl-9 pr-10 h-10 text-sm w-full" />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text-2)]">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {password && <PasswordStrength password={password} />}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-2)]">Confirm password *</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input type={showConfirm ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required
                placeholder="••••••••" autoComplete="new-password" className="input pl-9 pr-10 h-10 text-sm w-full" />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text-2)]">
                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {confirmPass && password !== confirmPass && (
              <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={10} /> Passwords do not match</p>
            )}
          </div>

          <div className="border border-[var(--border)] rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-[var(--text-2)]">Verify your email via OTP (optional)</p>
            {!otpSent ? (
              <button type="button" onClick={handleSendOtp} disabled={otpLoading || !email}
                className="w-full py-2 border border-[var(--brand)] text-[var(--brand)] rounded-xl text-sm font-semibold hover:bg-[var(--brand)]/10 transition-colors disabled:opacity-50">
                {otpLoading ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null}
                Send verification OTP to {email || '(enter email in step 1)'}
              </button>
            ) : (
              <div className="space-y-3">
                <OtpInput value={otp} onChange={setOtp} disabled={otpLoading} />
                <p className="text-xs text-green-400 text-center flex items-center justify-center gap-1">
                  <CheckCircle size={11} /> OTP sent to {email}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3 — Profile */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="dob" className="text-xs font-semibold text-[var(--text-2)]">Date of birth</label>
              <input
                id="dob"
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                title="Date of birth"
                placeholder="YYYY-MM-DD"
                className="input h-10 text-sm w-full"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="gender" className="text-xs font-semibold text-[var(--text-2)]">Gender</label>
              <select
                id="gender"
                aria-label="Gender"
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="input h-10 text-sm w-full"
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="country" className="text-xs font-semibold text-[var(--text-2)]">Country</label>
            <select
              id="country"
              aria-label="Country"
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="input h-10 text-sm w-full"
            >
              <option value="">Select country</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">State / Region</label>
              <input type="text" value={stateRegion} onChange={e => setStateRegion(e.target.value)} placeholder="California" className="input h-10 text-sm w-full" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">City</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="San Francisco" className="input h-10 text-sm w-full" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">Postal code</label>
              <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="94102" className="input h-10 text-sm w-full" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-2)]">Address line 1</label>
            <input type="text" value={address1} onChange={e => setAddress1(e.target.value)} placeholder="123 Main St" className="input h-10 text-sm w-full" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-2)]">Address line 2</label>
            <input type="text" value={address2} onChange={e => setAddress2(e.target.value)} placeholder="Apt 4B" className="input h-10 text-sm w-full" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-2)]">Bio <span className="text-[var(--text-3)] font-normal">({bio.length}/250)</span></label>
            <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 250))} rows={3}
              placeholder="Tell us a bit about yourself…"
              className="input h-auto py-2.5 text-sm w-full resize-none" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-2)]">Website</label>
            <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yoursite.com" className="input h-10 text-sm w-full" />
          </div>
        </div>
      )}

      {/* STEP 4 — Professional & Preferences */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">Occupation</label>
              <input type="text" value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="Software Engineer" className="input h-10 text-sm w-full" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">Company</label>
              <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp" className="input h-10 text-sm w-full" />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="industry" className="text-xs font-semibold text-[var(--text-2)]">Industry</label>
            <select
              id="industry"
              aria-label="Industry"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              className="input h-10 text-sm w-full"
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">Twitter / X</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-sm">@</span>
                <input type="text" value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="username" className="input pl-7 h-10 text-sm w-full" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">Instagram</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-sm">@</span>
                <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="username" className="input pl-7 h-10 text-sm w-full" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">YouTube Channel</label>
              <input type="url" value={youtube} onChange={e => setYoutube(e.target.value)} placeholder="https://youtube.com/@…" className="input h-10 text-sm w-full" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">LinkedIn Profile</label>
              <input type="url" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" className="input h-10 text-sm w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">GitHub Username</label>
              <input type="text" value={github} onChange={e => setGithub(e.target.value)} placeholder="octocat" className="input h-10 text-sm w-full" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-2)]">Microsoft / Teams Handle</label>
              <input type="text" value={microsoft} onChange={e => setMicrosoft(e.target.value)} placeholder="handle" className="input h-10 text-sm w-full" />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="language" className="text-xs font-semibold text-[var(--text-2)]">Language preference</label>
            <select
              id="language"
              aria-label="Language preference"
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="input h-10 text-sm w-full"
            >
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="newsletter" checked={newsletter} onChange={e => setNewsletter(e.target.checked)}
              className="w-4 h-4 rounded border border-[var(--border)] accent-[var(--brand)] cursor-pointer" />
            <label htmlFor="newsletter" className="text-sm text-[var(--text-2)] cursor-pointer">Subscribe to newsletter</label>
          </div>

          <div className="flex items-start gap-2">
            <input type="checkbox" id="terms" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border border-[var(--border)] accent-[var(--brand)] cursor-pointer" />
            <label htmlFor="terms" className="text-sm text-[var(--text-2)] cursor-pointer">
              I agree to the <Link href="/terms" target="_blank" className="text-[var(--brand)] hover:underline">Terms of Service</Link> *
            </label>
          </div>

          <div className="flex items-start gap-2">
            <input type="checkbox" id="privacy" checked={agreePrivacy} onChange={e => setAgreePrivacy(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border border-[var(--border)] accent-[var(--brand)] cursor-pointer" />
            <label htmlFor="privacy" className="text-sm text-[var(--text-2)] cursor-pointer">
              I agree to the <Link href="/privacy" target="_blank" className="text-[var(--brand)] hover:underline">Privacy Policy</Link> *
            </label>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <button type="button" onClick={() => setStep(s => s - 1)} disabled={loading}
            className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50">
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={nextStep}
            className="flex-1 btn-primary py-2.5 text-sm font-bold">
            Continue
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading}
            className="flex-1 btn-primary py-2.5 text-sm font-bold disabled:opacity-50">
            {loading ? <><Loader2 size={14} className="animate-spin mr-2" />Creating account…</> : 'Create free account'}
          </button>
        )}
      </div>

      <p className="text-center text-sm text-[var(--text-3)] mt-5">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-[var(--brand)] hover:text-[var(--brand-light)] font-semibold">Sign in</Link>
      </p>
    </div>
  )
}
