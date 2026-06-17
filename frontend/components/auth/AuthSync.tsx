'use client'
import { useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthContext'
import { setApiUserId, setApiTokenGetter } from '@/lib/api'

/** Forwards the Supabase user id (rate limiting) and a session-token getter
 *  (for authenticated API calls) to the shared API client module. */
export default function AuthSync() {
  const { user, isLoaded, getToken } = useAuth()
  useEffect(() => {
    // Always wire the token getter — it reads the live Supabase session and
    // returns null only when genuinely signed out. Wiring it unconditionally
    // (not just after `isLoaded`) avoids a race where early API calls fire
    // before auth finishes loading and get a spurious 401 "Authentication required".
    setApiTokenGetter(getToken)
    if (isLoaded) setApiUserId(user?.id ?? null)
  }, [isLoaded, user, getToken])
  return null
}
