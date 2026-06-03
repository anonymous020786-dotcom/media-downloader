'use client'
import { useEffect, useState } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow]     = useState(false)

  useEffect(() => {
    if (localStorage.getItem('pwa-dismissed')) return
    // Already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show || !prompt) return null

  const install = async () => {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
  }

  const dismiss = () => {
    localStorage.setItem('pwa-dismissed', '1')
    setShow(false)
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 animate-slide-up">
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--brand)] shadow-2xl shadow-indigo-900/40">
        <div className="w-9 h-9 rounded-xl bg-[var(--brand)]/20 flex items-center justify-center shrink-0 mt-0.5">
          <Smartphone size={18} className="text-[var(--brand)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--text)]">Install MediaDL</p>
          <p className="text-xs text-[var(--text-3)] mt-0.5">Add to your home screen for faster access.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={install}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-xs font-semibold transition-colors">
              <Download size={11} /> Install
            </button>
            <button onClick={dismiss}
              className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-[var(--text-ghost)] hover:text-[var(--text-2)] shrink-0 mt-0.5">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
