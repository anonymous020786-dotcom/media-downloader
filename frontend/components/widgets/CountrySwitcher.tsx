'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { MapPin, Search, X, Check, ChevronDown, Clock } from 'lucide-react'

// ── Data ──────────────────────────────────────────────────────────────────────
export interface Country {
  code:   string   // ISO 3166-1 alpha-2
  name:   string
  flag:   string
  region: string
  tz:     string   // representative IANA timezone for clock display
  currency?: string
  dialCode?: string
}

const COUNTRIES: Country[] = [
  // Americas
  { code:'US', name:'United States',   flag:'🇺🇸', region:'Americas',      tz:'America/New_York',       currency:'USD', dialCode:'+1'    },
  { code:'CA', name:'Canada',          flag:'🇨🇦', region:'Americas',      tz:'America/Toronto',        currency:'CAD', dialCode:'+1'    },
  { code:'MX', name:'Mexico',          flag:'🇲🇽', region:'Americas',      tz:'America/Mexico_City',    currency:'MXN', dialCode:'+52'   },
  { code:'BR', name:'Brazil',          flag:'🇧🇷', region:'Americas',      tz:'America/Sao_Paulo',      currency:'BRL', dialCode:'+55'   },
  { code:'AR', name:'Argentina',       flag:'🇦🇷', region:'Americas',      tz:'America/Argentina/Buenos_Aires', currency:'ARS', dialCode:'+54' },
  { code:'CO', name:'Colombia',        flag:'🇨🇴', region:'Americas',      tz:'America/Bogota',         currency:'COP', dialCode:'+57'   },
  { code:'CL', name:'Chile',           flag:'🇨🇱', region:'Americas',      tz:'America/Santiago',       currency:'CLP', dialCode:'+56'   },
  { code:'PE', name:'Peru',            flag:'🇵🇪', region:'Americas',      tz:'America/Lima',           currency:'PEN', dialCode:'+51'   },
  // Europe
  { code:'GB', name:'United Kingdom',  flag:'🇬🇧', region:'Europe',        tz:'Europe/London',          currency:'GBP', dialCode:'+44'   },
  { code:'DE', name:'Germany',         flag:'🇩🇪', region:'Europe',        tz:'Europe/Berlin',          currency:'EUR', dialCode:'+49'   },
  { code:'FR', name:'France',          flag:'🇫🇷', region:'Europe',        tz:'Europe/Paris',           currency:'EUR', dialCode:'+33'   },
  { code:'IT', name:'Italy',           flag:'🇮🇹', region:'Europe',        tz:'Europe/Rome',            currency:'EUR', dialCode:'+39'   },
  { code:'ES', name:'Spain',           flag:'🇪🇸', region:'Europe',        tz:'Europe/Madrid',          currency:'EUR', dialCode:'+34'   },
  { code:'NL', name:'Netherlands',     flag:'🇳🇱', region:'Europe',        tz:'Europe/Amsterdam',       currency:'EUR', dialCode:'+31'   },
  { code:'PL', name:'Poland',          flag:'🇵🇱', region:'Europe',        tz:'Europe/Warsaw',          currency:'PLN', dialCode:'+48'   },
  { code:'RU', name:'Russia',          flag:'🇷🇺', region:'Europe',        tz:'Europe/Moscow',          currency:'RUB', dialCode:'+7'    },
  { code:'SE', name:'Sweden',          flag:'🇸🇪', region:'Europe',        tz:'Europe/Stockholm',       currency:'SEK', dialCode:'+46'   },
  { code:'NO', name:'Norway',          flag:'🇳🇴', region:'Europe',        tz:'Europe/Oslo',            currency:'NOK', dialCode:'+47'   },
  { code:'CH', name:'Switzerland',     flag:'🇨🇭', region:'Europe',        tz:'Europe/Zurich',          currency:'CHF', dialCode:'+41'   },
  { code:'PT', name:'Portugal',        flag:'🇵🇹', region:'Europe',        tz:'Europe/Lisbon',          currency:'EUR', dialCode:'+351'  },
  { code:'UA', name:'Ukraine',         flag:'🇺🇦', region:'Europe',        tz:'Europe/Kyiv',            currency:'UAH', dialCode:'+380'  },
  // Middle East & Africa
  { code:'SA', name:'Saudi Arabia',    flag:'🇸🇦', region:'Middle East',   tz:'Asia/Riyadh',            currency:'SAR', dialCode:'+966'  },
  { code:'AE', name:'United Arab Emirates', flag:'🇦🇪', region:'Middle East', tz:'Asia/Dubai',          currency:'AED', dialCode:'+971'  },
  { code:'TR', name:'Turkey',          flag:'🇹🇷', region:'Middle East',   tz:'Europe/Istanbul',        currency:'TRY', dialCode:'+90'   },
  { code:'EG', name:'Egypt',           flag:'🇪🇬', region:'Middle East',   tz:'Africa/Cairo',           currency:'EGP', dialCode:'+20'   },
  { code:'IL', name:'Israel',          flag:'🇮🇱', region:'Middle East',   tz:'Asia/Jerusalem',         currency:'ILS', dialCode:'+972'  },
  { code:'ZA', name:'South Africa',    flag:'🇿🇦', region:'Africa',        tz:'Africa/Johannesburg',    currency:'ZAR', dialCode:'+27'   },
  { code:'NG', name:'Nigeria',         flag:'🇳🇬', region:'Africa',        tz:'Africa/Lagos',           currency:'NGN', dialCode:'+234'  },
  { code:'KE', name:'Kenya',           flag:'🇰🇪', region:'Africa',        tz:'Africa/Nairobi',         currency:'KES', dialCode:'+254'  },
  // South & Central Asia
  { code:'IN', name:'India',           flag:'🇮🇳', region:'South Asia',    tz:'Asia/Kolkata',           currency:'INR', dialCode:'+91'   },
  { code:'PK', name:'Pakistan',        flag:'🇵🇰', region:'South Asia',    tz:'Asia/Karachi',           currency:'PKR', dialCode:'+92'   },
  { code:'BD', name:'Bangladesh',      flag:'🇧🇩', region:'South Asia',    tz:'Asia/Dhaka',             currency:'BDT', dialCode:'+880'  },
  // East Asia
  { code:'CN', name:'China',           flag:'🇨🇳', region:'East Asia',     tz:'Asia/Shanghai',          currency:'CNY', dialCode:'+86'   },
  { code:'JP', name:'Japan',           flag:'🇯🇵', region:'East Asia',     tz:'Asia/Tokyo',             currency:'JPY', dialCode:'+81'   },
  { code:'KR', name:'South Korea',     flag:'🇰🇷', region:'East Asia',     tz:'Asia/Seoul',             currency:'KRW', dialCode:'+82'   },
  { code:'TW', name:'Taiwan',          flag:'🇹🇼', region:'East Asia',     tz:'Asia/Taipei',            currency:'TWD', dialCode:'+886'  },
  { code:'HK', name:'Hong Kong',       flag:'🇭🇰', region:'East Asia',     tz:'Asia/Hong_Kong',         currency:'HKD', dialCode:'+852'  },
  // Southeast Asia
  { code:'ID', name:'Indonesia',       flag:'🇮🇩', region:'Southeast Asia',tz:'Asia/Jakarta',           currency:'IDR', dialCode:'+62'   },
  { code:'VN', name:'Vietnam',         flag:'🇻🇳', region:'Southeast Asia',tz:'Asia/Ho_Chi_Minh',       currency:'VND', dialCode:'+84'   },
  { code:'TH', name:'Thailand',        flag:'🇹🇭', region:'Southeast Asia',tz:'Asia/Bangkok',           currency:'THB', dialCode:'+66'   },
  { code:'PH', name:'Philippines',     flag:'🇵🇭', region:'Southeast Asia',tz:'Asia/Manila',            currency:'PHP', dialCode:'+63'   },
  { code:'MY', name:'Malaysia',        flag:'🇲🇾', region:'Southeast Asia',tz:'Asia/Kuala_Lumpur',      currency:'MYR', dialCode:'+60'   },
  { code:'SG', name:'Singapore',       flag:'🇸🇬', region:'Southeast Asia',tz:'Asia/Singapore',         currency:'SGD', dialCode:'+65'   },
  // Oceania
  { code:'AU', name:'Australia',       flag:'🇦🇺', region:'Oceania',       tz:'Australia/Sydney',       currency:'AUD', dialCode:'+61'   },
  { code:'NZ', name:'New Zealand',     flag:'🇳🇿', region:'Oceania',       tz:'Pacific/Auckland',       currency:'NZD', dialCode:'+64'   },
]

