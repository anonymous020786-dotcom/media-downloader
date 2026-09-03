import type { Request, Response, NextFunction } from 'express'

// Local-only build: there is no auth. Every request runs as this single user.
export interface AuthUser {
  id: string
  email: string
  role: 'user' | 'admin' | 'super_admin'
}

export const LOCAL_USER: AuthUser = {
  id: 'local',
  email: process.env.SUPER_ADMIN_EMAIL || 'local@localhost',
  role: 'super_admin',
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  req.authUser = LOCAL_USER
  next()
}

export const optionalAuth = requireAuth
