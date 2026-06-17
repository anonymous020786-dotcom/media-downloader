import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { query } from '../db.js'

const JWT_SECRET   = process.env.SUPABASE_JWT_SECRET ?? ''
const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')

// Newer Supabase projects sign access tokens with asymmetric keys (ES256/RS256)
// exposed via JWKS. Older projects (and the anon key) use HS256 + the shared
// JWT secret. We support BOTH so auth works regardless of the project's signing
// mode. createRemoteJWKSet caches and rotates the keys automatically.
const JWKS = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null

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

async function verifyJwt(token: string): Promise<{ sub: string; email: string } | null> {
  // 1. Asymmetric (ES256/RS256) tokens — verify against the project's JWKS.
  if (JWKS) {
    try {
      const { payload } = await jwtVerify(token, JWKS)
      if (payload.sub) return { sub: String(payload.sub), email: (payload.email as string) ?? '' }
    } catch { /* not an asymmetric token (or wrong key) — try HS256 below */ }
  }
  // 2. Legacy HS256 tokens — verify with the shared JWT secret.
  if (JWT_SECRET) {
    try {
      const claims = jwt.verify(token, JWT_SECRET) as any
      return { sub: claims.sub, email: claims.email ?? '' }
    } catch { /* fall through */ }
  }
  return null
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
  const claims = await verifyJwt(token)
  if (!claims) { res.status(401).json({ error: 'Invalid or expired session' }); return }
  req.authUser = await upsertUser(claims.sub, claims.email)
  next()
}

/** Soft gate — populates req.authUser if signed in, but never blocks. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req)
  if (token) {
    const claims = await verifyJwt(token)
    if (claims) req.authUser = await upsertUser(claims.sub, claims.email)
  }
  next()
}
