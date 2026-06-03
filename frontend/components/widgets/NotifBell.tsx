'use client'
import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

export default function NotifBell() {
  const [perm, setPerm] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPerm(Notification.permission)
  }, [])

  // Don't render if API unavailable or already permanently denied
  if (typeof Notification === 'undefined') return null
  if (perm === 'denied') return null

  const request = async () => {
    const result = await Notification.requestPermission()
    setPerm(result)
  }

  if (perm === 'granted') {
    return (
      <button
        title="Notifications enabled"
        className="p-2 rounded-xl text-emerald-400 cursor-default"
        aria-label="Notifications enabled">
        <Bell size={16} />
      </button>
    )
  }

  return (
    <button
      onClick={request}
      title="Enable download notifications"
      className="p-2 rounded-xl text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-colors"
      aria-label="Enable notifications">
      <BellOff size={16} />
    </button>
  )
}
