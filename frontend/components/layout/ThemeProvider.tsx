'use client'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

export interface Accent { id: string; label: string; brand: string; dark: string; accent: string }

export const ACCENTS: Accent[] = [
  { id: 'indigo',  label: 'Indigo',  brand: '#6366f1', dark: '#4f46e5', accent: '#8b5cf6' },
  { id: 'emerald', label: 'Emerald', brand: '#10b981', dark: '#059669', accent: '#14b8a6' },
  { id: 'rose',    label: 'Rose',    brand: '#f43f5e', dark: '#e11d48', accent: '#fb7185' },
  { id: 'amber',   label: 'Amber',   brand: '#f59e0b', dark: '#d97706', accent: '#f97316' },
  { id: 'cyan',    label: 'Cyan',    brand: '#06b6d4', dark: '#0891b2', accent: '#3b82f6' },
  { id: 'violet',  label: 'Violet',  brand: '#8b5cf6', dark: '#7c3aed', accent: '#d946ef' },
]

interface Ctx {
  theme: Theme; toggle: () => void
  accent: string; setAccent: (id: string) => void
}
const Ctx = createContext<Ctx>({ theme: 'dark', toggle: () => {}, accent: 'indigo', setAccent: () => {} })

export function useTheme() { return useContext(Ctx) }

function applyAccent(id: string) {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0]
  const r = document.documentElement
  r.style.setProperty('--brand', a.brand)
  r.style.setProperty('--brand-dark', a.dark)
  r.style.setProperty('--accent', a.accent)
  r.style.setProperty('--border-focus', a.brand)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme]  = useState<Theme>('dark')
  const [accent, setAcc]   = useState('indigo')

  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') as Theme) ?? 'dark'
    const savedAcc   = localStorage.getItem('accent') ?? 'indigo'
    setTheme(savedTheme); setAcc(savedAcc)
    document.documentElement.setAttribute('data-theme', savedTheme)
    applyAccent(savedAcc)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const setAccent = (id: string) => {
    setAcc(id)
    localStorage.setItem('accent', id)
    applyAccent(id)
  }

  return <Ctx.Provider value={{ theme, toggle, accent, setAccent }}>{children}</Ctx.Provider>
}
