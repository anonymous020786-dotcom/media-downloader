'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, ArrowRight, ClipboardPaste } from 'lucide-react'
import { toast } from 'sonner'
import { useLang } from '@/components/i18n/LanguageProvider'

export default function HeroInput() {
  const [url, setUrl] = useState('')
  const router = useRouter()
  const { t } = useLang()

  const go = (target?: string) => {
    const u = (target ?? url).trim()
    if (!u) return
    router.push(`/download?url=${encodeURIComponent(u)}`)
  }

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrl(text.trim())
        if (/^https?:\/\//i.test(text.trim())) go(text.trim())
      }
    } catch {
      toast.error('Clipboard access denied — paste manually with Ctrl+V')
    }
  }

  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="flex items-center gap-2 p-2 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border)] focus-within:border-[var(--brand)] transition-colors shadow-2xl shadow-black/30">
        <Link2 size={16} className="ml-3 text-[var(--text-3)] shrink-0" />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder={t('pasteHint')}
          className="flex-1 bg-transparent text-[var(--text)] placeholder-[var(--text-3)] outline-none text-sm py-2 px-2 min-w-0"
        />
        <button
          onClick={paste}
          title={t('paste')}
          className="hidden sm:flex items-center gap-1.5 px-3 py-3 text-[var(--text-2)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--bg-hover)] transition-colors shrink-0"
        >
          <ClipboardPaste size={15} /> <span className="text-xs font-semibold">{t('paste')}</span>
        </button>
        <button
          onClick={() => go()}
          disabled={!url.trim()}
          className="flex items-center gap-2 px-5 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors shrink-0"
        >
          {t('ctaDownload')} <ArrowRight size={15} />
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--text-3)] text-center">
        By using MediaDL you agree to our{' '}
        <a href="/terms-of-service" className="underline hover:text-[var(--text-2)]">Terms of Service</a>
        {' '}and{' '}
        <a href="/privacy-policy" className="underline hover:text-[var(--text-2)]">Privacy Policy</a>
      </p>
    </div>
  )
}
