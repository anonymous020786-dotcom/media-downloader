import type { AnalyzeResult, Job, JobProgress, PlaylistInfo, StorageJob, AdvancedOptions, FeedResult, ConvertRequest } from './types'

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
// On the server (SSR) localhost:4000 points at the frontend container itself, not the
// backend — use the internal service URL so server-rendered pages get real data.
const BASE = typeof window === 'undefined'
  ? (process.env.BACKEND_INTERNAL_URL ?? PUBLIC_BASE).replace(/\/$/, '')
  : PUBLIC_BASE

// Set by <AuthSync> when a Clerk user is signed in — forwarded for per-user rate limits.
let _userId: string | null = null
export function setApiUserId(id: string | null) { _userId = id }

// Set by <AuthSync> — returns a fresh Clerk session JWT for verified admin calls.
let _getToken: (() => Promise<string | null>) | null = null
export function setApiTokenGetter(fn: (() => Promise<string | null>) | null) { _getToken = fn }

async function _authHeaders(h: Headers) {
  if (_userId) h.set('X-User-Id', _userId)
  if (_getToken) { try { const t = await _getToken(); if (t) h.set('Authorization', `Bearer ${t}`) } catch {} }
}

async function _f<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  await _authHeaders(headers)
  const r = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!r.ok) {
    const b = await r.json().catch(() => ({}))
    throw new Error(b.error ?? `HTTP ${r.status}`)
  }
  return r.json()
}

export const analyzeUrl = (url: string) =>
  _f<AnalyzeResult>('/api/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

export const analyzePlaylist = (url: string) =>
  _f<PlaylistInfo>('/api/analyze-playlist', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

export interface SearchResult { title: string; url: string; snippet?: string; thumbnail?: string; source?: string; duration?: string; kind: string }
export interface SearchResponse { query: string; kind: string; page: number; per_page: number; count: number; has_more: boolean; results: SearchResult[]; _cached?: boolean }
export const searchWeb = (query: string, kind: 'web'|'file'|'image'|'video' = 'web', filetype?: string, page = 1) =>
  _f<SearchResponse>('/api/analyze/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, kind, filetype, limit: 30, page }),
  })

export const queueDownload = (payload: {
  url: string; mediaType: string; format: string; quality?: string
  title?: string; thumbnail?: string; delaySeconds?: number; repeatEvery?: string
  recaptchaToken?: string
} & Partial<AdvancedOptions & { maxItems: number | null; startIndex: number }>) =>
  _f<{ jobId: string; scheduled?: boolean; recurring?: string }>('/api/download', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url:            payload.url,
      mediaType:      payload.mediaType,
      format:         payload.format,
      quality:        payload.quality,
      title:          payload.title,
      thumbnail:      payload.thumbnail,
      priority:       payload.priority  ?? 5,
      maxItems:       payload.maxItems ?? null,
      startIndex:     payload.startIndex ?? 1,
      subtitles:      payload.subtitles ?? false,
      embedThumbnail: payload.embedThumbnail ?? false,
      embedMetadata:  payload.embedMetadata ?? true,
      cookies:        payload.cookies || null,
      proxy:          payload.proxy   || null,
      capture:             payload.capture ?? false,
      startTime:           payload.startTime  || undefined,
      endTime:             payload.endTime    || undefined,
      subtitleLangs:       payload.subtitleLang
                             ? [payload.subtitleLang, 'en', 'en-US'].filter((v, i, a) => a.indexOf(v) === i)
                             : undefined,
      sponsorBlock:        payload.sponsorBlock        ?? false,
      splitChapters:       payload.splitChapters       ?? false,
      normalizeAudio:      payload.normalizeAudio      ?? false,
      writeThumbnail:      payload.writeThumbnail      ?? false,
      outputTemplate:      payload.outputTemplate      || undefined,
      speedLimit:          payload.speedLimit          || undefined,
      concurrentFragments: payload.concurrentFragments ?? 16,
      delaySeconds:        payload.delaySeconds        ?? undefined,
      repeatEvery:         payload.repeatEvery         || undefined,
    }),
  })

