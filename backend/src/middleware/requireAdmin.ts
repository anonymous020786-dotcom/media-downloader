import type { Request, Response, NextFunction } from 'express'
import { verifyToken, createClerkClient } from '@clerk/backend'

// Server-side admin gate. The frontend sends the Clerk session JWT as
// `Authorization: Bearer <token>`; we verify it cryptographically (so a spoofed
// X-User-Id can't get in), then resolve the user's role from Clerk metadata /
// the ADMIN_EMAILS bootstrap list. Roles are cached briefly to avoid a Clerk
// round-trip on every admin request.

const SECRET = process.env.CLERK_SECRET_KEY ?? ''
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

const clerk = SECRET ? createClerkClient({ secretKey: SECRET }) : null

type Role = 'super_admin' | 'admin' | 'individual'
const roleCache = new Map<string, { role: Role; at: number }>()
const TTL = 60_000

function resolveRole(email: string | undefined, metaRole: unknown): Role {
  if (metaRole === 'super_admin' || metaRole === 'admin' || metaRole === 'individual') return metaRole
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return 'super_admin'
  return 'individual'
}

async function roleForUser(userId: string): Promise<Role> {
  const hit = roleCache.get(userId)
  if (hit && Date.now() - hit.at < TTL) return hit.role
  if (!clerk) return 'individual'
  const u = await clerk.users.getUser(userId)
  const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? ''
  const role = resolveRole(email, (u.publicMetadata as any)?.role)
  roleCache.set(userId, { role, at: Date.now() })
  return role
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!SECRET) { res.status(503).json({ error: 'Admin auth not configured (CLERK_SECRET_KEY missing)' }); return }
  const header = req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return }
  try {
    const claims = await verifyToken(token, { secretKey: SECRET })
    const userId = claims.sub
    if (!userId) { res.status(401).json({ error: 'Invalid session' }); return }
    const role = await roleForUser(userId)
    if (role !== 'admin' && role !== 'super_admin') { res.status(403).json({ error: 'Admin access required' }); return }
    ;(req as any).adminUserId = userId
    ;(req as any).adminRole = role
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' })
  }
}
