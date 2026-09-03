'use client'
import { createContext, useContext } from 'react'

// Local build: there is no authentication. Every visitor is the single local
// user with full access. This shim keeps the `useAuth()` API that the rest of
// the app already consumes.
interface AuthContextValue {
  user:        { id: string; email: string } | null
  session:     null
  role:        'user' | 'admin' | 'super_admin'
  isLoaded:    boolean
  isSignedIn:  boolean
  signOut:     () => Promise<void>
  getToken:    () => Promise<string | null>
}

const VALUE: AuthContextValue = {
  user: { id: 'local', email: 'local@localhost' },
  session: null,
  role: 'super_admin',
  isLoaded: true,
  isSignedIn: true,
  signOut: async () => {},
  getToken: async () => null,
}

const AuthContext = createContext<AuthContextValue>(VALUE)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthContext.Provider value={VALUE}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
