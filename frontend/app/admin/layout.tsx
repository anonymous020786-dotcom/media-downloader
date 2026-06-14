import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import {
  LayoutDashboard, Download, MessageSquare, FileText,
  Settings, Users, ArrowLeft, ShieldAlert, BarChart2,
} from 'lucide-react'
import { getCurrentAppUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Admin Panel | MediaDL',
  robots: { index: false, follow: false },
}

async function getUnreadCount(token: string): Promise<number> {
  try {
    const base = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://backend:4000'
    const res  = await fetch(`${base}/api/content/admin/messages?status=unread`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 30 },
    })
    if (!res.ok) return 0
    const data = await res.json()
    return typeof data.unread === 'number' ? data.unread : (data.messages?.length ?? 0)
  } catch { return 0 }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentAppUser()

  if (!user) redirect('/sign-in?redirect_url=/admin')

  const isAdmin = user.role === 'admin' || user.role === 'super_admin'
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4" data-theme="dark">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-900/30 text-red-400 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-2xl font-black text-[var(--text)] mb-2">Access Denied</h1>
          <p className="text-[var(--text-2)] mb-6">
            Your account ({user.email}) does not have admin privileges.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white font-semibold text-sm">
            <ArrowLeft size={14} /> Back to site
          </Link>
        </div>
      </div>
    )
  }

  // Get token for backend call
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token  = session?.access_token ?? ''
  const unread = token ? await getUnreadCount(token) : 0

  const NAV = [
    { label: 'Dashboard', href: '/admin',           icon: <LayoutDashboard size={16} />, show: true },
    { label: 'Analytics', href: '/admin/analytics', icon: <BarChart2 size={16} />,       show: true },
    { label: 'Downloads', href: '/admin/downloads', icon: <Download size={16} />,        show: true },
    { label: 'Messages',  href: '/admin/messages',  icon: <MessageSquare size={16} />,   show: true, badge: unread > 0 ? unread : undefined },
    { label: 'Blog',      href: '/admin/blog',      icon: <FileText size={16} />,        show: true },
    { label: 'Users',     href: '/admin/users',     icon: <Users size={16} />,           show: user.role === 'super_admin' },
    { label: 'Settings',  href: '/admin/settings',  icon: <Settings size={16} />,        show: true },
  ].filter(n => n.show)

  return (
    <div className="min-h-screen flex bg-[var(--bg)]" data-theme="dark">
      <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col">
        <div className="p-5 border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="MediaDL" width={28} height={28} className="rounded-lg" />
            <span className="font-black text-[var(--text)]">Media<span className="gradient-text">DL</span></span>
          </Link>
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-widest mt-1 ml-9">Admin</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
              {n.icon}
              <span className="flex-1">{n.label}</span>
              {'badge' in n && n.badge && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {(n.badge as number) > 99 ? '99+' : n.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-[var(--border)] space-y-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
              : <div className="w-7 h-7 rounded-full bg-[var(--brand)]/30 flex items-center justify-center text-[10px] font-bold text-[var(--brand)]">
                  {user.name.slice(0,2).toUpperCase()}
                </div>
            }
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text)] truncate">{user.name}</p>
              <p className="text-[10px] text-[var(--brand)] uppercase tracking-wide font-bold">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
            <ArrowLeft size={13} /> Back to site
          </Link>
        </div>
      </aside>

      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
