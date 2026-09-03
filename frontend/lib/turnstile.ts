/**
 * Cloudflare Turnstile — client-side token store.
 *
 * Inactive unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. When active, the
 * <Turnstile /> widget keeps a fresh token here; api.ts attaches it to every
 * /api/download request and asks the widget to mint a new one afterwards
 * (Turnstile tokens are single-use).
 */
export const TURNSTILE_SITE_KEY = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim()
export const turnstileEnabled = TURNSTILE_SITE_KEY.length > 0

let _token = ''
let _resetFn: (() => void) | null = null
const _waiters: Array<(t: string) => void> = []

export function setTurnstileToken(token: string) {
  _token = token || ''
  if (_token) {
    while (_waiters.length) _waiters.shift()!(_token)
  }
}

export function registerTurnstileReset(fn: (() => void) | null) {
  _resetFn = fn
}

/** Current token (may be empty if the widget hasn't solved yet). */
export function peekTurnstileToken() {
  return _token
}

/**
 * Resolve with a valid token, waiting up to `timeoutMs` for the widget to
 * solve if we don't have one yet. Returns '' if Turnstile is disabled.
 */
export function awaitTurnstileToken(timeoutMs = 20_000): Promise<string> {
  if (!turnstileEnabled) return Promise.resolve('')
  if (_token) return Promise.resolve(_token)
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      const i = _waiters.indexOf(cb)
      if (i >= 0) _waiters.splice(i, 1)
      resolve('')
    }, timeoutMs)
    const cb = (tok: string) => { clearTimeout(t); resolve(tok) }
    _waiters.push(cb)
  })
}

/** Consume the current token and trigger the widget to produce a fresh one. */
export function consumeTurnstileToken() {
  const used = _token
  _token = ''
  try { _resetFn?.() } catch { /* widget not mounted */ }
  return used
}
