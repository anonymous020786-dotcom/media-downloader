/**
 * Google reCAPTCHA v3 helper.
 *
 * Usage:
 *   const getToken = useRecaptcha()
 *   const token = await getToken('contact_form')   // action name for score breakdown
 *   // send token to your backend → POST /api/recaptcha/verify
 *
 * The script is loaded lazily on first call — no perf hit on pages that never
 * need it. The site key is read from NEXT_PUBLIC_RECAPTCHA_SITE_KEY; if it is
 * absent we skip silently so local dev works without keys.
 */

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, opts: { action: string }) => Promise<string>
    }
  }
}

let _loaded = false

function loadScript(siteKey: string): Promise<void> {
  if (_loaded || typeof document === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
    s.async = true
    s.onload = () => { _loaded = true; resolve() }
    s.onerror = () => resolve() // fail silently
    document.head.appendChild(s)
  })
}

export async function getRecaptchaToken(action: string): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  if (!siteKey) return null
  try {
    await loadScript(siteKey)
    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(siteKey, { action })
          resolve(token)
        } catch (e) { reject(e) }
      })
    })
  } catch { return null }
}
