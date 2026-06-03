'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Search, Loader2, UserSearch, ExternalLink, Download, ShieldCheck,
  ShieldAlert, HelpCircle, Lock, Video, ImageIcon, LayoutGrid,
} from 'lucide-react'
import { toast } from 'sonner'
import { socialSearch, socialPlatforms, queueDownload, type SocialProfile, type SocialPlatform } from '@/lib/api'

const KIND_ICON: Record<string, React.ReactNode> = {
  video: <Video size={12} />, image: <ImageIcon size={12} />, mixed: <LayoutGrid size={12} />,
}
const STATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  verified:  { label: 'Verified',  cls: 'text-emerald-400 bg-emerald-500/10', icon: <ShieldCheck size={11} /> },
  blocked:   { label: 'Login-walled', cls: 'text-amber-400 bg-amber-500/10', icon: <ShieldAlert size={11} /> },
  candidate: { label: 'Candidate', cls: 'text-slate-400 bg-slate-500/10', icon: <HelpCircle size={11} /> },
}

export default function PeopleSearch() {
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profiles, setProfiles] = useState<SocialProfile[] | null>(null)
  const [queuing, setQueuing] = useState('')

  useEffect(() => { socialPlatforms().then((r) => setPlatforms(r.platforms)).catch(() => {}) }, [])

  async function run() {
    const q = query.trim()
    if (!q) return
    setLoading(true); setError(''); setProfiles(null)
    try {
      const r = await socialSearch(q, picked.length ? picked : undefined)
      setProfiles(r.profiles)
      if (!r.profiles.length) setError('No profiles found. Try a different handle or full name.')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function queueProfile(p: SocialProfile) {
    setQueuing(p.url)
    try {
      const { jobId } = await queueDownload({
        url: p.url, mediaType: 'profile', format: p.kind === 'image' ? 'original' : 'mp4',
        quality: 'best', title: p.display_name || p.username || p.platform_name,
      })
      toast.success('Profile queued', { description: `${p.platform_name} · job ${jobId.slice(0, 8)}` })
    } catch (e: any) { toast.error(e.message) }
    finally { setQueuing('') }
  }

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <UserSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Search a handle (e.g. nasa) or a full name (e.g. Marques Brownlee)…"
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl pl-11 pr-4 py-3.5 text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none" />
        </div>
        <button onClick={run} disabled={!query.trim() || loading}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-40 text-white text-sm font-bold rounded-xl">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Find profiles
        </button>
      </div>

      {/* Platform filter */}
      {platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] text-[var(--text-3)] self-center mr-1">Platforms:</span>
          {platforms.map((p) => (
            <button key={p.id} onClick={() => toggle(p.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                picked.includes(p.id) ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-hover)]'}`}>
              {p.name}
            </button>
          ))}
          {picked.length > 0 && <button onClick={() => setPicked([])} className="px-2 text-[11px] text-[var(--text-3)] hover:text-[var(--text)]">clear</button>}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-[var(--text-3)] leading-relaxed">
        <Lock size={11} className="mt-0.5 shrink-0" />
        Finds <strong className="text-[var(--text-2)]">public</strong> profiles. Members-only or private posts need your own session cookies (add them in the download tool&apos;s Advanced Options). Respect each platform&apos;s terms and people&apos;s privacy.
      </p>

      {error && <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">{error}</div>}

      {profiles && profiles.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((p, i) => {
            const st = STATUS[p.status] ?? STATUS.candidate
            return (
              <div key={i} className="flex flex-col rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
                <div className="flex items-center gap-3 mb-3">
                  {p.avatar
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={p.avatar} alt="" className="w-11 h-11 rounded-full object-cover border border-[var(--border)]" />
                    : <div className="w-11 h-11 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-3)]"><UserSearch size={18} /></div>}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text)] truncate">{p.display_name || p.username || p.platform_name}</p>
                    <p className="text-[11px] text-[var(--text-3)] truncate">{p.platform_name}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${st.cls}`}>{st.icon}{st.label}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--bg-hover)] text-[var(--text-2)] capitalize">{KIND_ICON[p.kind]}{p.kind}</span>
                  {p.login_required && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-amber-400 bg-amber-500/10"><Lock size={10} />cookies</span>}
                </div>
                <div className="flex gap-2 mt-auto">
                  <Link href={`/download?url=${encodeURIComponent(p.url)}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                    <ExternalLink size={13} /> Preview
                  </Link>
                  <button onClick={() => queueProfile(p)} disabled={queuing === p.url}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors">
                    {queuing === p.url ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
