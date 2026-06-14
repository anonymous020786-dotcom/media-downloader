'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthContext'
import { createClient } from '@/lib/supabase/client'
import {
  User, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle,
  AlertCircle, ShieldCheck, LogOut, Trash2, ArrowLeft,
  Camera, Globe, Link2, Briefcase, Settings, Shield, Flame,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import AvatarUpload from '@/components/ui/AvatarUpload'
import OtpInput from '@/components/ui/OtpInput'
import MfaSettings from '@/components/auth/MfaSettings'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const STORAGE_PROVIDER = process.env.NEXT_PUBLIC_STORAGE_PROVIDER ?? 'supabase'

type Tab = 'profile' | 'security' | 'preferences' | 'danger'

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'profile',     label: 'Profile',      Icon: User },
  { id: 'security',    label: 'Security',     Icon: Shield },
  { id: 'preferences', label: 'Preferences',  Icon: Settings },
  { id: 'danger',      label: 'Danger Zone',  Icon: Flame },
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-bold text-[var(--text)]">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-[var(--text-2)]">{label}</label>
      {children}
    </div>
  )
}

export default function AccountPage() {
  const { user, role, isLoaded, isSignedIn, signOut } = useAuth()
  const router  = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('profile')

  // ── Profile state ────────────────────────────────────────────────────────────
  const [profile,      setProfile]      = useState<Record<string, any>>({})
  const [avatarFile,   setAvatarFile]   = useState<File | null>(null)
  const [avatarLoad,   setAvatarLoad]   = useState(false)
  const [savingProfile,setSavingProfile]= useState(false)

  // ── Security state ───────────────────────────────────────────────────────────
  const [curPass,      setCurPass]      = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [confirmPass,  setConfirmPass]  = useState('')
  const [showCur,      setShowCur]      = useState(false)
  const [showNew,      setShowNew]      = useState(false)
  const [showConf,     setShowConf]     = useState(false)
  const [savingPass,   setSavingPass]   = useState(false)
  const [identities,   setIdentities]   = useState<any[]>([])
  const [linkLoading,  setLinkLoading]  = useState('')
  // OTP password reset
  const [otpResetMode, setOtpResetMode] = useState(false)
  const [otpSent,      setOtpSent]      = useState(false)
  const [otp,          setOtp]          = useState('')
  const [otpLoading,   setOtpLoading]   = useState(false)
  const [resetPass,    setResetPass]    = useState('')
  const [resetConf,    setResetConf]    = useState('')

  // ── Preferences state ────────────────────────────────────────────────────────
  const [language,     setLanguage]     = useState('en')
  const [newsletter,   setNewsletter]   = useState(false)
  const [savingPrefs,  setSavingPrefs]  = useState(false)

  // ── Danger state ─────────────────────────────────────────────────────────────
  const [deleteConfirm,  setDeleteConfirm]  = useState('')
  const [showDeleteModal,setShowDeleteModal]= useState(false)
  const [deleting,       setDeleting]       = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { router.replace('/sign-in?redirect_url=/account'); return }
    fetchProfile()
    fetchIdentities()
  }, [isLoaded, isSignedIn])

  async function fetchProfile() {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const r     = await fetch(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) return
      const data = await r.json()
      setProfile(data)
      setLanguage(data.language ?? 'en')
      setNewsletter(!!data.newsletter_subscribed)
    } catch { /* non-critical */ }
  }

  async function fetchIdentities() {
    const { data } = await supabase.auth.getUserIdentities()
    setIdentities(data?.identities ?? [])
  }

  async function patchProfile(updates: Record<string, any>) {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const r     = await fetch(`${API}/api/users/me`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(updates),
    })
    if (!r.ok) {
      const d = await r.json()
      throw new Error(d.error ?? 'Failed to save')
    }
  }

  async function handleAvatarChange(file: File) {
    setAvatarFile(file)
    setAvatarLoad(true)
    try {
      if (STORAGE_PROVIDER === 'supabase') {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const { data: up, error: upErr } = await supabase.storage.from('avatars').upload(`${crypto.randomUUID()}.${ext}`, file, { upsert: true })
        if (upErr) throw new Error(upErr.message)
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(up.path)
        await patchProfile({ avatar_url: publicUrl })
        setProfile(p => ({ ...p, avatar_url: publicUrl }))
        toast.success('Avatar updated')
      } else {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        const form  = new FormData()
        form.append('avatar', file)
        const r    = await fetch(`${API}/api/upload/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
        const data = await r.json()
        if (!r.ok) throw new Error(data.error)
        setProfile(p => ({ ...p, avatar_url: data.url }))
        toast.success('Avatar updated')
      }
    } catch (e: any) {
      toast.error(e.message)
    }
    setAvatarLoad(false)
  }

  async function handleAvatarRemove() {
    setAvatarLoad(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      await fetch(`${API}/api/upload/avatar`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      setProfile(p => ({ ...p, avatar_url: null }))
      setAvatarFile(null)
      toast.success('Avatar removed')
    } catch (e: any) {
      toast.error(e.message)
    }
    setAvatarLoad(false)
  }

  async function saveProfile() {
    setSavingProfile(true)
    try {
      await patchProfile({
        name:           profile.name,
        username:       profile.username,
        phone:          profile.phone,
        dob:            profile.dob,
        gender:         profile.gender,
        bio:            profile.bio,
        country:        profile.country,
        state_region:   profile.state_region,
        city:           profile.city,
        postal_code:    profile.postal_code,
        address_line1:  profile.address_line1,
        address_line2:  profile.address_line2,
        twitter_handle: profile.twitter_handle,
        instagram_handle: profile.instagram_handle,
        youtube_channel:  profile.youtube_channel,
        linkedin_profile: profile.linkedin_profile,
        github_username:  profile.github_username,
        microsoft_handle: profile.microsoft_handle,
        website:        profile.website,
        occupation:     profile.occupation,
        company:        profile.company,
        industry:       profile.industry,
      })
      toast.success('Profile saved')
    } catch (e: any) {
      toast.error(e.message)
    }
    setSavingProfile(false)
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPass.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (newPass !== confirmPass) { toast.error('Passwords do not match'); return }
    setSavingPass(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setSavingPass(false)
    if (error) { toast.error(error.message); return }
    toast.success('Password updated')
    setCurPass(''); setNewPass(''); setConfirmPass('')
  }

  async function handleSendOtp() {
    setOtpLoading(true)
    try {
      const r    = await fetch(`${API}/api/otp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user?.email, type: 'reset' }) })
      const data = await r.json()
      if (!data.success) { toast.error(data.error ?? 'Failed to send OTP'); return }
      setOtpSent(true)
      toast.success(`OTP sent to ${user?.email}`)
    } catch (e: any) { toast.error(e.message) }
    setOtpLoading(false)
  }

  async function handleOtpReset() {
    if (otp.length < 6)          { toast.error('Enter the 6-digit OTP'); return }
    if (resetPass.length < 8)    { toast.error('Password must be at least 8 characters'); return }
    if (resetPass !== resetConf) { toast.error('Passwords do not match'); return }
    setOtpLoading(true)
    try {
      const vr    = await fetch(`${API}/api/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user?.email, otp, type: 'reset' }) })
      const vdata = await vr.json()
      if (!vdata.valid) { toast.error(vdata.error ?? 'Invalid OTP'); setOtpLoading(false); return }
      const { error } = await supabase.auth.updateUser({ password: resetPass })
      if (error) { toast.error(error.message); setOtpLoading(false); return }
      toast.success('Password updated via OTP')
      setOtpResetMode(false); setOtpSent(false); setOtp(''); setResetPass(''); setResetConf('')
    } catch (e: any) { toast.error(e.message) }
    setOtpLoading(false)
  }

  async function handleUnlink(identity: any) {
    const { error } = await supabase.auth.unlinkIdentity(identity)
    if (error) { toast.error(error.message); return }
    toast.success(`Unlinked ${identity.provider}`)
    fetchIdentities()
  }

  async function handleLink(provider: 'google' | 'github' | 'azure') {
    setLinkLoading(provider)
    const { error } = await supabase.auth.linkIdentity({ provider })
    if (error) toast.error(error.message)
    setLinkLoading('')
  }

  async function savePreferences() {
    setSavingPrefs(true)
    try {
      await patchProfile({ language, newsletter_subscribed: newsletter ? 1 : 0 })
      toast.success('Preferences saved')
    } catch (e: any) { toast.error(e.message) }
    setSavingPrefs(false)
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE MY ACCOUNT') {
      toast.error('Type DELETE MY ACCOUNT exactly to confirm'); return
    }
    setDeleting(true)
    await signOut()
    toast.info('Account deletion requested. Contact support to complete removal.')
    router.push('/')
  }

  async function handleSignOutAll() {
    await supabase.auth.signOut({ scope: 'global' })
    toast.success('Signed out from all devices')
    router.push('/')
  }

  function p(field: string) { return profile[field] ?? '' }
  function set(field: string) { return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setProfile((prev: Record<string, any>) => ({ ...prev, [field]: e.target.value })) }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[var(--brand)]" />
      </div>
    )
  }

  const isOAuth = !!user?.app_metadata?.provider && user.app_metadata.provider !== 'email'
  const initials = (user?.user_metadata?.full_name ?? user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/" className="p-2 rounded-xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">Account Settings</h1>
          <p className="text-sm text-[var(--text-3)]">{user?.email}</p>
        </div>
        {role !== 'user' && (
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand)]/10 text-[var(--brand)] text-xs font-bold uppercase tracking-wide">
            <ShieldCheck size={11} /> {role.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border border-[var(--border)] rounded-xl p-1 bg-[var(--bg-card)]">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === id ? 'bg-[var(--brand)] text-white' : 'text-[var(--text-2)] hover:bg-[var(--bg-hover)]'
            } ${id === 'danger' && tab !== 'danger' ? 'hover:text-red-400' : ''}`}>
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ─────────────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="space-y-5">
          {/* Avatar */}
          <Section title="Profile Photo">
            <div className="flex items-center gap-6">
              <AvatarUpload
                value={profile.avatar_url}
                initials={initials}
                size="lg"
                loading={avatarLoad}
                onChange={handleAvatarChange}
                onRemove={handleAvatarRemove}
              />
              <div>
                <p className="text-sm text-[var(--text)] font-semibold mb-1">{p('name') || user?.email}</p>
                <p className="text-xs text-[var(--text-3)]">JPG, PNG or GIF. Max 5 MB.</p>
              </div>
            </div>
          </Section>

          {/* Personal Info */}
          <Section title="Personal Information">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name" htmlFor="acc-first">
                <input id="acc-first" type="text" value={p('name').split(' ')[0] ?? ''}
                  onChange={e => setProfile((prev: Record<string, any>) => ({ ...prev, name: (e.target.value + ' ' + (prev.name ?? '').split(' ').slice(1).join(' ')).trim() }))}
                  placeholder="First name" className="input h-10 text-sm w-full" />
              </Field>
              <Field label="Last name" htmlFor="acc-last">
                <input id="acc-last" type="text" value={p('name').split(' ').slice(1).join(' ')}
                  onChange={e => setProfile((prev: Record<string, any>) => ({ ...prev, name: (((prev.name ?? '').split(' ')[0] ?? '') + ' ' + e.target.value).trim() }))}
                  placeholder="Last name" className="input h-10 text-sm w-full" />
              </Field>
              <Field label="Username" htmlFor="acc-username">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-sm">@</span>
                  <input id="acc-username" type="text" value={p('username')} onChange={set('username')} placeholder="username" className="input pl-7 h-10 text-sm w-full" />
                </div>
              </Field>
              <Field label="Phone" htmlFor="acc-phone">
                <input id="acc-phone" type="tel" value={p('phone')} onChange={set('phone')} placeholder="+1 555 000 0000" className="input h-10 text-sm w-full" />
              </Field>
              <Field label="Date of birth" htmlFor="acc-dob">
                <input id="acc-dob" type="date" value={p('dob')} onChange={set('dob')} title="Date of birth" placeholder="YYYY-MM-DD" className="input h-10 text-sm w-full" />
              </Field>
              <Field label="Gender" htmlFor="acc-gender">
                <select id="acc-gender" aria-label="Gender" value={p('gender')} onChange={set('gender')} className="input h-10 text-sm w-full">
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </Field>
            </div>
            <div className="mt-4 space-y-1">
              <Field label={`Bio (${(p('bio') ?? '').length}/250)`} htmlFor="acc-bio">
                <textarea id="acc-bio" value={p('bio')} onChange={e => setProfile((prev: Record<string, any>) => ({ ...prev, bio: e.target.value.slice(0, 250) }))} rows={3} placeholder="A short bio about yourself…" className="input h-auto py-2.5 text-sm w-full resize-none" />
              </Field>
            </div>
          </Section>

          {/* Location */}
          <Section title="Location">
            <div className="space-y-4">
              <Field label="Country" htmlFor="acc-country">
                <select id="acc-country" aria-label="Country" value={p('country')} onChange={set('country')} className="input h-10 text-sm w-full">
                  <option value="">Select country</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="State / Region" htmlFor="acc-state">
                  <input id="acc-state" type="text" value={p('state_region')} onChange={set('state_region')} placeholder="California" className="input h-10 text-sm w-full" />
                </Field>
                <Field label="City" htmlFor="acc-city">
                  <input id="acc-city" type="text" value={p('city')} onChange={set('city')} placeholder="San Francisco" className="input h-10 text-sm w-full" />
                </Field>
                <Field label="Postal code" htmlFor="acc-postal">
                  <input id="acc-postal" type="text" value={p('postal_code')} onChange={set('postal_code')} placeholder="94102" className="input h-10 text-sm w-full" />
                </Field>
              </div>
              <Field label="Address line 1" htmlFor="acc-addr1">
                <input id="acc-addr1" type="text" value={p('address_line1')} onChange={set('address_line1')} placeholder="123 Main St" className="input h-10 text-sm w-full" />
              </Field>
              <Field label="Address line 2" htmlFor="acc-addr2">
                <input id="acc-addr2" type="text" value={p('address_line2')} onChange={set('address_line2')} placeholder="Apt 4B" className="input h-10 text-sm w-full" />
              </Field>
            </div>
          </Section>

          {/* Social Media */}
          <Section title="Social Media">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Website" htmlFor="acc-website">
                <input id="acc-website" type="url" value={p('website')} onChange={set('website')} placeholder="https://yoursite.com" className="input h-10 text-sm w-full" />
              </Field>
              <Field label="Twitter / X" htmlFor="acc-twitter">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-sm">@</span>
                  <input id="acc-twitter" type="text" value={p('twitter_handle')} onChange={set('twitter_handle')} placeholder="username" className="input pl-7 h-10 text-sm w-full" />
                </div>
              </Field>
              <Field label="Instagram" htmlFor="acc-instagram">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-sm">@</span>
                  <input id="acc-instagram" type="text" value={p('instagram_handle')} onChange={set('instagram_handle')} placeholder="username" className="input pl-7 h-10 text-sm w-full" />
                </div>
              </Field>
              <Field label="YouTube Channel" htmlFor="acc-youtube">
                <input id="acc-youtube" type="url" value={p('youtube_channel')} onChange={set('youtube_channel')} placeholder="https://youtube.com/@…" className="input h-10 text-sm w-full" />
              </Field>
              <Field label="LinkedIn Profile" htmlFor="acc-linkedin">
                <input id="acc-linkedin" type="url" value={p('linkedin_profile')} onChange={set('linkedin_profile')} placeholder="https://linkedin.com/in/…" className="input h-10 text-sm w-full" />
              </Field>
              <Field label="GitHub Username" htmlFor="acc-github">
                <input id="acc-github" type="text" value={p('github_username')} onChange={set('github_username')} placeholder="octocat" className="input h-10 text-sm w-full" />
              </Field>
              <Field label="Microsoft / Teams Handle" htmlFor="acc-ms">
                <input id="acc-ms" type="text" value={p('microsoft_handle')} onChange={set('microsoft_handle')} placeholder="handle" className="input h-10 text-sm w-full" />
              </Field>
            </div>
          </Section>

          {/* Professional */}
          <Section title="Professional">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Occupation" htmlFor="acc-occ">
                <input id="acc-occ" type="text" value={p('occupation')} onChange={set('occupation')} placeholder="Software Engineer" className="input h-10 text-sm w-full" />
              </Field>
              <Field label="Company" htmlFor="acc-company">
                <input id="acc-company" type="text" value={p('company')} onChange={set('company')} placeholder="Acme Corp" className="input h-10 text-sm w-full" />
              </Field>
              <Field label="Industry" htmlFor="acc-industry">
                <select id="acc-industry" aria-label="Industry" value={p('industry')} onChange={set('industry')} className="input h-10 text-sm w-full">
                  <option value="">Select industry</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          <button type="button" onClick={saveProfile} disabled={savingProfile}
            className="btn-primary w-full h-11 text-sm font-bold disabled:opacity-50">
            {savingProfile ? <><Loader2 size={14} className="animate-spin mr-2" />Saving…</> : 'Save Profile'}
          </button>
        </div>
      )}

      {/* ── SECURITY TAB ────────────────────────────────────────────────────── */}
      {tab === 'security' && (
        <div className="space-y-5">
          {/* Change password */}
          {!isOAuth && (
            <Section title="Change Password">
              {!otpResetMode ? (
                <form onSubmit={savePassword} className="space-y-3">
                  <Field label="Current password" htmlFor="cur-pass">
                    <div className="relative">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                      <input id="cur-pass" type={showCur ? 'text' : 'password'} value={curPass} onChange={e => setCurPass(e.target.value)}
                        placeholder="Current password" autoComplete="current-password" className="input pl-9 pr-10 h-10 text-sm w-full" />
                      <button type="button" onClick={() => setShowCur(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]">
                        {showCur ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="New password" htmlFor="new-pass">
                    <div className="relative">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                      <input id="new-pass" type={showNew ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)}
                        placeholder="New password (min 8 chars)" autoComplete="new-password" className="input pl-9 pr-10 h-10 text-sm w-full" />
                      <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]">
                        {showNew ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm new password" htmlFor="conf-pass">
                    <div className="relative">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                      <input id="conf-pass" type={showConf ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                        placeholder="Confirm new password" autoComplete="new-password" className="input pl-9 pr-10 h-10 text-sm w-full" />
                      <button type="button" onClick={() => setShowConf(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]">
                        {showConf ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </Field>
                  <div className="flex gap-3">
                    <button type="submit" disabled={savingPass || !newPass}
                      className="btn-primary px-4 h-10 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
                      {savingPass ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Update password
                    </button>
                    <button type="button" onClick={() => setOtpResetMode(true)}
                      className="px-4 h-10 text-sm font-semibold border border-[var(--border)] rounded-xl text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-colors">
                      Reset via OTP
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-[var(--text-2)]">We&apos;ll send a one-time code to <strong>{user?.email}</strong>.</p>
                  {!otpSent ? (
                    <button type="button" onClick={handleSendOtp} disabled={otpLoading}
                      className="btn-primary px-4 h-10 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
                      {otpLoading ? <Loader2 size={13} className="animate-spin" /> : null} Send OTP
                    </button>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-[var(--text-2)] block">Enter OTP</label>
                        <OtpInput value={otp} onChange={setOtp} disabled={otpLoading} />
                      </div>
                      <Field label="New password" htmlFor="otp-new-pass">
                        <input id="otp-new-pass" type="password" value={resetPass} onChange={e => setResetPass(e.target.value)} placeholder="New password" autoComplete="new-password" className="input h-10 text-sm w-full" />
                      </Field>
                      <Field label="Confirm new password" htmlFor="otp-conf-pass">
                        <input id="otp-conf-pass" type="password" value={resetConf} onChange={e => setResetConf(e.target.value)} placeholder="Confirm" autoComplete="new-password" className="input h-10 text-sm w-full" />
                      </Field>
                      <div className="flex gap-3">
                        <button type="button" onClick={handleOtpReset} disabled={otpLoading}
                          className="btn-primary px-4 h-10 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
                          {otpLoading ? <Loader2 size={13} className="animate-spin" /> : null} Update password
                        </button>
                        <button type="button" onClick={() => { setOtpResetMode(false); setOtpSent(false); setOtp('') }}
                          className="px-4 h-10 text-sm font-semibold border border-[var(--border)] rounded-xl text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-colors">
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Connected identities */}
          <Section title="Connected Accounts">
            {identities.length === 0 ? (
              <p className="text-sm text-[var(--text-3)]">No connected accounts.</p>
            ) : (
              <ul className="space-y-3">
                {identities.map(identity => (
                  <li key={identity.id} className="flex items-center justify-between p-3 bg-[var(--bg-hover)] rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)] capitalize">{identity.provider}</p>
                      <p className="text-xs text-[var(--text-3)]">Connected {new Date(identity.created_at).toLocaleDateString()}</p>
                    </div>
                    <button type="button" onClick={() => handleUnlink(identity)}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-800/40 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors">
                      Unlink
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-2 flex-wrap">
              <p className="text-xs text-[var(--text-3)] w-full mb-1">Link another account:</p>
              {(['google', 'github', 'azure'] as const).map(provider => (
                <button key={provider} type="button" onClick={() => handleLink(provider)} disabled={!!linkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50 capitalize">
                  {linkLoading === provider ? <Loader2 size={11} className="animate-spin" /> : <Link2 size={11} />}
                  {provider === 'azure' ? 'Microsoft' : provider}
                </button>
              ))}
            </div>
          </Section>

          {/* Multi-factor authentication: backup email + authenticator app */}
          <MfaSettings />
        </div>
      )}

      {/* ── PREFERENCES TAB ─────────────────────────────────────────────────── */}
      {tab === 'preferences' && (
        <Section title="Preferences">
          <div className="space-y-5">
            <Field label="Language" htmlFor="pref-lang">
              <select id="pref-lang" aria-label="Language preference" value={language} onChange={e => setLanguage(e.target.value)} className="input h-10 text-sm w-full">
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>

            <div className="flex items-center justify-between p-3 bg-[var(--bg-hover)] rounded-xl">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">Newsletter</p>
                <p className="text-xs text-[var(--text-3)]">Receive product updates and tips via email</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={newsletter ? 'true' : 'false'}
                aria-label="Toggle newsletter subscription"
                title={newsletter ? 'Unsubscribe from newsletter' : 'Subscribe to newsletter'}
                onClick={() => setNewsletter(v => !v)}
                className={`relative w-10 h-6 rounded-full transition-colors ${newsletter ? 'bg-[var(--brand)]' : 'bg-[var(--border)]'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${newsletter ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <button type="button" onClick={savePreferences} disabled={savingPrefs}
              className="btn-primary px-6 h-10 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
              {savingPrefs ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Save preferences
            </button>
          </div>
        </Section>
      )}

      {/* ── DANGER ZONE TAB ─────────────────────────────────────────────────── */}
      {tab === 'danger' && (
        <div className="space-y-5">
          {/* Sign out all devices */}
          <Section title="Session Management">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text)] font-semibold">Sign out all devices</p>
                <p className="text-xs text-[var(--text-3)]">Invalidate all active sessions everywhere</p>
              </div>
              <button type="button" onClick={handleSignOutAll}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors">
                <LogOut size={14} /> Sign out all
              </button>
            </div>
          </Section>

          {/* Delete account */}
          <Section title="Danger Zone">
            <div className="space-y-4">
              <div className="p-4 bg-red-900/10 border border-red-800/30 rounded-xl">
                <p className="text-sm text-red-400 font-semibold mb-1">Delete account permanently</p>
                <p className="text-xs text-[var(--text-3)]">Once deleted, all your data will be permanently removed. This action cannot be undone.</p>
              </div>
              <button type="button" onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-800/50 text-sm text-red-400 hover:bg-red-900/20 transition-colors">
                <Trash2 size={14} /> Delete my account
              </button>
            </div>
          </Section>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Delete account</h3>
                <p className="text-xs text-[var(--text-3)]">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-2)] mb-4">
              To confirm, type <strong className="text-red-400 font-mono">DELETE MY ACCOUNT</strong> below:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              aria-label="Confirm account deletion"
              className="input h-10 text-sm w-full mb-4 font-mono"
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                className="flex-1 py-2 border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleDeleteAccount} disabled={deleting || deleteConfirm !== 'DELETE MY ACCOUNT'}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
