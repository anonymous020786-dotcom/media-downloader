'use client'
import { useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthContext'
import { setApiUserId, setApiTokenGetter } from '@/lib/api'

/** Forwards the Supabase user id (rate limiting) and a session-token getter
 *  (for authenticated API calls) to the shared API client module. */
export default function AuthSync() {
  const { user, isLoaded, getToken } = useAuth()
  useEffect(() => {
    if (!isLoaded) return
    setApiUserId(user?.id ?? null)
    setApiTokenGetter(user ? getToken : null)
  }, [isLoaded, user, getToken])
  return null
}
