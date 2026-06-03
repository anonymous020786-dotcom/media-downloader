'use client'
import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { setApiUserId, setApiTokenGetter } from '@/lib/api'

/** Forwards the Clerk user id (rate limiting) and a session-token getter (verified
 *  admin calls) to the API client. */
export default function AuthSync() {
  const { userId, isLoaded, getToken } = useAuth()
  useEffect(() => {
    if (!isLoaded) return
    setApiUserId(userId ?? null)
    setApiTokenGetter(userId ? () => getToken() : null)
  }, [isLoaded, userId, getToken])
  return null
}
