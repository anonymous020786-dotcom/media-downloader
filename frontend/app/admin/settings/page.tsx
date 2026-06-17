'use client'
import { useEffect, useState } from 'react'
import {
  Save, RefreshCw, Plus, Cpu, ArrowUpCircle, Mail,
  CheckCircle2, XCircle, Loader2, Send, Eye, EyeOff, Megaphone,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  adminSettings, adminUpdateSettings, adminEngines, adminUpdateEngines,
  adminEmailConfig, adminTestEmail,
} from '@/lib/api'

interface Row { key_name: string; value: string }

// ── Engines panel ─────────────────────────────────────────────────────────────
function EnginesPanel() {
  const [engines,  setEngines]  = useState<Record<string,string|null>>({})
  const [loading,  setLoading]  = useState(true)
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
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
          <Cpu size={15} className="text-[var(--brand)]"/>Download Engines
        </h2>
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
        Updates yt-dlp, gallery-dl, streamlink, you-get &amp; ddgs. Fixes most "site stopped working" issues.
      </p>
    </div>
  )
}

// ── Email config panel ────────────────────────────────────────────────────────
const PROVIDER_PRESETS: Record<string, { host: string; port: string; secure: string }> = {
  gmail:     { host: 'smtp.gmail.com',      port: '587', secure: 'false' },
  microsoft: { host: 'smtp.office365.com',  port: '587', secure: 'false' },
  hostinger: { host: 'smtp.hostinger.com',  port: '587', secure: 'false' },
  yahoo:     { host: 'smtp.mail.yahoo.com', port: '587', secure: 'false' },
  custom:    { host: '',                    port: '587', secure: 'false' },
}

