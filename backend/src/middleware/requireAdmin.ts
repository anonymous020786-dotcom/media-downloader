import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from './requireAuth.js'

export type AdminRole = 'admin' | 'super_admin'

/** Verifies the Supabase JWT and then checks the user's role in MySQL.
 *  Roles live entirely in our users table — not in Supabase metadata. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const role = req.authUser?.role
    if (role !== 'admin' && role !== 'super_admin') {
      res.status(403).json({ error: 'Admin access required' }); return
    }
    next()
  })
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    if (req.authUser?.role !== 'super_admin') {
      res.status(403).json({ error: 'Super-admin access required' }); return
    }
    next()
  })
}
