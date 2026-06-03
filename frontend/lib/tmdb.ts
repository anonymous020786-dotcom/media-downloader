// Client for the server-side TMDB proxy (/api/tmdb/*). The key stays on the server.
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const INTERNAL = typeof window === 'undefined'
  ? (process.env.BACKEND_INTERNAL_URL ?? BASE).replace(/\/$/, '')
  : BASE

export const IMG = 'https://image.tmdb.org/t/p'
export const img = (path?: string | null, size: 'w92'|'w185'|'w300'|'w500'|'w780'|'original' = 'w500') =>
  path ? `${IMG}/${size}${path}` : ''

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const sp = new URLSearchParams()
  if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') sp.set(k, String(v)) })
  const qs = sp.toString()
  const r = await fetch(`${INTERNAL}/api/tmdb${path}${qs ? `?${qs}` : ''}`, { cache: 'no-store' })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `TMDB ${r.status}`)
  return r.json()
}

// Raw call to any TMDB read endpoint (used by the API Explorer). Always client-side.
export async function tmdbRaw(path: string, params?: Record<string, string | number | undefined>): Promise<any> {
  const sp = new URLSearchParams()
  if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') sp.set(k, String(v)) })
  const qs = sp.toString()
  const r = await fetch(`${BASE}/api/tmdb${path}${qs ? `?${qs}` : ''}`, { cache: 'no-store' })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error ?? `TMDB ${r.status}`)
  return body
}

export interface TmdbItem {
  id: number; media_type?: 'movie'|'tv'|'person'
  title?: string; name?: string; original_title?: string; original_name?: string
  overview?: string; poster_path?: string | null; backdrop_path?: string | null
  profile_path?: string | null; release_date?: string; first_air_date?: string
  vote_average?: number; vote_count?: number; popularity?: number
  genre_ids?: number[]; known_for_department?: string; character?: string; job?: string
}
export interface Paged<T> { page: number; results: T[]; total_pages: number; total_results: number }
export interface Genre { id: number; name: string }

export const tmdbStatus    = () => get<{ configured: boolean; mode: string }>('/status')
export const tmdbTrending  = (media: 'all'|'movie'|'tv'|'person' = 'all', window: 'day'|'week' = 'week', page = 1) =>
  get<Paged<TmdbItem>>(`/trending/${media}/${window}`, { page })
export const tmdbSearch    = (kind: 'multi'|'movie'|'tv'|'person', query: string, page = 1) =>
  get<Paged<TmdbItem>>(`/search/${kind}`, { query, page, include_adult: 'false' })
export const tmdbList      = (media: 'movie'|'tv', category: string, page = 1) =>
  get<Paged<TmdbItem>>(`/${media}/${category}`, { page })
export const tmdbDiscover  = (media: 'movie'|'tv', params: Record<string, string | number | undefined>) =>
  get<Paged<TmdbItem>>(`/discover/${media}`, params)
export const tmdbGenres    = (media: 'movie'|'tv') => get<{ genres: Genre[] }>(`/genre/${media}/list`)

const MOVIE_APPEND = 'credits,videos,images,recommendations,similar,reviews,watch/providers,external_ids,keywords,release_dates,alternative_titles,translations,lists'
const TV_APPEND = 'aggregate_credits,credits,videos,images,recommendations,similar,reviews,watch/providers,external_ids,keywords,content_ratings,alternative_titles,translations,episode_groups,screened_theatrically'
export const tmdbDetail = (media: 'movie'|'tv', id: string) =>
  get<any>(`/${media}/${id}`, { append_to_response: media === 'movie' ? MOVIE_APPEND : TV_APPEND })
export const tmdbPerson = (id: string) =>
  get<any>(`/person/${id}`, { append_to_response: 'combined_credits,movie_credits,tv_credits,images,external_ids,tagged_images,translations' })

export const tmdbSeason  = (tvId: string, n: string) =>
  get<any>(`/tv/${tvId}/season/${n}`, { append_to_response: 'credits,aggregate_credits,videos,images,external_ids,translations' })
export const tmdbEpisode = (tvId: string, s: string, e: string) =>
  get<any>(`/tv/${tvId}/season/${s}/episode/${e}`, { append_to_response: 'credits,videos,images,external_ids,translations' })
export const tmdbCollection = (id: string) =>
  get<any>(`/collection/${id}`, { append_to_response: 'images,translations' })
export const tmdbCompany = (id: string) => get<any>(`/company/${id}`)
export const tmdbCompanyImages = (id: string) => get<any>(`/company/${id}/images`)
export const tmdbNetwork = (id: string) => get<any>(`/network/${id}`)
export const tmdbNetworkImages = (id: string) => get<any>(`/network/${id}/images`)
export const tmdbKeyword = (id: string) => get<any>(`/keyword/${id}`)
export const tmdbKeywordMovies = (id: string, page = 1) => get<Paged<TmdbItem>>(`/keyword/${id}/movies`, { page })
export const tmdbCompanyMovies = (id: string, page = 1) => get<Paged<TmdbItem>>(`/discover/movie`, { with_companies: id, page, sort_by: 'popularity.desc' })
export const tmdbNetworkShows  = (id: string, page = 1) => get<Paged<TmdbItem>>(`/discover/tv`, { with_networks: id, page, sort_by: 'popularity.desc' })

export const titleOf = (i: TmdbItem) => i.title || i.name || i.original_title || i.original_name || 'Untitled'
export const yearOf  = (i: TmdbItem) => (i.release_date || i.first_air_date || '').slice(0, 4)
