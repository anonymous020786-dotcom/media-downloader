'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import OtpInput from '@/components/ui/OtpInput'
import { Loader2, Mail, Smartphone, ShieldCheck, AlertCircle, ChevronRight, KeyRound } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

type Method = 'email' | 'backup_email' | 'totp'

interface Available {
  methods: {
    email:        { available: boolean; value?: string }
    backup_email: { available: boolean; value?: string | null }
    totp:         { available: boolean }
  }
  preferred: Method
}

const META: Record<Method, { label: string; desc: string; Icon: React.ElementType }> = {
  email:        { label: 'Primary email',     desc: 'Send a code to your main inbox',     Icon: Mail },
  backup_email: { label: 'Backup email',      desc: 'Send a code to your backup inbox',   Icon: Mail },
  totp:         { label: 'Authenticator app', desc: 'Enter a code from your app',          Icon: Smartphone },
}

/**
 * Step-up second-factor verification shown after a successful password login
 * when the account has MFA enabled. The user CHOOSES which method to use.
 */
export default function MfaChallenge({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const supabase = createClient()
  const [avail,   setAvail]   = useState<Available | null>(null)
  const [loading, setLoading] = useState(true)
  const [method,  setMethod]  = useState<Method | null>(null)
  const [sent,    setSent]    = useState(false)
  const [code,    setCode]    = useState('')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [manualCode, setManualCode] = useState('')

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

  useEffect(() => {
    api('/methods').then((d: Available) => {
      setAvail(d)
      // Default to preferred if available
      const pref = d.preferred
      if ((pref === 'totp' && d.methods.totp.available) ||
          (pref === 'backup_email' && d.methods.backup_email.available) ||
          pref === 'email') {
        setMethod(pref)
      }
    }).catch(() => setError('Could not load verification methods')).finally(() => setLoading(false))
  }, [api])

  const options: Method[] = avail ? ([
    'email',
    ...(avail.methods.backup_email.available ? ['backup_email'] as Method[] : []),
    ...(avail.methods.totp.available ? ['totp'] as Method[] : []),
  ]) : []

  async function chooseAndSend(m: Method) {
    setMethod(m); setError(''); setCode(''); setSent(false); setUseBackupCode(false)
    if (m === 'totp') { setSent(true); return } // no send needed
    setBusy(true)
    try {
      const r = await api('/challenge/send', 'POST', { method: m })
      setSent(true)
      if (r.sentTo) setError('')
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  async function verify() {
    const value = useBackupCode ? manualCode : code
    if (!value || (!useBackupCode && value.length < 6)) { setError('Enter the code'); return }
    setBusy(true); setError('')
    try {
      const r = await api('/challenge/verify', 'POST', { method, code: value })
      if (!r.valid) { setError(r.error ?? 'Invalid code'); setBusy(false); return }
      onSuccess()
    } catch (e: any) { setError(e.message); setBusy(false) }
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-[var(--brand)]" /></div>
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[var(--brand)]/15 text-[var(--brand)] flex items-center justify-center mx-auto mb-3">
          <ShieldCheck size={22} />
        </div>
        <h2 className="text-xl font-black text-[var(--text)] mb-1">Two-factor verification</h2>
        <p className="text-sm text-[var(--text-3)]">Choose how you&apos;d like to verify it&apos;s you.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 mb-4">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {/* Method chooser */}
      {!sent && (
        <div className="space-y-2">
          {options.map(m => {
            const { label, desc, Icon } = META[m]
            const sub = m === 'email' ? avail?.methods.email.value
                      : m === 'backup_email' ? avail?.methods.backup_email.value
                      : desc
            return (
              <button key={m} type="button" onClick={() => chooseAndSend(m)} disabled={busy}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border)] hover:border-[var(--brand)] hover:bg-[var(--brand)]/5 transition-colors text-left disabled:opacity-50">
                <div className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] text-[var(--brand)] flex items-center justify-center shrink-0"><Icon size={16} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
                  <p className="text-xs text-[var(--text-3)] truncate">{sub ?? desc}</p>
                </div>
                {busy && method === m ? <Loader2 size={15} className="animate-spin text-[var(--text-3)]" /> : <ChevronRight size={15} className="text-[var(--text-3)]" />}
              </button>
            )
          })}
          <button type="button" onClick={onCancel} className="w-full text-xs text-[var(--text-3)] hover:text-[var(--text-2)] pt-2">
            Cancel and sign out
          </button>
        </div>
      )}

      {/* Code entry */}
      {sent && method && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-2)] text-center">
            {method === 'totp'
              ? 'Enter the 6-digit code from your authenticator app'
              : `Enter the 6-digit code we just sent`}
          </p>

          {useBackupCode ? (
            <input type="text" value={manualCode} onChange={e => setManualCode(e.target.value)}
              placeholder="xxxxx-xxxxx" aria-label="Recovery code"
              className="input h-11 text-sm w-full text-center tracking-widest font-mono" />
          ) : (
            <OtpInput value={code} onChange={setCode} disabled={busy} />
          )}

          <button type="button" onClick={verify} disabled={busy}
            className="btn-primary w-full h-11 text-sm font-bold disabled:opacity-50">
            {busy ? <><Loader2 size={14} className="animate-spin mr-2" />Verifying…</> : 'Verify & continue'}
          </button>

          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setSent(false); setMethod(null); setCode(''); setError(''); setUseBackupCode(false) }}
              className="text-[var(--text-3)] hover:text-[var(--text-2)]">← Choose another method</button>
            {method !== 'totp' ? (
              <button type="button" onClick={() => chooseAndSend(method)} disabled={busy}
                className="text-[var(--brand)] hover:underline">Resend code</button>
            ) : (
              <button type="button" onClick={() => { setUseBackupCode(v => !v); setError('') }}
                className="text-[var(--brand)] hover:underline flex items-center gap-1">
                <KeyRound size={11} /> {useBackupCode ? 'Use app code' : 'Use recovery code'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
