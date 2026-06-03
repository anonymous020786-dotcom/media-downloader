'use client'
import { useEffect, useState } from 'react'
import { Save, RefreshCw, Check, Plus, Cpu, ArrowUpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { adminSettings, adminUpdateSettings, adminEngines, adminUpdateEngines } from '@/lib/api'

interface Row { key_name: string; value: string }

function EnginesPanel() {
  const [engines, setEngines] = useState<Record<string,string|null>>({})
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await adminEngines(); setEngines(r.engines) } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const update = async () => {
    setUpdating(true)
    try {
      const r = await adminUpdateEngines()
      setEngines(r.after)
      if (r.changed.length) toast.success(`Updated: ${r.changed.join(', ')}`, { description: r.note })
      else toast.info('All engines already up to date')
    } catch (e: any) { toast.error(e.message) } finally { setUpdating(false) }
  }

  return (
    <div className="mb-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text)]"><Cpu size={15} className="text-[var(--brand)]"/>Download Engines</h2>
        <button onClick={update} disabled={updating}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors">
          {updating ? <RefreshCw size={13} className="animate-spin"/> : <ArrowUpCircle size={13}/>}
          {updating ? 'Updating…' : 'Update to latest'}
        </button>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {loading ? <p className="text-sm text-[var(--text-3)] col-span-full">Loading…</p> :
          Object.entries(engines).map(([name, ver]) => (
            <div key={name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
              <span className="text-xs font-semibold text-[var(--text-2)]">{name}</span>
              <span className={`text-[11px] font-mono ${ver ? 'text-emerald-400' : 'text-red-400'}`}>{ver ?? 'n/a'}</span>
            </div>
          ))}
      </div>
      <p className="px-5 pb-3 text-[10px] text-[var(--text-3)]">
        Updates yt-dlp, gallery-dl, streamlink, you-get &amp; ddgs. Fixes most "site stopped working" issues. yt-dlp applies after the python-service restarts; the rest are live immediately.
      </p>
    </div>
  )
}

const LABELS: Record<string, string> = {
  site_name: 'Site Name', site_tagline: 'Tagline', support_email: 'Support Email',
  whatsapp_number: 'WhatsApp Number', tawk_widget_id: 'Tawk Widget ID',
  ga_measurement_id: 'GA Measurement ID', recaptcha_site_key: 'reCAPTCHA Site Key',
  adsense_client_id: 'AdSense Client ID', twitter_url: 'Twitter URL', github_url: 'GitHub URL',
  discord_url: 'Discord URL', youtube_url: 'YouTube URL', total_downloads: 'Total Downloads',
  total_sites: 'Total Sites',
}

export default function AdminSettings() {
  const [rows, setRows] = useState<Row[]>([])
  const [dirty, setDirty] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState('')

  const load = async () => {
    setLoading(true)
    try { const r = await adminSettings(); setRows(r); setDirty({}) }
    catch { toast.error('Failed to load settings') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const edit = (k: string, v: string) => setDirty((d) => ({ ...d, [k]: v }))
  const valueOf = (r: Row) => dirty[r.key_name] ?? r.value

  const save = async () => {
    if (Object.keys(dirty).length === 0) { toast.info('No changes'); return }
    setSaving(true)
    try { await adminUpdateSettings(dirty); toast.success('Settings saved'); await load() }
    catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const addKey = () => {
    const k = newKey.trim()
    if (!k) return
    if (rows.some((r) => r.key_name === k)) { toast.error('Key already exists'); return }
    setRows((r) => [...r, { key_name: k, value: '' }])
    setNewKey('')
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">Site Settings</h1>
          <p className="text-sm text-[var(--text-3)]">Edit global configuration stored in MySQL</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className={`p-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] ${loading?'animate-spin':''}`}><RefreshCw size={15}/></button>
          <button onClick={save} disabled={saving || Object.keys(dirty).length===0}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-40 text-white font-semibold text-sm rounded-xl transition-colors">
            {saving ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>}
            Save {Object.keys(dirty).length > 0 && `(${Object.keys(dirty).length})`}
          </button>
        </div>
      </div>

      <EnginesPanel />

      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <div key={r.key_name} className="flex items-center gap-4 px-5 py-3">
            <label className="w-40 shrink-0 text-sm font-semibold text-[var(--text-2)]">
              {LABELS[r.key_name] ?? r.key_name}
              {dirty[r.key_name] !== undefined && <span className="ml-1 text-[var(--brand)]">•</span>}
            </label>
            <input
              value={valueOf(r)}
              onChange={(e) => edit(r.key_name, e.target.value)}
              className="flex-1 bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors"
            />
          </div>
        ))}
        {/* Add new key */}
        <div className="flex items-center gap-2 px-5 py-3">
          <input value={newKey} onChange={(e)=>setNewKey(e.target.value)} placeholder="new_setting_key"
            className="flex-1 bg-[var(--bg)] border border-dashed border-[var(--border)] focus:border-[var(--brand)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none font-mono" />
          <button onClick={addKey} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)]">
            <Plus size={14}/>Add
          </button>
        </div>
      </div>
    </div>
  )
}
