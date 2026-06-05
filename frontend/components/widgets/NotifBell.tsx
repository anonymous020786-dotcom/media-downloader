'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Bell, BellOff, BellRing, X, Settings, CheckCircle2,
  XCircle, Loader2, Clock, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { requestFCMToken, onForegroundMessage, isFCMConfigured } from '@/lib/firebase'
import { registerPushToken, unregisterPushToken } from '@/lib/api'

// ── Notification history (stored in localStorage) ─────────────────────────────
interface NotifRecord { id: string; title: string; body: string; url?: string; ts: number; read: boolean }
const STORAGE_KEY = 'notif_history'
const MAX_HISTORY = 20

function loadHistory(): NotifRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveHistory(h: NotifRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)))
}
function addToHistory(title: string, body: string, url?: string) {
  const h = loadHistory()
  h.unshift({ id: crypto.randomUUID(), title, body, url, ts: Date.now(), read: false })
  saveHistory(h)
}

// ── Device ID for anonymous token registration ────────────────────────────────
function getDeviceId(): string {
  let id = localStorage.getItem('device_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('device_id', id) }
  return id
}

type Perm = NotificationPermission | 'loading'

export default function NotifBell() {
  const [perm,        setPerm]    = useState<Perm>('loading')
  const [fcmToken,    setFCMToken]= useState<string | null>(null)
  const [registering, setReg]     = useState(false)
  const [open,        setOpen]    = useState(false)
  const [history,     setHistory] = useState<NotifRecord[]>([])
  const [prefs,       setPrefs]   = useState({ onComplete: true, onFail: true, adminAlerts: false })
  const panelRef = useRef<HTMLDivElement>(null)

  // Load initial state
  useEffect(() => {
    if (typeof Notification === 'undefined') { setPerm('denied'); return }
    setPerm(Notification.permission)
    setHistory(loadHistory())

    // Load saved prefs
    try {
      const saved = JSON.parse(localStorage.getItem('notif_prefs') ?? '{}')
      setPrefs((p) => ({ ...p, ...saved }))
    } catch {}
  }, [])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Foreground FCM messages → show toast + add to history
  useEffect(() => {
    if (!isFCMConfigured()) return
    let unsub = () => {}
    onForegroundMessage((payload) => {
      const title = payload.notification?.title ?? 'MediaDL'
      const body  = payload.notification?.body  ?? ''
      const url   = payload.data?.url
      toast(title, { description: body, action: url ? { label: 'Open', onClick: () => window.open(url, '_self') } : undefined })
      addToHistory(title, body, url)
      setHistory(loadHistory())
    }).then((u) => { unsub = u })
    return () => unsub()
  }, [])

  // Save prefs when changed
  useEffect(() => {
    localStorage.setItem('notif_prefs', JSON.stringify(prefs))
  }, [prefs])

  const unread = history.filter((h) => !h.read).length

  if (perm === 'loading') return null

  // ── Request permission + register FCM token ───────────────────────────────
  const enable = async () => {
    setReg(true)
    try {
      const result = await Notification.requestPermission()
      setPerm(result)
      if (result !== 'granted') { setReg(false); return }

      // Send browser notification as confirmation
      new Notification('MediaDL notifications enabled ✓', {
        body: 'You\'ll get notified when downloads complete.',
        icon: '/logo.svg',
        tag: 'mediadl-enabled',
      })

      // Try Firebase FCM for push (even when tab is closed)
      if (isFCMConfigured()) {
        const token = await requestFCMToken()
        if (token) {
          setFCMToken(token)
          await registerPushToken(token, getDeviceId()).catch(() => {})
          toast.success('Push notifications enabled', { description: 'Works even when the tab is closed.' })
        }
      } else {
        toast.success('Notifications enabled', { description: 'In-tab notifications are active.' })
      }
    } catch (e: any) {
      toast.error('Could not enable notifications')
    } finally { setReg(false) }
  }

  const disable = async () => {
    // Note: browser doesn't allow programmatic permission revoke — guide user
    await unregisterPushToken(getDeviceId()).catch(() => {})
    setFCMToken(null)
    toast.info('Push token removed. To fully disable notifications, use browser settings.')
  }

  const clearHistory = () => {
    saveHistory([])
    setHistory([])
  }

  const markAllRead = () => {
    const h = history.map((n) => ({ ...n, read: true }))
    saveHistory(h)
    setHistory(h)
  }

  const isPushActive = perm === 'granted' && (fcmToken || !isFCMConfigured())

  // ── Compact icon (no bell panel) ─────────────────────────────────────────
  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => { if (perm !== 'granted') { enable(); return } setOpen(!open) }}
        title={perm === 'granted' ? 'Notification settings' : 'Enable notifications'}
        aria-label={perm === 'granted' ? 'Notification settings' : 'Enable notifications'}
        className={`relative p-2 rounded-xl transition-colors ${
          perm === 'granted'
            ? 'text-emerald-400 hover:bg-[var(--bg-hover)]'
            : 'text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--bg-hover)]'
        }`}>
        {registering
          ? <Loader2 size={16} className="animate-spin" />
          : perm === 'granted'
            ? <Bell size={16} />
            : <BellOff size={16} />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-black flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Notification panel ──────────────────────────────────────────── */}
      {open && perm === 'granted' && (
        <div className="absolute right-0 top-11 w-80 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <BellRing size={14} className="text-[var(--brand)]" />
              <span className="text-sm font-bold text-[var(--text)]">Notifications</span>
              {unread > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">{unread}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-[var(--brand)] hover:underline">Mark read</button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-[var(--text-3)] hover:text-[var(--text)]"><X size={13}/></button>
            </div>
          </div>

          {/* Push status */}
          <div className="px-4 py-2.5 bg-[var(--bg)] border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPushActive
                  ? <CheckCircle2 size={12} className="text-emerald-400"/>
                  : <XCircle size={12} className="text-amber-400"/>}
                <span className="text-xs text-[var(--text-2)]">
                  {isPushActive
                    ? isFCMConfigured() ? 'Push enabled (even when closed)' : 'In-tab notifications active'
                    : 'Background push inactive'}
                </span>
              </div>
              {isFCMConfigured() && isPushActive && (
                <button onClick={disable} className="text-[10px] text-red-400 hover:underline">Disable</button>
              )}
            </div>
          </div>

          {/* Preferences */}
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider mb-2">Notify me when</p>
            {[
              { key: 'onComplete', label: 'Download completes' },
              { key: 'onFail',     label: 'Download fails' },
            ].map((p) => (
              <label key={p.key} className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[p.key as keyof typeof prefs]}
                  onChange={(e) => setPrefs((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                  className="w-3.5 h-3.5 accent-[var(--brand)]"
                />
                <span className="text-xs text-[var(--text-2)]">{p.label}</span>
              </label>
            ))}
          </div>

          {/* History */}
          <div className="max-h-52 overflow-y-auto">
            {history.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-[var(--text-3)]">
                <Bell size={24} strokeWidth={1.2} className="mb-2"/>
                <p className="text-xs">No notifications yet</p>
              </div>
            ) : (
              history.map((n) => (
                <div key={n.id}
                  className={`flex gap-2.5 px-4 py-3 border-b border-[var(--border)] last:border-0 ${n.read ? '' : 'bg-blue-950/20'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${n.read ? 'bg-[var(--border)]' : 'bg-blue-400'}`}/>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text)] line-clamp-1">{n.title}</p>
                    <p className="text-[11px] text-[var(--text-3)] line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-[var(--text-3)] mt-0.5 flex items-center gap-1">
                      <Clock size={9}/>{new Date(n.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {history.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[var(--border)]">
              <button onClick={clearHistory} className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] hover:text-red-400 transition-colors">
                <Trash2 size={11}/> Clear history
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
