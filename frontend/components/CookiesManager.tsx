'use client'
import { useEffect, useState } from 'react'
import { Cookie, Plus, Trash2, Loader2, Check } from 'lucide-react'
import {
  fetchCookies, saveCookies, toggleCookies, deleteCookies,
  type SavedCookie,
} from '@/lib/api'

/**
 * Per-site cookie store manager.
 * Lets a signed-in user save a Netscape cookies.txt (or browser "Cookie:" header)
 * once per domain. The download pipeline auto-applies the matching domain's cookies
 * on every job — so login-walled / members-only / age-gated sites keep working
 * without re-pasting. `initialDomain` pre-fills the form from the current URL.
 */
export default function CookiesManager({ initialDomain = '' }: { initialDomain?: string }) {
  const [list, setList]     = useState<SavedCookie[]>([])
  const [open, setOpen]     = useState(false)
  const [domain, setDomain] = useState(initialDomain)
  const [label, setLabel]   = useState('')
  const [text, setText]     = useState('')
  const [busy, setBusy]     = useState<string | null>(null)
  const [err, setErr]       = useState<string | null>(null)

  async function reload() {
    try { setList(await fetchCookies()) } catch { /* signed out / backend down */ }
  }
  useEffect(() => { reload() }, [])
  useEffect(() => { if (initialDomain) setDomain(initialDomain) }, [initialDomain])

  async function add() {
    if (!domain.trim()) { setErr('Enter a site domain (e.g. xhamster.com)'); return }
    if (!text.trim())   { setErr('Paste the cookies first'); return }
    setBusy('add'); setErr(null)
    try {
      await saveCookies(domain.trim(), text, label.trim() || undefined)
      setText(''); setLabel('')
      await reload()
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(null) }
  }

  return (
    <div className="w-full">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#161b27] border border-[#21293a] text-slate-400 hover:text-amber-300">
        <Cookie size={12} /> Saved site cookies{list.length ? ` (${list.length})` : ''}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-[#21293a] bg-[#10141d] p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Saved cookies (auto-applied per site)</p>
          {list.length === 0 && <p className="text-[11px] text-slate-600">No saved cookies yet.</p>}
          {list.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-xs">
              <button type="button" title={c.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                onClick={async () => { await toggleCookies(c.id, !c.enabled); reload() }}
                className={`shrink-0 ${c.enabled ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-400'}`}>
                <Check size={13} />
              </button>
              <span className="flex-1 truncate text-slate-300">
                {c.domain}
                {c.label && <span className="text-slate-500"> · {c.label}</span>}
                <span className="text-slate-600"> · {c.count} cookie{c.count === 1 ? '' : 's'}</span>
              </span>
              <button type="button" onClick={async () => { await deleteCookies(c.id); reload() }}
                className="text-slate-600 hover:text-rose-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          <div className="pt-2 border-t border-[#21293a] space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Save cookies for a site</p>
            <div className="flex gap-2">
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="site domain (e.g. xhamster.com)"
                className="flex-1 bg-[#161b27] border border-[#21293a] rounded-lg px-2 py-1 text-xs text-slate-200 font-mono outline-none" />
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="label (optional)"
                className="w-32 bg-[#161b27] border border-[#21293a] rounded-lg px-2 py-1 text-xs text-slate-200 outline-none" />
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
              placeholder={"# Netscape HTTP Cookie File\n.xhamster.com TRUE / FALSE 0 session abc...\n— or —\nname1=value1; name2=value2"}
              className="w-full bg-[#161b27] border border-[#21293a] focus:border-amber-500/50 rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-300 placeholder-slate-700 outline-none resize-none" />
            <button type="button" onClick={add} disabled={busy === 'add'}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50">
              {busy === 'add' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save cookies
            </button>
          </div>

          {err && <p className="text-[11px] text-rose-400">{err}</p>}
          <p className="text-[10px] text-slate-600 leading-relaxed">
            Saved cookies are stored on your account and re-used automatically whenever you download from that site —
            no need to paste them every time. Use a cookies.txt export (e.g. the “Get cookies.txt” browser extension)
            or paste a raw <span className="font-mono">name=value;</span> header. Disable or delete any time.
          </p>
        </div>
      )}
      {err && !open && <p className="mt-1 text-[11px] text-rose-400">{err}</p>}
    </div>
  )
}
