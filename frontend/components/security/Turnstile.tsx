'use client'
import { useEffect, useRef } from 'react'
import Script from 'next/script'
import {
  TURNSTILE_SITE_KEY, turnstileEnabled,
  setTurnstileToken, registerTurnstileReset,
} from '@/lib/turnstile'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
    onTurnstileLoad?: () => void
  }
}

/**
 * Renders a single managed Cloudflare Turnstile widget and feeds its token into
 * the shared store (lib/turnstile). Mounted once in the root layout. Renders
 * nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset.
 *
 * `appearance: 'interaction-only'` keeps it invisible unless Cloudflare decides
 * the visitor needs to interact.
 */
export default function Turnstile() {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!turnstileEnabled) return

    const mount = () => {
      if (!window.turnstile || !boxRef.current || widgetId.current) return
      widgetId.current = window.turnstile.render(boxRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: 'interaction-only',
        retry: 'auto',
        'refresh-expired': 'auto',
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      })
      registerTurnstileReset(() => {
        try { window.turnstile?.reset(widgetId.current ?? undefined) } catch { /* ignore */ }
      })
    }

    window.onTurnstileLoad = mount
    mount() // in case the script is already loaded

    return () => {
      registerTurnstileReset(null)
      try {
        if (widgetId.current) window.turnstile?.remove(widgetId.current)
      } catch { /* ignore */ }
      widgetId.current = null
    }
  }, [])

  if (!turnstileEnabled) return null

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit"
        strategy="afterInteractive"
      />
      <div
        ref={boxRef}
        aria-hidden="true"
        style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 60 }}
      />
    </>
  )
}
