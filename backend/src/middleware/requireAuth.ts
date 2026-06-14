import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? ''

export interface AuthUser {
  id:    string
  email: string
  role:  'user' | 'admin' | 'super_admin'
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.header('Authorization') ?? ''
  if (header.startsWith('Bearer ')) return header.slice(7)
  return null
}

function verifyJwt(token: string): { sub: string; email: string } | null {
  if (!JWT_SECRET) return null
  try {
    const claims = jwt.verify(token, JWT_SECRET) as any
    return { sub: claims.sub, email: claims.email ?? '' }
  } catch { return null }
}

// Upsert user into MySQL on every auth (syncs Supabase identity → our DB).
async function upsertUser(id: string, email: string): Promise<AuthUser> {
  try {
    await query(
      `INSERT INTO users (id, email, last_sign_in)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_sign_in = NOW(), email = VALUES(email)`,
      [id, email]
    )
    const rows = await query<{ role: string }>('SELECT role FROM users WHERE id = ?', [id])
    const role = (rows[0]?.role ?? 'user') as AuthUser['role']
    return { id, email, role }
  } catch {
    return { id, email, role: 'user' }
  }
}

/** Hard gate — 401 if not signed in. Attaches req.authUser. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req)
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return }
  const claims = verifyJwt(token)
  if (!claims) { res.status(401).json({ error: 'Invalid or expired session' }); return }
  req.authUser = await upsertUser(claims.sub, claims.email)
  next()
}

/** Soft gate — populates req.authUser if signed in, but never blocks. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req)
  if (token && JWT_SECRET) {
    const claims = verifyJwt(token)
    if (claims) req.authUser = await upsertUser(claims.sub, claims.email)
  }
  next()
}
