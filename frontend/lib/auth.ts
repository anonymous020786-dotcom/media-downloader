import { auth, currentUser } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'

export type Role = 'super_admin' | 'admin' | 'individual'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

export interface AppUser {
  id:        string
  email:     string
  name:      string
  imageUrl:  string
  role:      Role
  createdAt: number
}

/** Resolve a user's role: publicMetadata.role wins; bootstrap emails get super_admin. */
export function resolveRole(email: string | undefined, metaRole: unknown): Role {
  if (metaRole === 'super_admin' || metaRole === 'admin' || metaRole === 'individual') {
    return metaRole
  }
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return 'super_admin'
  return 'individual'
}

/** Get the current signed-in user with resolved role (or null). */
export async function getCurrentAppUser(): Promise<AppUser | null> {
  const user = await currentUser()
  if (!user) return null
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? ''
  return {
    id:        user.id,
    email,
    name:      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || email.split('@')[0],
    imageUrl:  user.imageUrl,
    role:      resolveRole(email, user.publicMetadata?.role),
    createdAt: user.createdAt,
  }
}

export async function getRole(): Promise<Role> {
  const u = await getCurrentAppUser()
  return u?.role ?? 'individual'
}

export async function isAdmin(): Promise<boolean> {
  const r = await getRole()
  return r === 'admin' || r === 'super_admin'
}

export async function isSuperAdmin(): Promise<boolean> {
  return (await getRole()) === 'super_admin'
}

/** List all users (super_admin / admin). */
export async function listUsers(): Promise<AppUser[]> {
  const client = await clerkClient()
  const res = await client.users.getUserList({ limit: 100, orderBy: '-created_at' })
  return res.data.map((u) => {
    const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? ''
    return {
      id:        u.id,
      email,
      name:      [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || email.split('@')[0],
      imageUrl:  u.imageUrl,
      role:      resolveRole(email, u.publicMetadata?.role),
      createdAt: u.createdAt,
    }
  })
}

/** Change a user's role (writes to publicMetadata). */
export async function setUserRole(userId: string, role: Role): Promise<void> {
  const client = await clerkClient()
  await client.users.updateUserMetadata(userId, { publicMetadata: { role } })
}