// ── Social people / profile discovery ─────────────────────────────────────────
export interface SocialProfile {
  platform: string; platform_name: string; username?: string; display_name?: string
  url: string; title?: string; kind: 'video'|'image'|'mixed'; login_required: boolean
  status: 'verified'|'blocked'|'candidate'; avatar?: string
}
export interface SocialSearchResponse { query: string; count: number; platforms_searched: number; profiles: SocialProfile[]; _cached?: boolean }
export interface SocialPlatform { id: string; name: string; kind: string; login_required: boolean }
export const socialSearch = (query: string, platforms?: string[]) =>
  _f<SocialSearchResponse>('/api/analyze/social/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, platforms }),
  })
export const socialPlatforms = () => _f<{ platforms: SocialPlatform[] }>('/api/analyze/social/platforms')

export const fetchJobs  = () => _f<Job[]>('/api/jobs')
export const fetchStats = () => _f<{waiting:number;active:number;completed:number;failed:number;total:number}>('/api/jobs/stats')
export const deleteJob  = (id: string) => _f(`/api/jobs/${id}`,    { method: 'DELETE' })
export const retryJob   = (id: string) => _f(`/api/jobs/${id}/retry`, { method: 'POST'   })
export const clearJobs  = (type?: 'completed'|'failed') =>
  _f(`/api/jobs${type ? `?type=${type}` : ''}`, { method: 'DELETE' })

export const fetchStorage = () => _f<{ jobs: StorageJob[]; total_bytes: number; total_jobs: number }>('/api/storage')
export const deleteStorage = (jobId: string) => _f(`/api/storage/${jobId}`, { method: 'DELETE' })

export const fileDownloadUrl = (jobId: string, filename: string) =>
  `${BASE}/api/files/${jobId}/${encodeURIComponent(filename)}`

export const zipDownloadUrl = (jobId: string) =>
  `${BASE}/api/files/${jobId}/zip`

// ── Preview (select before download) ──────────────────────────────────────────
export interface PreviewImage { url: string; type: 'image' }
export interface PreviewPageResult { page_title: string; url: string; total: number; items: PreviewImage[] }
export interface PreviewPlaylistItem { index: number; url: string; title: string; thumbnail?: string; duration?: number; uploader?: string; type: 'video' }
export interface PreviewPlaylistResult { title: string; uploader: string; thumbnail?: string; total: number; previewing: number; items: PreviewPlaylistItem[] }

export const previewPage = (url: string) =>
  _f<PreviewPageResult>('/api/analyze/preview-page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
  })

export const listPlaylist = (url: string) =>
  _f<PreviewPlaylistResult>('/api/analyze/list-playlist', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
  })

// ── CMS content (MySQL) ───────────────────────────────────────────────────────
export interface BlogPost { id:number; title:string; slug:string; excerpt:string; content?:string; author:string; cover_image?:string; tags?:string; category?:string; read_minutes?:number; published_at:string }
export interface BlogCategory { category:string; count:number }
export interface BlogListResponse { posts:BlogPost[]; total:number; page:number; limit:number; pages:number; categories:BlogCategory[] }
export interface BlogQuery { q?:string; category?:string; tag?:string; sort?:string; page?:number; limit?:number }
export interface FaqItem  { id:number; question:string; answer:string; category:string; sort_order:number }
export interface Testimonial { id:number; name:string; role:string; avatar?:string; content:string; rating:number }

export interface HistoryRow { id:number; url:string; media_type:string; format:string; quality?:string; status:string; created_at:string }
export const fetchHistory  = () => _f<HistoryRow[]>('/api/content/history')
export const clearHistory  = () => _f('/api/content/history', { method: 'DELETE' })

// ── Batch download ────────────────────────────────────────────────────────────
export interface BatchItem { url: string; title?: string; thumbnail?: string; mediaType?: string; format?: string }
export interface BatchJobResult { jobId: string; url: string; title?: string }
export const batchDownload = (items: BatchItem[], shared: Partial<AdvancedOptions> & {
  mediaType?: string; format?: string; quality?: string; delaySeconds?: number
}) =>
  _f<{ count: number; jobs: BatchJobResult[] }>('/api/download/batch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items,
      mediaType:      shared.mediaType ?? 'video',
      format:         shared.format    ?? 'mp4',
      quality:        shared.quality   ?? 'best',
      priority:       shared.priority  ?? 5,
      subtitles:      shared.subtitles ?? false,
      embedThumbnail: shared.embedThumbnail ?? false,
      embedMetadata:  shared.embedMetadata  ?? true,
      cookies:        shared.cookies  || null,
      proxy:          shared.proxy    || null,
      sponsorBlock:   shared.sponsorBlock   ?? false,
      normalizeAudio: shared.normalizeAudio ?? false,
      speedLimit:     shared.speedLimit     || null,
      concurrentFragments: shared.concurrentFragments ?? 16,
      delaySeconds:   shared.delaySeconds   || null,
    }),
  })

