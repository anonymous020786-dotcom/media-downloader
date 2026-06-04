'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie, X, Check, Settings, ChevronDown } from 'lucide-react'

interface ConsentState {
  necessary: true
  analytics:   boolean
  marketing:   boolean
  preferences: boolean
}

const LS_KEY = 'cookie_consent'

function loadConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveConsent(c: ConsentState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(c)) } catch {}
}

export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  return loadConsent()
}

export default function CookieBanner() {
  const [visible,  setVisible]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [consent,  setConsent]  = useState<ConsentState>({
    necessary: true, analytics: false, marketing: false, preferences: false,
  })

  useEffect(() => {
    if (!loadConsent()) {
      // Small delay so it doesn't flash immediately on first paint
      const t = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(t)
    }
  }, [])

  if (!visible) return null

  const acceptAll = () => {
    const c: ConsentState = { necessary: true, analytics: true, marketing: true, preferences: true }
    saveConsent(c)
    setVisible(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: c }))
  }

  const rejectAll = () => {
    const c: ConsentState = { necessary: true, analytics: false, marketing: false, preferences: false }
    saveConsent(c)
    setVisible(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: c }))
  }

  const saveCustom = () => {
    saveConsent(consent)
    setVisible(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: consent }))
  }

  const toggle = (key: keyof Omit<ConsentState, 'necessary'>) =>
    setConsent((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 flex justify-center pointer-events-none">
      <div className="w-full max-w-2xl pointer-events-auto animate-in"
        style={{ animation: 'slide-up 0.3s ease-out both' }}>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">

          {/* Main bar */}
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-8 h-8 rounded-xl bg-[var(--brand)]/20 flex items-center justify-center shrink-0 mt-0.5">
                <Cookie size={15} className="text-[var(--brand)]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text)] mb-0.5">We use cookies</p>
                <p className="text-xs text-[var(--text-2)] leading-relaxed">
                  We use cookies to improve your experience and for analytics. By clicking "Accept All" you
                  consent to our{' '}
                  <Link href="/cookie-policy" className="text-[var(--brand)] hover:underline" onClick={() => setVisible(false)}>Cookie Policy</Link>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Settings size={12} />
                Customize
                <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={rejectAll}
                className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={acceptAll}
                className="px-4 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-xs font-bold transition-colors"
              >
                Accept All
              </button>
              <button onClick={rejectAll} className="text-[var(--text-3)] hover:text-[var(--text-2)] p-1">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Expandable categories */}
          {expanded && (
            <div className="border-t border-[var(--border)] px-5 py-4 space-y-3">
              <p className="text-[10px] text-[var(--text-3)] uppercase tracking-widest font-bold mb-3">Cookie categories</p>

              {[
                {
                  key: 'necessary' as const,
                  label: 'Strictly necessary',
                  desc: 'Required for the site to function. Cannot be disabled.',
                  locked: true,
                  value: true,
                },
                {
                  key: 'analytics' as const,
                  label: 'Analytics',
                  desc: 'Help us understand how visitors use the site (Google Analytics).',
                  locked: false,
                  value: consent.analytics,
                },
                {
                  key: 'marketing' as const,
                  label: 'Marketing',
                  desc: 'Used for targeted advertising and measuring ad effectiveness (AdSense).',
                  locked: false,
                  value: consent.marketing,
                },
                {
                  key: 'preferences' as const,
                  label: 'Preferences',
                  desc: 'Remember your settings like language, theme and accessibility options.',
                  locked: false,
                  value: consent.preferences,
                },
              ].map((cat) => (
                <div key={cat.key} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text)]">{cat.label}</p>
                    <p className="text-[10px] text-[var(--text-3)] leading-relaxed">{cat.desc}</p>
                  </div>
                  <button
                    disabled={cat.locked}
                    onClick={() => !cat.locked && toggle(cat.key as keyof Omit<ConsentState, 'necessary'>)}
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                      cat.value
                        ? cat.locked ? 'bg-[var(--text-3)]' : 'bg-[var(--brand)]'
                        : 'bg-[var(--bg-hover)] border border-[var(--border)]'
                    } ${cat.locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    aria-label={`Toggle ${cat.label}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${cat.value ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}

              <div className="flex justify-end pt-2">
                <button
                  onClick={saveCustom}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-xs font-bold transition-colors"
                >
                  <Check size={12} /> Save preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
