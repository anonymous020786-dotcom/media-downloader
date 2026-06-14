'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface AuthContextValue {
  user:        User | null
  session:     Session | null
  role:        'user' | 'admin' | 'super_admin'
  isLoaded:    boolean
  isSignedIn:  boolean
  signOut:     () => Promise<void>
  getToken:    () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue>({
  user: null, session: null, role: 'user',
  isLoaded: false, isSignedIn: false,
  signOut: async () => {}, getToken: async () => null,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [user,     setUser]     = useState<User | null>(null)
  const [session,  setSession]  = useState<Session | null>(null)
  const [role,     setRole]     = useState<'user' | 'admin' | 'super_admin'>('user')
  const [isLoaded, setIsLoaded] = useState(false)

  const fetchRole = useCallback(async (accessToken: string) => {
    try {
      const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
      const res = await fetch(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (res.ok) { const d = await res.json(); setRole(d.role ?? 'user') }
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.access_token) fetchRole(data.session.access_token)
      setIsLoaded(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      setUser(sess?.user ?? null)
      if (sess?.access_token) fetchRole(sess.access_token)
      else setRole('user')
      setIsLoaded(true)
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  const signOut   = async () => { await supabase.auth.signOut() }
  const getToken  = async () => (await supabase.auth.getSession()).data.session?.access_token ?? null

  return (
    <AuthContext.Provider value={{ user, session, role, isLoaded, isSignedIn: !!user, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