const REGIONS = ['Americas','Europe','Middle East','Africa','South Asia','East Asia','Southeast Asia','Oceania']

const LS_KEY = 'selected_country'

function localTime(tz: string) {
  try {
    return new Intl.DateTimeFormat('en', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
    }).format(new Date())
  } catch { return '' }
}

// ── Auto-detect country via Intl API (no external call) ───────────────────────
function detectCountry(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    // Map common timezones to country codes
    const TZ_MAP: Record<string, string> = {
      'America/New_York':'US','America/Chicago':'US','America/Denver':'US','America/Los_Angeles':'US',
      'America/Phoenix':'US','America/Anchorage':'US','Pacific/Honolulu':'US',
      'America/Toronto':'CA','America/Vancouver':'CA','America/Winnipeg':'CA',
      'America/Mexico_City':'MX','America/Sao_Paulo':'BR','America/Argentina/Buenos_Aires':'AR',
      'America/Bogota':'CO','America/Santiago':'CL','America/Lima':'PE',
      'Europe/London':'GB','Europe/Berlin':'DE','Europe/Paris':'FR','Europe/Rome':'IT',
      'Europe/Madrid':'ES','Europe/Amsterdam':'NL','Europe/Warsaw':'PL','Europe/Moscow':'RU',
      'Europe/Stockholm':'SE','Europe/Oslo':'NO','Europe/Zurich':'CH','Europe/Lisbon':'PT',
      'Europe/Kyiv':'UA','Europe/Istanbul':'TR','Europe/Athens':'GR',
      'Asia/Riyadh':'SA','Asia/Dubai':'AE','Africa/Cairo':'EG','Asia/Jerusalem':'IL',
      'Africa/Johannesburg':'ZA','Africa/Lagos':'NG','Africa/Nairobi':'KE',
      'Asia/Kolkata':'IN','Asia/Karachi':'PK','Asia/Dhaka':'BD',
      'Asia/Shanghai':'CN','Asia/Tokyo':'JP','Asia/Seoul':'KR','Asia/Taipei':'TW',
      'Asia/Hong_Kong':'HK','Asia/Jakarta':'ID','Asia/Ho_Chi_Minh':'VN',
      'Asia/Bangkok':'TH','Asia/Manila':'PH','Asia/Kuala_Lumpur':'MY','Asia/Singapore':'SG',
      'Australia/Sydney':'AU','Australia/Melbourne':'AU','Pacific/Auckland':'NZ',
    }
    return TZ_MAP[tz] ?? null
  } catch { return null }
}

