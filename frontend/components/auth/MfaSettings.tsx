'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import OtpInput from '@/components/ui/OtpInput'
import {
  Loader2, CheckCircle, ShieldCheck, Mail, Smartphone, Trash2,
  AlertCircle, KeyRound, Copy, RefreshCw, X,
} from 'lucide-react'
import { toast } from 'sonner'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface Methods {
  methods: {
    email:        { available: boolean; value?: string }
    backup_email: { available: boolean; value?: string | null }
    totp:         { available: boolean }
  }
  backupEmailPending: boolean
  mfaEnabled: boolean
  preferred: 'email' | 'backup_email' | 'totp'
}

function Card({ icon, title, desc, children, badge }: {
  icon: React.ReactNode; title: string; desc: string; children: React.ReactNode; badge?: React.ReactNode
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--brand)]/15 text-[var(--brand)] flex items-center justify-center shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--text)]">{title}</h3>
            {badge}
          </div>
          <p className="text-xs text-[var(--text-3)]">{desc}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function VerifiedBadge() {
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 uppercase tracking-wide"><CheckCircle size={9} /> Verified</span>
}
function PendingBadge() {
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 uppercase tracking-wide"><AlertCircle size={9} /> Pending</span>
}
function EnabledBadge() {
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 uppercase tracking-wide"><ShieldCheck size={9} /> Enabled</span>
}

