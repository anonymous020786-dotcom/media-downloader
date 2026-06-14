import { createClient } from '@/lib/supabase/server'

export type Role = 'user' | 'admin' | 'super_admin'

export interface AppUser {
  id:          string
  email:       string
  name:        string
  avatarUrl:   string
  role:        Role
  createdAt:   string
}

const API_BASE = (process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://backend:4000').replace(/\/$/, '')

/** Get the current signed-in user with their role from our MySQL users table. */
export async function getCurrentAppUser(): Promise<AppUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch role from our backend (which reads MySQL)
  try {
    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token
    const res     = await fetch(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    })
    if (res.ok) {
      const data = await res.json()
      return {
        id:        user.id,
        email:     user.email ?? '',
        name:      data.name ?? user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '',
        avatarUrl: data.avatar_url ?? user.user_metadata?.avatar_url ?? '',
        role:      data.role ?? 'user',
        createdAt: user.created_at,
      }
    }
  } catch { /* fall through to defaults */ }

  return {
    id:        user.id,
    email:     user.email ?? '',
    name:      user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '',
    avatarUrl: user.user_metadata?.avatar_url ?? '',
    role:      'user',
    createdAt: user.created_at,
  }
}

export async function getRole(): Promise<Role> {
  const u = await getCurrentAppUser()
  return u?.role ?? 'user'
}

export async function isAdmin(): Promise<boolean> {
  const r = await getRole()
  return r === 'admin' || r === 'super_admin'
}

export async function isSuperAdmin(): Promise<boolean> {
  return (await getRole()) === 'super_admin'
}

/** List all users — calls our backend (admin-only endpoint). */
export async function listUsers(token: string): Promise<AppUser[]> {
  const res = await fetch(`${API_BASE}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  })
  if (!res.ok) return []
  const rows = await res.json() as Array<{
    id: string; email: string; name: string | null
    avatar_url: string | null; role: string; created_at: string
  }>
  return rows.map(u => ({
    id:        u.id,
    email:     u.email,
    name:      u.name ?? u.email.split('@')[0],
    avatarUrl: u.avatar_url ?? '',
    role:      u.role as Role,
    createdAt: u.created_at,
  }))
}

/** Change a user's role — calls our backend. Only admin→user or user→admin allowed. */
export async function setUserRole(userId: string, role: 'user' | 'admin', token: string): Promise<void> {
  await fetch(`${API_BASE}/api/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role }),
  })
}