// ── Context ───────────────────────────────────────────────────────────────────
import { createContext, useContext } from 'react'

interface CountryCtx { country: Country; setCountry: (c: Country) => void }
const Ctx = createContext<CountryCtx>({ country: COUNTRIES[0], setCountry: () => {} })
export const useCountry = () => useContext(Ctx)

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [country, _set] = useState<Country>(() => {
    // Server render: default to US
    return COUNTRIES[0]
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        const found = COUNTRIES.find((c) => c.code === saved)
        if (found) { _set(found); return }
      }
    } catch {}
    const detected = detectCountry()
    if (detected) {
      const found = COUNTRIES.find((c) => c.code === detected)
      if (found) _set(found)
    }
  }, [])

  const setCountry = (c: Country) => {
    _set(c)
    try { localStorage.setItem(LS_KEY, c.code) } catch {}
  }

  return <Ctx.Provider value={{ country, setCountry }}>{children}</Ctx.Provider>
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CountrySwitcher() {
  const { country, setCountry } = useCountry()
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const [time,  setTime]  = useState('')
  const ref      = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Live clock
  useEffect(() => {
    setTime(localTime(country.tz))
    const t = setInterval(() => setTime(localTime(country.tz)), 10_000)
    return () => clearInterval(t)
  }, [country.tz])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return COUNTRIES.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.currency ?? '').toLowerCase().includes(q) ||
      (c.dialCode ?? '').includes(q)
    )
  }, [query])

  const pick = (c: Country) => { setCountry(c); setOpen(false); setQuery('') }

  const grouped = useMemo(() => {
    return REGIONS.map((r) => ({
      label: r,
      countries: COUNTRIES.filter((c) => c.region === r),
    }))
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Select country: ${country.name}`}
        aria-expanded={open}
        title={`${country.name}${time ? ` · ${time}` : ''}`}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors text-sm"
      >
        <span className="text-sm leading-none">{country.flag}</span>
        <span className="hidden sm:inline text-xs font-medium">{country.code}</span>
        {time && <span className="hidden lg:inline text-[10px] text-[var(--text-3)]">{time}</span>}
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)]">
              <Search size={13} className="text-[var(--text-3)] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country, code, currency…"
                aria-label="Search countries"
                className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear search" className="text-[var(--text-3)] hover:text-[var(--text)]">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {filtered ? (
              <div className="py-1.5">
                {filtered.length === 0
                  ? <p className="px-4 py-3 text-sm text-[var(--text-3)] text-center">No countries found</p>
                  : filtered.map((c) => <CountryRow key={c.code} c={c} active={c.code === country.code} onPick={pick} />)
                }
              </div>
            ) : (
              <>
                {/* Current */}
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-[10px] text-[var(--text-3)] uppercase tracking-widest font-bold px-1 mb-1">Current</p>
                  <CountryRow c={country} active={true} onPick={pick} showTime />
                </div>

                {/* Grouped */}
                {grouped.map((g) => {
                  const others = g.countries.filter((c) => c.code !== country.code)
                  if (others.length === 0) return null
                  return (
                    <div key={g.label} className="px-3 pb-1">
                      <p className="text-[10px] text-[var(--text-3)] uppercase tracking-widest font-bold px-1 mb-1 mt-2">
                        {g.label}
                      </p>
                      {others.map((c) => <CountryRow key={c.code} c={c} active={false} onPick={pick} />)}
                    </div>
                  )
                })}
                <div className="h-2" />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--bg-hover)]/30 flex items-center gap-1.5">
            <MapPin size={10} className="text-[var(--brand)] shrink-0" />
            <p className="text-[10px] text-[var(--text-3)]">
              Your country affects content relevance and local formatting.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function CountryRow({
  c, active, onPick, showTime,
}: { c: Country; active: boolean; onPick: (c: Country) => void; showTime?: boolean }) {
  const t = showTime ? localTime(c.tz) : ''
  return (
    <button
      onClick={() => onPick(c)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
        active
          ? 'bg-[var(--brand)]/10 text-[var(--text)]'
          : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
      }`}
    >
      <span className="text-base w-6 text-center shrink-0 leading-none">{c.flag}</span>
      <span className="flex-1 text-left font-medium truncate">{c.name}</span>
      <span className="text-[11px] text-[var(--text-3)] shrink-0">{c.code}</span>
      {c.currency && <span className="text-[10px] text-[var(--text-3)] shrink-0">{c.currency}</span>}
      {t && <span className="text-[10px] text-[var(--brand)]/70 font-mono shrink-0">{t}</span>}
      {active && <Check size={13} className="text-[var(--brand)] shrink-0" />}
    </button>
  )
}