export default function MfaSettings() {
  const supabase = createClient()
  const [data,    setData]    = useState<Methods | null>(null)
  const [loading, setLoading] = useState(true)

  const token = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token ?? '', [supabase])

  const api = useCallback(async (path: string, method = 'GET', body?: any) => {
    const t = await token()
    const r = await fetch(`${API}/api/mfa${path}`, {
      method,
      headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(json.error ?? 'Request failed')
    return json
  }, [token])

  const refresh = useCallback(async () => {
    try { setData(await api('/methods')) } catch { /* ignore */ } finally { setLoading(false) }
  }, [api])

  useEffect(() => { refresh() }, [refresh])

  // ── Backup email state ───────────────────────────────────────────────────────
  const [beEmail,   setBeEmail]   = useState('')
  const [beStage,   setBeStage]   = useState<'idle' | 'sent'>('idle')
  const [beOtp,     setBeOtp]     = useState('')
  const [beBusy,    setBeBusy]    = useState(false)
  const [beEditing, setBeEditing] = useState(false)

  async function sendBackupOtp() {
    setBeBusy(true)
    try {
      const r = await api('/backup-email/send-otp', 'POST', { backup_email: beEmail })
      toast.success(r.message ?? 'Code sent')
      setBeStage('sent')
    } catch (e: any) { toast.error(e.message) } finally { setBeBusy(false) }
  }
  async function verifyBackupOtp() {
    setBeBusy(true)
    try {
      const r = await api('/backup-email/verify', 'POST', { otp: beOtp })
      if (!r.valid) { toast.error(r.error ?? 'Invalid code'); return }
      toast.success('Backup email verified')
      setBeStage('idle'); setBeOtp(''); setBeEmail(''); setBeEditing(false)
      refresh()
    } catch (e: any) { toast.error(e.message) } finally { setBeBusy(false) }
  }
  async function removeBackup() {
    if (!confirm('Remove your backup email?')) return
    try { await api('/backup-email', 'DELETE'); toast.success('Backup email removed'); refresh() }
    catch (e: any) { toast.error(e.message) }
  }

  // ── TOTP state ───────────────────────────────────────────────────────────────
  const [totpStage, setTotpStage] = useState<'idle' | 'setup' | 'disable'>('idle')
  const [qr,        setQr]        = useState('')
  const [secret,    setSecret]    = useState('')
  const [totpCode,  setTotpCode]  = useState('')
  const [totpBusy,  setTotpBusy]  = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])

  async function startTotpSetup() {
    setTotpBusy(true)
    try {
      const r = await api('/totp/setup', 'POST')
      setQr(r.qr); setSecret(r.secret); setTotpStage('setup'); setTotpCode('')
    } catch (e: any) { toast.error(e.message) } finally { setTotpBusy(false) }
  }
  async function enableTotp() {
    setTotpBusy(true)
    try {
      const r = await api('/totp/enable', 'POST', { code: totpCode })
      if (!r.valid) { toast.error(r.error ?? 'Invalid code'); return }
      setBackupCodes(r.backupCodes ?? [])
      setTotpStage('idle'); setTotpCode(''); setQr(''); setSecret('')
      toast.success('Authenticator enabled')
      refresh()
    } catch (e: any) { toast.error(e.message) } finally { setTotpBusy(false) }
  }
  async function disableTotp() {
    setTotpBusy(true)
    try {
      const r = await api('/totp/disable', 'POST', { code: totpCode })
      if (!r.valid) { toast.error(r.error ?? 'Invalid code'); return }
      setTotpStage('idle'); setTotpCode('')
      toast.success('Authenticator disabled')
      refresh()
    } catch (e: any) { toast.error(e.message) } finally { setTotpBusy(false) }
  }
  async function regenerateCodes() {
    const code = prompt('Enter a current code from your authenticator app to regenerate recovery codes:')
    if (!code) return
    try {
      const r = await api('/totp/regenerate-codes', 'POST', { code })
      if (!r.valid) { toast.error(r.error ?? 'Invalid code'); return }
      setBackupCodes(r.backupCodes ?? [])
      toast.success('New recovery codes generated')
    } catch (e: any) { toast.error(e.message) }
  }

  async function setPreferred(method: 'email' | 'backup_email' | 'totp') {
    try { await api('/preferred', 'PATCH', { method }); toast.success('Preferred method updated'); refresh() }
    catch (e: any) { toast.error(e.message) }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[var(--brand)]" /></div>
  }
  if (!data) return null

  const be    = data.methods.backup_email
  const totp  = data.methods.totp

  return (
    <div className="space-y-5">
      {/* Recovery codes modal */}
      {backupCodes.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setBackupCodes([])}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2"><KeyRound size={16} className="text-amber-400" /> Recovery Codes</h3>
              <button type="button" onClick={() => setBackupCodes([])} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={16} /></button>
            </div>
            <p className="text-xs text-[var(--text-3)] mb-4">Save these somewhere safe. Each code can be used once if you lose access to your authenticator app. They will not be shown again.</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {backupCodes.map(c => (
                <code key={c} className="text-sm font-mono text-[var(--text)] bg-[var(--bg-hover)] rounded-lg px-3 py-2 text-center tracking-wider">{c}</code>
              ))}
            </div>
            <button type="button"
              onClick={() => { navigator.clipboard.writeText(backupCodes.join('\n')); toast.success('Copied') }}
              className="btn-primary w-full h-10 text-sm font-semibold flex items-center justify-center gap-2">
              <Copy size={13} /> Copy all codes
            </button>
          </div>
        </div>
      )}

      {/* ── Backup Email ─────────────────────────────────────────────────────── */}
      <Card icon={<Mail size={16} />} title="Backup Email" badge={be.available ? <VerifiedBadge /> : data.backupEmailPending ? <PendingBadge /> : undefined}
        desc="A secondary email for receiving verification codes if you lose access to your primary inbox.">
        {be.available && !beEditing ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text)]">{be.value}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setBeEditing(true); setBeStage('idle'); setBeEmail('') }}
                className="text-xs font-semibold border border-[var(--border)] px-3 py-1.5 rounded-lg text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-colors">Change</button>
              <button type="button" onClick={removeBackup}
                className="text-xs font-semibold border border-red-800/40 px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-1"><Trash2 size={11} /> Remove</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {beStage === 'idle' ? (
              <div className="flex gap-2">
                <input type="email" value={beEmail} onChange={e => setBeEmail(e.target.value)} placeholder="backup@example.com"
                  aria-label="Backup email" className="input h-10 text-sm flex-1" />
                <button type="button" onClick={sendBackupOtp} disabled={beBusy || !beEmail}
                  className="btn-primary px-4 h-10 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
                  {beBusy ? <Loader2 size={13} className="animate-spin" /> : null} Send code
                </button>
                {beEditing && <button type="button" onClick={() => setBeEditing(false)} className="px-3 h-10 text-sm border border-[var(--border)] rounded-xl text-[var(--text-3)]">Cancel</button>}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-3)]">Enter the 6-digit code sent to <strong className="text-[var(--text-2)]">{beEmail}</strong></p>
                <OtpInput value={beOtp} onChange={setBeOtp} disabled={beBusy} />
                <div className="flex gap-2">
                  <button type="button" onClick={verifyBackupOtp} disabled={beBusy || beOtp.length < 6}
                    className="btn-primary px-4 h-10 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
                    {beBusy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Verify
                  </button>
                  <button type="button" onClick={sendBackupOtp} disabled={beBusy}
                    className="px-4 h-10 text-sm font-semibold border border-[var(--border)] rounded-xl text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-colors">Resend</button>
                  <button type="button" onClick={() => { setBeStage('idle'); setBeOtp('') }}
                    className="px-4 h-10 text-sm font-semibold border border-[var(--border)] rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-hover)] transition-colors">Back</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Authenticator App (TOTP) ─────────────────────────────────────────── */}
      <Card icon={<Smartphone size={16} />} title="Authenticator App" badge={totp.available ? <EnabledBadge /> : undefined}
        desc="Use Google Authenticator, Authy, or 1Password to generate time-based codes.">
        {totp.available ? (
          totpStage === 'disable' ? (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-3)]">Enter a current code from your authenticator app to disable it.</p>
              <OtpInput value={totpCode} onChange={setTotpCode} disabled={totpBusy} />
              <div className="flex gap-2">
                <button type="button" onClick={disableTotp} disabled={totpBusy || totpCode.length < 6}
                  className="px-4 h-10 text-sm font-semibold rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                  {totpBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Disable
                </button>
                <button type="button" onClick={() => { setTotpStage('idle'); setTotpCode('') }}
                  className="px-4 h-10 text-sm font-semibold border border-[var(--border)] rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-hover)] transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={regenerateCodes}
                className="px-4 h-10 text-sm font-semibold border border-[var(--border)] rounded-xl text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1.5">
                <RefreshCw size={13} /> Regenerate recovery codes
              </button>
              <button type="button" onClick={() => { setTotpStage('disable'); setTotpCode('') }}
                className="px-4 h-10 text-sm font-semibold border border-red-800/40 rounded-xl text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-1.5">
                <Trash2 size={13} /> Disable authenticator
              </button>
            </div>
          )
        ) : totpStage === 'setup' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-5 items-center">
              {qr && <img src={qr} alt="TOTP QR code" className="w-40 h-40 rounded-xl bg-white p-2 shrink-0" />}
              <div className="space-y-2 min-w-0">
                <p className="text-xs text-[var(--text-3)]">1. Scan this QR code with your authenticator app.</p>
                <p className="text-xs text-[var(--text-3)]">2. Or enter this key manually:</p>
                <code className="block text-xs font-mono text-[var(--text-2)] bg-[var(--bg-hover)] rounded-lg px-3 py-2 break-all">{secret}</code>
                <button type="button" onClick={() => { navigator.clipboard.writeText(secret); toast.success('Key copied') }}
                  className="text-xs text-[var(--brand)] flex items-center gap-1"><Copy size={11} /> Copy key</button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-3)]">3. Enter the 6-digit code from your app:</p>
              <OtpInput value={totpCode} onChange={setTotpCode} disabled={totpBusy} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={enableTotp} disabled={totpBusy || totpCode.length < 6}
                className="btn-primary px-4 h-10 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
                {totpBusy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Enable
              </button>
              <button type="button" onClick={() => { setTotpStage('idle'); setQr(''); setSecret(''); setTotpCode('') }}
                className="px-4 h-10 text-sm font-semibold border border-[var(--border)] rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-hover)] transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={startTotpSetup} disabled={totpBusy}
            className="btn-primary px-4 h-10 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
            {totpBusy ? <Loader2 size={13} className="animate-spin" /> : <Smartphone size={13} />} Set up authenticator
          </button>
        )}
      </Card>

      {/* ── Preferred verification method ────────────────────────────────────── */}
      {(be.available || totp.available) && (
        <Card icon={<ShieldCheck size={16} />} title="Preferred Verification Method"
          desc="When verification is required, this method is offered first. You can always switch at the prompt.">
          <div className="space-y-2">
            {([
              { id: 'email',        label: 'Primary email',     sub: data.methods.email.value,        avail: true },
              { id: 'backup_email', label: 'Backup email',      sub: be.value ?? undefined,           avail: be.available },
              { id: 'totp',         label: 'Authenticator app', sub: 'Time-based codes',              avail: totp.available },
            ] as const).filter(m => m.avail).map(m => (
              <label key={m.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${data.preferred === m.id ? 'border-[var(--brand)] bg-[var(--brand)]/5' : 'border-[var(--border)] hover:bg-[var(--bg-hover)]'}`}>
                <input type="radio" name="preferred-mfa" checked={data.preferred === m.id} onChange={() => setPreferred(m.id)}
                  className="accent-[var(--brand)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">{m.label}</p>
                  {m.sub && <p className="text-xs text-[var(--text-3)] truncate">{m.sub}</p>}
                </div>
                {data.preferred === m.id && <CheckCircle size={15} className="text-[var(--brand)]" />}
              </label>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
