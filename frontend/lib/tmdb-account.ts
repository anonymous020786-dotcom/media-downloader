'use client'
// TMDB user-account client (login, watchlist, favorites, ratings, lists).
// Session lives in localStorage; all calls go through the secure backend proxy.
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

const SK = 'tmdb_session_id'
const AK = 'tmdb_account'

export interface TmdbAccount { id: number; username: string; name?: string; avatar?: any }
export const getSession = () => (typeof window === 'undefined' ? null : localStorage.getItem(SK))
export const getAccount = (): TmdbAccount | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(AK); return raw ? JSON.parse(raw) : null
}
export const isLoggedIn = () => !!getSession()

async function call(path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}/api/tmdb${path}`, { cache: 'no-store', ...init })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error ?? `TMDB ${r.status}`)
  return body
}
const sid = () => `session_id=${encodeURIComponent(getSession() ?? '')}`
const acct = () => `account_id=${getAccount()?.id ?? ''}`

// ── Auth flow ──────────────────────────────────────────────────────────────────
export async function startLogin() {
  const redirect = `${window.location.origin}/movies/account/callback`
  const { request_token, approve_url } = await call(`/auth/request-token?redirect_to=${encodeURIComponent(redirect)}`)
  sessionStorage.setItem('tmdb_req_token', request_token)
  window.location.href = approve_url
}
export async function completeLogin(requestToken: string) {
  const s = await call('/auth/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_token: requestToken }),
  })
  localStorage.setItem(SK, s.session_id)
  const me = await call(`/me?${sid()}`)
  localStorage.setItem(AK, JSON.stringify({ id: me.id, username: me.username, name: me.name, avatar: me.avatar }))
  return me
}
export async function logout() {
  const session_id = getSession()
  try { await call('/auth/session', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id }) }) } catch {}
  localStorage.removeItem(SK); localStorage.removeItem(AK)
}

// ── Account data ────────────────────────────────────────────────────────────────
export const accountList = (listType: 'favorite'|'watchlist'|'rated', media: 'movies'|'tv', page = 1) =>
  call(`/me/${listType}/${media}?${sid()}&${acct()}&page=${page}`)
export const accountLists = (page = 1) => call(`/me/lists?${sid()}&${acct()}&page=${page}`)
export const accountStates = (media: 'movie'|'tv', id: number) => call(`/states/${media}/${id}?${sid()}`)

// ── Write actions ───────────────────────────────────────────────────────────────
export const setFavorite = (media: 'movie'|'tv', id: number, favorite: boolean) =>
  call(`/me/favorite?${sid()}&${acct()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_type: media, media_id: id, favorite }) })
export const setWatchlist = (media: 'movie'|'tv', id: number, watchlist: boolean) =>
  call(`/me/watchlist?${sid()}&${acct()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_type: media, media_id: id, watchlist }) })
export const rate = (media: 'movie'|'tv', id: number, value: number) =>
  call(`/rate/${media}/${id}?${sid()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) })
export const unrate = (media: 'movie'|'tv', id: number) =>
  call(`/rate/${media}/${id}?${sid()}`, { method: 'DELETE' })

// ── Lists CRUD ──────────────────────────────────────────────────────────────────
export const createList = (name: string, description = '') =>
  call(`/lists?${sid()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, language: 'en' }) })
export const listDetails = (id: number) => call(`/lists/${id}`)
export const listAdd = (id: number, mediaId: number) =>
  call(`/lists/${id}/add?${sid()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_id: mediaId }) })
export const listRemove = (id: number, mediaId: number) =>
  call(`/lists/${id}/remove?${sid()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_id: mediaId }) })
export const listClear = (id: number) => call(`/lists/${id}/clear?${sid()}`, { method: 'POST' })
export const deleteList = (id: number) => call(`/lists/${id}?${sid()}`, { method: 'DELETE' })