// ── RSS/M3U feed parser ───────────────────────────────────────────────────────
export const parseFeed = (url: string) =>
  _f<FeedResult>('/api/download/feed', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

// ── Convert already-downloaded file ──────────────────────────────────────────
export const convertFile = (req: ConvertRequest) =>
  _f<{ success: boolean; output_file: string; output_job_id: string; size: number }>('/api/download/convert', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

// ── Merge audio + video files ─────────────────────────────────────────────────
export const mergeFiles = (jobId: string, videoFile: string, audioFile: string, outputFormat = 'mp4') =>
  _f<{ success: boolean; output_file: string; size: number }>('/api/download/merge', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, video_file: videoFile, audio_file: audioFile, output_format: outputFormat }),
  })

// ── Recurring schedules ───────────────────────────────────────────────────────
export interface ScheduleRow { key: string; name: string; pattern: string; next: number }
export const fetchSchedules  = () => _f<ScheduleRow[]>('/api/download/schedules')
export const deleteSchedule  = (key: string) =>
  _f(`/api/download/schedules/${encodeURIComponent(key)}`, { method: 'DELETE' })

export const fetchBlogList    = (qy: BlogQuery = {}) => {
  const sp = new URLSearchParams()
  Object.entries(qy).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v)) })
  const qs = sp.toString()
  return _f<BlogListResponse>(`/api/content/blog${qs ? `?${qs}` : ''}`)
}
// Back-compat helper used by admin: returns just the posts array
export const fetchBlog        = () => fetchBlogList({ limit: 60 }).then((r) => r.posts)
export const fetchBlogPost    = (slug: string) => _f<BlogPost>(`/api/content/blog/${slug}`)

// Upload an image/file for embedding in a post; returns the public URL
export async function uploadMedia(file: File): Promise<{ url:string; name:string; size:number; type:string }> {
  const fd = new FormData()
  fd.append('file', file)
  const headers = new Headers()
  await _authHeaders(headers)
  const r = await fetch(`${BASE}/api/content/admin/upload`, { method: 'POST', body: fd, headers })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)
  return r.json()
}
export const mediaUrl = (u: string) => (u.startsWith('http') ? u : `${BASE}${u}`)
export const fetchFaq         = () => _f<FaqItem[]>('/api/content/faq')
export const fetchTestimonials= () => _f<Testimonial[]>('/api/content/testimonials')
export const fetchContentStats= () => _f<{total_downloads:string|number; total_sites:string}>('/api/content/stats')
export interface SupportedSites { named_extractors:number; by_engine:Record<string,number>; generic_fallback:boolean; note:string }
export const fetchSupportedSites = () => _f<SupportedSites>('/api/content/sites')
export const submitContact    = (data: {name:string;email:string;subject?:string;message:string;recaptchaToken?:string}) =>
  _f<{success:boolean;message:string}>('/api/content/contact', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })

// ── Admin ──────────────────────────────────────────────────────────────────────
export interface DeepHealth { status:string; checks:Record<string,any>; versions?:Record<string,string|null> }
export const fetchHealthDeep = () => _f<DeepHealth>('/health/deep')
export const adminEngines = () => _f<{ engines: Record<string,string|null> }>('/api/content/admin/engines')
export const adminUpdateEngines = () => _f<{ before: Record<string,string|null>; after: Record<string,string|null>; changed: string[]; note: string }>('/api/content/admin/engines/update', { method: 'POST' })
export const adminDownloads = () => _f<any>('/api/content/admin/downloads')
export const adminMessages      = () => _f<{ messages: any[]; unread: number }>('/api/content/admin/messages')
export const adminDeleteMessage = (id: number) => _f(`/api/content/admin/messages/${id}`, { method: 'DELETE' })
export const adminMarkMessage   = (id: number, status: 'read' | 'unread') =>
  _f(`/api/content/admin/messages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
export const adminReplyMessage  = (id: number, replyText: string) =>
  _f<{ success: boolean }>(`/api/content/admin/messages/${id}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replyText }) })
