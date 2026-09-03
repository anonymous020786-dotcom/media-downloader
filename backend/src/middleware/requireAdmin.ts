import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from './requireAuth.js'

export type AdminRole = 'admin' | 'super_admin'

// Local-only build: the single local user is always super_admin.
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, next)
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, next)
}
