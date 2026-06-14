'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthContext'
import { User, LogOut, Settings, History, ShieldCheck, ChevronDown } from 'lucide-react'

export default function UserMenu({ showLabel = false }: { showLabel?: boolean }) {
  const { user, role, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = (user?.user_metadata?.full_name ?? user?.email ?? 'U')
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  const avatar = user?.user_metadata?.avatar_url as string | undefined

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-xl hover:bg-[var(--bg-hover)] p-1 transition-colors"
      >
        {avatar
          ? <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
          : (
            <span className="w-8 h-8 rounded-full bg-[var(--brand)]/20 border border-[var(--brand)]/30 flex items-center justify-center text-[11px] font-bold text-[var(--brand)]">
              {initials}
            </span>
          )
        }
        {showLabel && <span className="text-sm text-[var(--text-2)]">My account</span>}
        <ChevronDown size={12} className={`text-[var(--text-3)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl z-50 py-1.5 animate-slide-down">
          {/* User info */}
          <div className="px-4 py-2.5 border-b border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--text)] truncate">
              {user?.user_metadata?.full_name ?? user?.email}
            </p>
            <p className="text-[10px] text-[var(--text-3)] truncate">{user?.email}</p>
            {role !== 'user' && (
              <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand)]/15 text-[var(--brand)] uppercase tracking-wide">
                <ShieldCheck size={9} /> {role.replace('_', ' ')}
              </span>
            )}
          </div>

          <div className="py-1">
            <Link href="/history" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
              <History size={14} /> Download history
            </Link>
            <Link href="/account" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
              <Settings size={14} /> Account settings
            </Link>
            {(role === 'admin' || role === 'super_admin') && (
              <Link href="/admin" onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--brand)] hover:bg-[var(--brand)]/5 transition-colors">
                <ShieldCheck size={14} /> Admin panel
              </Link>
            )}
          </div>

          <div className="border-t border-[var(--border)] pt-1">
            <button type="button" onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