export const adminEmailConfig   = () => _f<{ configured: boolean; provider: string; from: string; admin_to: string }>('/api/content/admin/email-config')
export const adminTestEmail     = (to?: string) =>
  _f<{ success: boolean }>('/api/content/admin/email-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to }) })
export const adminAnalytics     = (days = 30) => _f<any>(`/api/content/admin/analytics?days=${days}`)

export const adminSettings = () => _f<{key_name:string;value:string;updated_at:string}[]>('/api/content/admin/settings')
export const adminUpdateSettings = (updates: Record<string,string>) =>
  _f('/api/content/admin/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updates) })

export const adminCreateBlog = (post: any) =>
  _f<{success:boolean;id:number}>('/api/content/admin/blog', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(post) })
export const adminUpdateBlog = (id: number, post: any) =>
  _f(`/api/content/admin/blog/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(post) })
export const adminDeleteBlog = (id: number) =>
  _f(`/api/content/admin/blog/${id}`, { method:'DELETE' })

export function subscribeProgress(jobId: string, onUpdate: (p: JobProgress) => void, onDone: () => void): () => void {
  // Try Socket.io first; if not connected yet, fall back to SSE
  // (socket.ts lazy-connects, so may not be ready on the first job)
  let socketUnsub: (() => void) | null = null
  let esClosed = false

  // Socket.io path (non-blocking attempt)
  if (typeof window !== 'undefined') {
    import('./socket').then(({ subscribeJobSocket, getSocket }) => {
      getSocket() // trigger init
      // Give socket 400 ms to connect before giving up and using SSE only
      setTimeout(() => {
        if (esClosed) return
        const unsub = subscribeJobSocket(jobId, onUpdate, onDone)
        if (unsub) {
          socketUnsub = unsub
          // Socket connected — SSE is also running as backup; let both work
        }
      }, 400)
    }).catch(() => {})
  }

  // SSE always starts immediately as a reliable baseline
  const es = new EventSource(`${BASE}/api/jobs/${jobId}/progress`)
  es.onmessage = (e) => {
    const d: JobProgress = JSON.parse(e.data)
    onUpdate(d)
    if (d.status === 'completed' || d.status === 'failed') { es.close(); esClosed = true; onDone() }
  }
  es.onerror = () => { es.close(); esClosed = true; onDone() }

  return () => {
    esClosed = true
    es.close()
    socketUnsub?.()
  }
}

// ── Push notification token registration ─────────────────────────────────────
export const registerPushToken  = (token: string, deviceId?: string) => {
  const headers: Record<string,string> = { 'Content-Type': 'application/json' }
  if (deviceId) headers['X-Device-Id'] = deviceId
  return _f<{ success: boolean; enabled: boolean }>('/api/notifications/register', {
    method: 'POST', headers, body: JSON.stringify({ token }),
  })
}
export const unregisterPushToken = (deviceId?: string) => {
  const headers: Record<string,string> = {}
  if (deviceId) headers['X-Device-Id'] = deviceId
  return _f('/api/notifications/unregister', { method: 'DELETE', headers })
}
export const notificationStatus  = () => _f<{ fcm_enabled: boolean }>('/api/notifications/status')

// ── Formatters ────────────────────────────────────────────────────────────────
export const fmtBytes = (b?: number | null) => {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024**2) return `${(b/1024).toFixed(1)} KB`
  if (b < 1024**3) return `${(b/1024**2).toFixed(1)} MB`
  return `${(b/1024**3).toFixed(2)} GB`
}
export const fmtSpeed    = (b?: number | null) => b ? `${fmtBytes(b)}/s` : ''
export const fmtDuration = (s?: number | null) => {
  if (!s) return ''
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60)
  return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
}
export const fmtEta = (s?: number | null) => {
  if (!s || s <= 0) return ''
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.floor(s/60)}m ${Math.round(s%60)}s`
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`
}
