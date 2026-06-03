'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { DICT, RTL_LANGS, type Dict } from '@/lib/i18n'

interface Ctx { lang: string; setLang: (l: string) => void; t: (k: keyof Dict) => string }
const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k) => DICT.en[k] })

export function useLang() { return useContext(LangCtx) }

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState('en')

  useEffect(() => {
    const saved = localStorage.getItem('lang') || (navigator.language || 'en').split('-')[0]
    const code = DICT[saved] ? saved : 'en'
    setLangState(code)
    document.documentElement.lang = code
    document.documentElement.dir = RTL_LANGS.has(code) ? 'rtl' : 'ltr'
  }, [])

  const setLang = (l: string) => {
    const code = DICT[l] ? l : 'en'
    setLangState(code)
    localStorage.setItem('lang', code)
    document.documentElement.lang = code
    document.documentElement.dir = RTL_LANGS.has(code) ? 'rtl' : 'ltr'
  }

  const t = (k: keyof Dict) => (DICT[lang] ?? DICT.en)[k] ?? DICT.en[k]

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>
}
