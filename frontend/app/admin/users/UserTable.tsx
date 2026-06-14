'use client'
import { useState, useTransition } from 'react'
import { Shield, ShieldCheck, User as UserIcon, Crown, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth/AuthContext'
import { changeRole } from './actions'
import type { AppUser, Role } from '@/lib/auth'

const ROLE_META: Record<Role, { label: string; icon: React.ReactNode; cls: string }> = {
  super_admin: { label: 'Super Admin', icon: <Crown size={12} />,      cls: 'bg-amber-900/40 text-amber-300' },
  admin:       { label: 'Admin',       icon: <ShieldCheck size={12} />, cls: 'bg-violet-900/40 text-violet-300' },
  user:        { label: 'User',        icon: <UserIcon size={12} />,    cls: 'bg-slate-800 text-slate-400' },
}

export default function UserTable({ users }: { users: AppUser[] }) {
  const { user: me } = useAuth()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  const onChange = (userId: string, role: Role) => {
    setBusyId(userId)
    startTransition(async () => {
      const res = await changeRole(userId, role)
      setBusyId(null)
      if (res.ok) toast.success('Role updated')
      else toast.error(res.error ?? 'Failed to update role')
    })
  }

  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
      <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-950/30 border-b border-amber-800/30">
        <Shield size={14} className="text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-300/80 leading-relaxed">
          Role changes are permanent and apply immediately. You cannot change your own role or demote another super admin.
        </p>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-hover)] text-[var(--text-3)] text-[11px] uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-3 font-semibold">User</th>
            <th className="text-left px-4 py-3 font-semibold">Current Role</th>
            <th className="text-left px-4 py-3 font-semibold">Change Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const meta   = ROLE_META[u.role] ?? ROLE_META.user
            const isSelf = me?.id === u.id
            const locked = isSelf || u.role === 'super_admin'
            return (
              <tr key={u.id} className={`border-t border-[var(--border)] ${locked ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                      : <div className="w-8 h-8 rounded-full bg-[var(--brand)]/30 flex items-center justify-center text-xs font-bold text-[var(--brand)]">
                          {u.name.slice(0,2).toUpperCase()}
                        </div>
                    }
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-[var(--text)] truncate">{u.name}</p>
                        {isSelf && <span className="text-[10px] text-[var(--text-3)] bg-[var(--bg-hover)] px-1.5 rounded">you</span>}
                      </div>
                      <p className="text-xs text-[var(--text-3)] truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold ${meta.cls}`}>
                    {meta.icon}{meta.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {locked ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-3)]">
                      <Lock size={11} /> {isSelf ? 'Cannot change own role' : 'Super admin — locked'}
                    </span>
                  ) : (
                    <select
                      value={u.role}
                      disabled={pending && busyId === u.id}
                      onChange={(e) => onChange(u.id, e.target.value as Role)}
                      aria-label={`Role for ${u.name}`}
                      className="bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] outline-none disabled:opacity-50"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