function EmailPanel() {
  const [cfg,       setCfg]       = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [testing,   setTesting]   = useState(false)
  const [testTo,    setTestTo]    = useState('')
  const [showGuide, setShowGuide] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setCfg(await adminEmailConfig()) } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const test = async () => {
    setTesting(true)
    try {
      await adminTestEmail(testTo || undefined)
      toast.success('Test email sent! Check your inbox.')
    } catch (e: any) { toast.error(e.message) } finally { setTesting(false) }
  }

  const GUIDES: Record<string, { title: string; steps: string[] }> = {
    gmail: {
      title: 'Gmail / Google Workspace',
      steps: [
        '1. Enable 2-Step Verification on your Google account',
        '2. Go to Google Account → Security → 2-Step Verification → App passwords',
        '3. Generate an App Password for "Mail" + "Other (custom)"',
        '4. Set SMTP_PROVIDER=gmail, SMTP_USER=you@gmail.com, SMTP_PASS=<app-password>',
      ],
    },
    microsoft: {
      title: 'Microsoft 365 / Outlook',
      steps: [
        '1. Sign in to Microsoft 365 Admin Center',
        '2. Enable SMTP AUTH for your mailbox (Settings → Org Settings → Modern Auth)',
        '3. Or use an App Password if MFA is enabled on your account',
        '4. Set SMTP_PROVIDER=microsoft, SMTP_USER=you@domain.com, SMTP_PASS=<password>',
      ],
    },
    hostinger: {
      title: 'Hostinger Email',
      steps: [
        '1. Log in to Hostinger hPanel → Emails → Email Accounts',
        '2. Create or use an existing email account',
        '3. SMTP host is smtp.hostinger.com on port 587 (STARTTLS)',
        '4. Set SMTP_PROVIDER=hostinger, SMTP_USER=you@yourdomain.com, SMTP_PASS=<email-password>',
      ],
    },
    custom: {
      title: 'Custom SMTP',
      steps: [
        '1. Get your SMTP host, port, username and password from your email provider',
        '2. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env file',
        '3. Set SMTP_SECURE=true only if using port 465 (SSL); for port 587 use STARTTLS (false)',
        '4. Optionally set SMTP_FROM=noreply@yourdomain.com and SMTP_ADMIN_TO=admin@yourdomain.com',
      ],
    },
  }

  const provider = cfg?.provider ?? 'custom'
  const guide    = GUIDES[provider] ?? GUIDES.custom

  return (
    <div className="mb-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
          <Mail size={15} className="text-[var(--brand)]"/>Email Provider
        </h2>
        {loading ? <Loader2 size={14} className="animate-spin text-[var(--text-3)]"/> : (
          cfg?.configured
            ? <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold"><CheckCircle2 size={13}/>Configured</span>
            : <span className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold"><XCircle size={13}/>Not configured</span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Status summary */}
        {cfg && (
          <div className={`rounded-xl p-4 border text-sm ${cfg.configured ? 'bg-emerald-950/30 border-emerald-800/30' : 'bg-amber-950/30 border-amber-800/30'}`}>
            {cfg.configured ? (
              <>
                <p className="font-semibold text-emerald-300 mb-1">✓ Email is configured</p>
                <p className="text-emerald-400/70 text-xs">Provider: <strong>{cfg.provider}</strong> · From: <strong>{cfg.from}</strong></p>
                {cfg.admin_to && <p className="text-emerald-400/70 text-xs">Admin notifications → <strong>{cfg.admin_to}</strong></p>}
              </>
            ) : (
              <>
                <p className="font-semibold text-amber-300 mb-1">⚠ Email not configured</p>
                <p className="text-amber-400/70 text-xs">
                  Add SMTP environment variables to your <code className="bg-[var(--bg)] px-1 rounded">.env</code> file to enable:
                  contact form auto-reply, admin notifications, and reply-from-admin-panel.
                </p>
              </>
            )}
          </div>
        )}

        {/* Required .env variables */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-2)] mb-3">Required .env variables</p>
          <div className="space-y-2 font-mono text-xs">
            {[
              { key: 'SMTP_PROVIDER', hint: 'gmail | microsoft | hostinger | yahoo | custom', req: true },
              { key: 'SMTP_USER',     hint: 'your-email@domain.com',   req: true },
              { key: 'SMTP_PASS',     hint: 'password or app-password', req: true },
              { key: 'SMTP_HOST',     hint: 'required for custom provider only', req: false },
              { key: 'SMTP_PORT',     hint: '587 (default)',            req: false },
              { key: 'SMTP_SECURE',   hint: 'false (587/STARTTLS) or true (465/SSL)', req: false },
              { key: 'SMTP_FROM',     hint: 'noreply@yourdomain.com — defaults to SMTP_USER', req: false },
              { key: 'SMTP_ADMIN_TO', hint: 'admin@yourdomain.com — who receives new message alerts', req: false },
            ].map((v) => (
              <div key={v.key} className="flex items-start gap-2">
                <code className={`w-36 shrink-0 text-[var(--text)] ${v.req ? '' : 'opacity-60'}`}>{v.key}</code>
                <span className="text-[var(--text-3)]"># {v.hint}</span>
                {v.req && <span className="text-red-400 shrink-0">*</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Provider quick-setup guide */}
        <div>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--brand)] hover:text-[var(--accent)]"
          >
            {showGuide ? <EyeOff size={13}/> : <Eye size={13}/>}
            {showGuide ? 'Hide' : 'Show'} setup guide for {cfg?.provider ?? 'your provider'}
          </button>
          {showGuide && (
            <div className="mt-3 p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
              <p className="text-xs font-bold text-[var(--text)] mb-2">{guide.title}</p>
              <ol className="space-y-1.5">
                {guide.steps.map((s, i) => (
                  <li key={i} className="text-xs text-[var(--text-2)] leading-relaxed">{s}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Send test email */}
        {cfg?.configured && (
          <div>
            <p className="text-xs font-semibold text-[var(--text-2)] mb-2">Send a test email</p>
            <div className="flex gap-2">
              <input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder={cfg.admin_to || cfg.from || 'test@example.com'}
                className="flex-1 bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl px-3 py-2 text-sm text-[var(--text)] outline-none"
              />
              <button onClick={test} disabled={testing}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors">
                {testing ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>}
                {testing ? 'Sending…' : 'Test'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main settings page ────────────────────────────────────────────────────────
const LABELS: Record<string, string> = {
  site_name: 'Site Name', site_tagline: 'Tagline', support_email: 'Support Email',
  whatsapp_number: 'WhatsApp Number', tawk_widget_id: 'Tawk Widget ID',
  ga_measurement_id: 'GA Measurement ID', recaptcha_site_key: 'reCAPTCHA Site Key',
  adsense_client_id: 'AdSense Client ID', twitter_url: 'Twitter URL', github_url: 'GitHub URL',
  discord_url: 'Discord URL', youtube_url: 'YouTube URL', total_downloads: 'Total Downloads',
  total_sites: 'Total Sites',
}

// ── Status incident banner panel ──────────────────────────────────────────────
function IncidentPanel() {
  const [active, setActive]     = useState(false)
  const [message, setMessage]   = useState('')
  const [severity, setSeverity] = useState('warning')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const rows = await adminSettings()
      const m: Record<string, string> = {}
      rows.forEach((r) => { m[r.key_name] = r.value })
      setActive(m.status_incident_active === '1')
      setMessage(m.status_incident_message ?? '')
      setSeverity(['info', 'warning', 'critical'].includes(m.status_incident_severity) ? m.status_incident_severity : 'warning')
    } catch { /* ignore */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const persist = async (nextActive: boolean) => {
    setSaving(true)
    try {
      await adminUpdateSettings({
        status_incident_active:   nextActive ? '1' : '0',
        status_incident_message:  message,
        status_incident_severity: severity,
      })
      setActive(nextActive)
      toast.success(nextActive ? 'Incident banner published' : 'Incident banner cleared',
        { description: 'Visible on the public /status page within ~20s.' })
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="mb-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
          <Megaphone size={15} className="text-[var(--brand)]" /> Status Incident Banner
        </h2>
        {active && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-900/40 text-amber-300">LIVE</span>}
      </div>
      <div className="p-5 space-y-3">
        {loading ? <p className="text-sm text-[var(--text-3)]">Loading…</p> : (
          <>
            <textarea
              value={message} onChange={(e) => setMessage(e.target.value)} rows={2}
              placeholder="e.g. We're investigating slow downloads on some sites. Updates to follow."
              className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none resize-none"
            />
            <div className="flex items-center gap-3">
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Incident severity"
                className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                <option value="info">Info (blue)</option>
                <option value="warning">Warning (amber)</option>
                <option value="critical">Critical (red)</option>
              </select>
              <div className="flex-1" />
              {active && (
                <button onClick={() => persist(false)} disabled={saving}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-40">
                  Clear
                </button>
              )}
              <button onClick={() => persist(true)} disabled={saving || !message.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-40 text-white font-semibold text-sm rounded-lg">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
                {active ? 'Update' : 'Publish'}
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-3)]">Shown to all visitors on the public <span className="font-mono">/status</span> page. Clear it once the incident is resolved.</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminSettings() {
  const [rows,    setRows]    = useState<Row[]>([])
  const [dirty,   setDirty]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [newKey,  setNewKey]  = useState('')

  const load = async () => {
    setLoading(true)
    try { const r = await adminSettings(); setRows(r); setDirty({}) }
    catch { toast.error('Failed to load settings') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const edit     = (k: string, v: string) => setDirty((d) => ({ ...d, [k]: v }))
  const valueOf  = (r: Row) => dirty[r.key_name] ?? r.value

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
          <h1 className="text-2xl font-black text-[var(--text)]">Settings</h1>
          <p className="text-sm text-[var(--text-3)]">Global configuration — engines, email, site settings</p>
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
      <IncidentPanel />
      <EmailPanel />

      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <div key={r.key_name} className="flex items-center gap-4 px-5 py-3">
            <label className="w-44 shrink-0 text-sm font-semibold text-[var(--text-2)]">
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
