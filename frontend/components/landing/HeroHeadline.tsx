'use client'
import { useLang } from '@/components/i18n/LanguageProvider'

export default function HeroHeadline() {
  const { t } = useLang()
  return (
    <>
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight mb-6 animate-fade-up">
        {t('heroTitle1')}<br />
        <span className="gradient-text">{t('heroTitle2')}</span>
      </h1>
      <p className="text-lg text-[var(--text-2)] max-w-2xl mx-auto mb-10 animate-fade-up stagger-2 leading-relaxed">
        {t('heroSubtitle')}
      </p>
    </>
  )
}
