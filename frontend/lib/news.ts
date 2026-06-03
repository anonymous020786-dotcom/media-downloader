const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const INTERNAL = typeof window === 'undefined'
  ? (process.env.BACKEND_INTERNAL_URL ?? BASE).replace(/\/$/, '')
  : BASE

export interface NewsItem { title: string; link: string; date: string; snippet: string; content?: string; source: string; category: string; image?: string }
export interface NewsResponse { category: string; q: string; source: string; total: number; page: number; limit: number; pages: number; sources: string[]; items: NewsItem[] }
export interface NewsCategory { category: string; slug: string; feeds: number; sources: string[] }
export interface NewsCategories { total_feeds: number; total_categories: number; categories: NewsCategory[] }

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${INTERNAL}${path}`, { cache: 'no-store' })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `News ${r.status}`)
  return r.json()
}

export const fetchNewsCategories = () => get<NewsCategories>('/api/news/categories')
export const fetchNews = (q: { category?: string; topic?: string; q?: string; source?: string; page?: number; limit?: number } = {}) => {
  const sp = new URLSearchParams()
  Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v)) })
  const qs = sp.toString()
  return get<NewsResponse>(`/api/news${qs ? `?${qs}` : ''}`)
}
