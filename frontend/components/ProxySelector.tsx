'use client'
import { useEffect, useState } from 'react'
import { Shield, Plus, Trash2, Check, Loader2, Zap, Star } from 'lucide-react'
import {
  fetchProxies, testProxy, saveProxy, setDefaultProxy, deleteProxy,
  type ProxyListResponse, type ProxyTestResult,
} from '@/lib/api'

/**
 * Proxy / VPN selector + manager.
 * `value` is the proxy reference stored on the download options:
 *   '' / 'direct' → no proxy
 *   'auto'        → rotate through saved/preset pool (resolved server-side)
 *   'preset:N'    → a PROXY_POOL preset
 *   '<uuid>'      → a saved proxy
 *   'http://…'    → a raw, one-off URL
 */
export default function ProxySelector({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [data, setData]       = useState<ProxyListResponse>({ presets: [], saved: [] })
  const [open, setOpen]       = useState(false)
  const [raw, setRaw]         = useState(value.startsWith('http') || value.startsWith('socks') ? value : '')
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl]   = useState('')
  const [busy, setBusy]       = useState<string | null>(null)
  const [result, setResult]   = useState<Record<string, ProxyTestResult>>({})
  const [err, setErr]         = useState<string | null>(null)

  async function reload() {
    try { setData(await fetchProxies()) } catch { /* not signed in / backend down */ }
  }
  useEffect(() => { reload() }, [])

  const isRaw = value.startsWith('http') || value.startsWith('socks')

  async function runTest(ref: string) {
    setBusy(`test:${ref}`); setErr(null)
    try {
      const r = await testProxy(ref)
      setResult((m) => ({ ...m, [ref]: r }))
      if (!ref.startsWith('preset:') && !ref.startsWith('http') && !ref.startsWith('socks')) reload()
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(null) }
  }

  async function add() {
    if (!/^(https?|socks4|socks5h?):\/\//i.test(newUrl)) { setErr('URL must start with http://, https:// or socks5://'); return }
    setBusy('add'); setErr(null)
    try {
      const p = await saveProxy(newLabel || 'My proxy', newUrl)
      setNewLabel(''); setNewUrl('')
      await reload()
      onChange(p.id)
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(null) }
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <select
          value={isRaw ? '__raw__' : (value || 'direct')}
          onChange={(e) => {
            const v = e.target.value
            if (v === '__raw__') { onChange(raw || 'http://'); }
            else if (v === 'direct') onChange('')
            else onChange(v)
          }}
          className="flex-1 bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none"
        >
          <option value="direct">Direct (no proxy)</option>
          <option value="auto">⚡ Auto-rotate (best available)</option>
          {data.saved.length > 0 && (
            <optgroup label="My proxies">
              {data.saved.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.is_default ? '★ ' : ''}{s.label}{s.country ? ` · ${s.country}` : ''}{s.last_ok === 1 ? ' ✓' : s.last_ok === 0 ? ' ✗' : ''}
                </option>
              ))}
            </optgroup>
          )}
          {data.presets.length > 0 && (
            <optgroup label="Presets">
              {data.presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </optgroup>
          )}
          <option value="__raw__">Custom URL…</option>
        </select>
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-[#161b27] border border-[#21293a] text-slate-400 hover:text-indigo-300">
          <Shield size={11} /> Manage
        </button>
      </div>

      {isRaw && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={raw}
            onChange={(e) => { setRaw(e.target.value); onChange(e.target.value) }}
            placeholder="http://user:pass@host:port  or  socks5://host:1080"
            className="flex-1 bg-[#161b27] border border-[#21293a] focus:border-indigo-500/60 rounded-lg px-2 py-1 text-xs text-slate-300 placeholder-slate-600 font-mono outline-none"
          />
          <button type="button" onClick={() => runTest(value)} disabled={busy === `test:${value}`}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30">
            {busy === `test:${value}` ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />} Test
          </button>
        </div>
      )}

      {/* Inline test result for the current raw URL */}
      {isRaw && result[value] && (
        <TestBadge r={result[value]} />
      )}

      {open && (
        <div className="mt-3 rounded-xl border border-[#21293a] bg-[#10141d] p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Saved proxies / VPN endpoints</p>
          {data.saved.length === 0 && <p className="text-[11px] text-slate-600">No saved proxies yet.</p>}
          {data.saved.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <button type="button" title="Set as default for auto-rotate"
                onClick={async () => { await setDefaultProxy(s.id); reload() }}
                className={`shrink-0 ${s.is_default ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}>
                <Star size={13} fill={s.is_default ? 'currentColor' : 'none'} />
              </button>
              <span className="flex-1 truncate text-slate-300">
                {s.label}
                {s.country && <span className="text-slate-500"> · {s.country}</span>}
                {s.last_ip && <span className="text-slate-600 font-mono"> · {s.last_ip}</span>}
              </span>
              {s.last_ok === 1 && <Check size={12} className="text-emerald-400" />}
              {s.last_ok === 0 && <span className="text-rose-400 text-[10px]">failed</span>}
              <button type="button" onClick={() => runTest(s.id)} disabled={busy === `test:${s.id}`}
                className="text-indigo-400 hover:text-indigo-300">
                {busy === `test:${s.id}` ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              </button>
              <button type="button" onClick={async () => { await deleteProxy(s.id); reload() }}
                className="text-slate-600 hover:text-rose-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {data.saved.map((s) => result[s.id] && <TestBadge key={`r-${s.id}`} r={result[s.id]} />)}

          <div className="pt-2 border-t border-[#21293a] space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Add a proxy</p>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label (e.g. Germany VPN)"
              className="w-full bg-[#161b27] border border-[#21293a] rounded-lg px-2 py-1 text-xs text-slate-200 outline-none" />
            <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="http://user:pass@host:port  /  socks5://host:1080"
              className="w-full bg-[#161b27] border border-[#21293a] rounded-lg px-2 py-1 text-xs text-slate-200 font-mono outline-none" />
            <button type="button" onClick={add} disabled={busy === 'add'}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
              {busy === 'add' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save proxy
            </button>
          </div>

          {err && <p className="text-[11px] text-rose-400">{err}</p>}
          <p className="text-[10px] text-slate-600 leading-relaxed">
            Supports HTTP, HTTPS and SOCKS4/5 proxies (including paid VPN/residential gateways).
            All downloads run server-side through the proxy — your real IP is never exposed to the target site.
          </p>
        </div>
      )}
      {err && !open && <p className="mt-1 text-[11px] text-rose-400">{err}</p>}
    </div>
  )
}

function TestBadge({ r }: { r: ProxyTestResult }) {
  if (r.ok) {
    return (
      <p className="mt-1 text-[11px] text-emerald-400">
        ✓ Working — exit {r.ip}{r.country ? ` (${r.country}${r.city ? `, ${r.city}` : ''})` : ''}{r.latency_ms != null ? ` · ${r.latency_ms} ms` : ''}
      </p>
    )
  }
  return <p className="mt-1 text-[11px] text-rose-400">✗ {r.error ?? 'Proxy unreachable'}</p>
}
