'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { completeLogin } from '@/lib/tmdb-account'

export default function CallbackPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const [state, setState] = useState<'working'|'ok'|'denied'|'error'>('working')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const token = sp.get('request_token')
    const approved = sp.get('approved')
    if (approved === 'false') { setState('denied'); return }
    if (!token) { setState('error'); setMsg('Missing request token.'); return }
    completeLogin(token)
      .then(() => { setState('ok'); setTimeout(() => router.push('/movies/account'), 800) })
      .catch((e) => { setState('error'); setMsg(e.message) })
  }, [sp, router])

  return (
    <div className="max-w-md mx-auto px-4 py-32 text-center">
      {state === 'working' && <><Loader2 size={32} className="animate-spin mx-auto text-[var(--brand)] mb-4" /><p className="text-[var(--text-2)]">Signing you in to TMDB…</p></>}
      {state === 'ok' && <><CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-4" /><p className="text-[var(--text)] font-semibold">Signed in! Redirecting…</p></>}
      {state === 'denied' && <><XCircle size={32} className="mx-auto text-amber-400 mb-4" /><p className="text-[var(--text-2)]">Approval was denied. You can try again from your account page.</p></>}
      {state === 'error' && <><XCircle size={32} className="mx-auto text-red-400 mb-4" /><p className="text-[var(--text-2)]">{msg || 'Something went wrong.'}</p></>}
    </div>
  )
}
