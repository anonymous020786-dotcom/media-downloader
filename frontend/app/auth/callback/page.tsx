'use client'
import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const ran          = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code        = searchParams.get('code')
    const redirectUrl = searchParams.get('redirect_url') ?? '/download'
    const next        = redirectUrl.startsWith('/') ? redirectUrl : '/download'

    if (!code) {
      router.replace('/sign-in?error=no_code')
      return
    }

    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        router.replace(`/sign-in?error=${encodeURIComponent(error.message)}`)
      } else {
        router.replace(next)
      }
    })
  }, [router, searchParams])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center text-[var(--text-3)]">Signing you in…</div>
    </div>
  )
}
