import axios, { AxiosInstance } from 'axios'
import { config } from './config.js'

/**
 * Thin typed wrapper over the MediaDL Express backend (localhost:4000).
 * Every download tool the web UI exposes has a REST route — the bot just calls
 * the same ones. Auth is a no-op in the local build, so no token is needed.
 */

export interface AnalyzeResult {
  type: 'video' | 'image' | 'page' | 'playlist' | 'profile' | 'file' | 'torrent'
  url?: string
  title?: string
  filename?: string
  thumbnail?: string | null
  duration?: number | null
  uploader?: string
  extractor?: string
  qualities?: number[]
  format_options?: Array<{ height: number; ext?: string; vcodec?: string | null; fps?: number | null; size?: number | null; note?: string | null }>
  video_formats?: string[]
  image_formats?: string[]
  content_type?: string
  size?: number | null
  is_live?: boolean
  is_stream?: boolean
  is_playlist?: boolean
  playlist_count?: number | null
  item_count?: number
  note?: string
  _cached?: boolean
}

export interface JobProgress {
  status: 'queued' | 'starting' | 'downloading' | 'scraping' | 'converting' | 'processing' | 'completed' | 'failed' | 'unknown'
  progress: number
  speed?: number | null
  eta?: number | null
  downloaded?: number | null
  total?: number | null
  total_files?: number | null
  completed_files?: number | null
  files?: string[]
  error?: string
  filename?: string
  note?: string
}

export interface JobView {
  jobId: string
  bullId: string
  url: string
  title?: string | null
  mediaType: string
  format?: string
  addedAt: number
  progress: JobProgress
}

export interface FileEntry { name: string; size: number; mime: string }

export interface SearchResult {
  title?: string
  url: string
  thumbnail?: string | null
  source?: string
  snippet?: string
  duration?: string
  size?: string
  seeders?: number
  leechers?: number
  magnet?: string
}

export interface DownloadOptions {
  url: string
  mediaType: AnalyzeResult['type'] | 'video'
  format?: string
  quality?: string
  formatId?: string
  title?: string
  thumbnail?: string
  maxItems?: number
  startIndex?: number
  subtitles?: boolean
  subtitleLangs?: string[]
  embedThumbnail?: boolean
  embedMetadata?: boolean
  writeThumbnail?: boolean
  sponsorBlock?: boolean
  splitChapters?: boolean
  normalizeAudio?: boolean
  cookies?: string
  proxy?: string
  capture?: boolean
  captureSeconds?: number
  startTime?: string
  endTime?: string
  speedLimit?: string
  concurrentFragments?: number
  priority?: number
  delaySeconds?: number
  repeatEvery?: 'hourly' | 'daily' | 'weekly'
}

class BackendError extends Error {
  constructor(message: string, readonly status?: number) { super(message) }
}

function unwrap(e: any): never {
  const detail = e?.response?.data?.error ?? e?.response?.data?.detail ?? e?.message ?? 'request failed'
  throw new BackendError(typeof detail === 'string' ? detail : JSON.stringify(detail), e?.response?.status)
}

export class Api {
  private http: AxiosInstance

  constructor(baseURL = config.backendUrl) {
    this.http = axios.create({
      baseURL,
      timeout: 120_000,
      headers: config.internalKey ? { 'X-Internal-Key': config.internalKey } : undefined,
    })
  }

  async health(): Promise<{ status: string; version?: string; uptime?: number }> {
    try { return (await this.http.get('/health', { timeout: 8_000 })).data } catch (e) { unwrap(e) }
  }

  async analyze(url: string): Promise<AnalyzeResult> {
    try { return (await this.http.post('/api/analyze', { url }, { timeout: 90_000 })).data } catch (e) { unwrap(e) }
  }

  async analyzePlaylist(url: string): Promise<AnalyzeResult> {
    try { return (await this.http.post('/api/analyze-playlist', { url }, { timeout: 90_000 })).data } catch (e) { unwrap(e) }
  }

  async listPlaylist(url: string): Promise<{ title?: string; total?: number; items: Array<{ url: string; title?: string }> }> {
    try { return (await this.http.post('/api/analyze/list-playlist', { url }, { timeout: 120_000 })).data } catch (e) { unwrap(e) }
  }

  async previewPage(url: string): Promise<{ page_title?: string; total: number; items: Array<{ url: string }> }> {
    try { return (await this.http.post('/api/analyze/preview-page', { url }, { timeout: 90_000 })).data } catch (e) { unwrap(e) }
  }

  async download(opts: DownloadOptions): Promise<{ jobId: string; scheduled?: boolean; recurring?: string }> {
    try { return (await this.http.post('/api/download', opts, { timeout: 30_000 })).data } catch (e) { unwrap(e) }
  }

  /** Create a pipe-through stream link (no server storage). Throws BackendError
   *  with status 422 when the source can't be streamed (playlist/torrent). */
  async stream(opts: { url: string; format?: string; quality?: string; cookies?: string; proxy?: string }): Promise<{ url: string; token: string }> {
    try { return (await this.http.post('/api/stream', opts, { timeout: 20_000 })).data } catch (e) { unwrap(e) }
  }

  async batch(items: Array<{ url: string; title?: string }>, shared: Partial<DownloadOptions> = {}): Promise<{ count: number; jobs: Array<{ jobId: string; url: string }> }> {
    try { return (await this.http.post('/api/download/batch', { items, ...shared }, { timeout: 60_000 })).data } catch (e) { unwrap(e) }
  }

  async merge(body: Record<string, unknown>): Promise<{ files?: string[]; success?: boolean }> {
    try { return (await this.http.post('/api/download/merge', body, { timeout: 0 })).data } catch (e) { unwrap(e) }
  }

  async feed(url: string): Promise<{ title?: string; items: Array<{ title?: string; url?: string; link?: string; enclosure?: { url?: string } }> }> {
    try { return (await this.http.post('/api/download/feed', { url }, { timeout: 40_000 })).data } catch (e) { unwrap(e) }
  }

  async search(query: string, kind: string, page = 1, opts: { filetype?: string; safe?: boolean; limit?: number } = {}): Promise<{ results: SearchResult[]; total?: number | null; has_more?: boolean; page: number }> {
    try {
      return (await this.http.post('/api/analyze/search', { query, kind, page, ...opts }, { timeout: 45_000 })).data
    } catch (e) { unwrap(e) }
  }

  // ── Jobs / queue ──────────────────────────────────────────────────────────
  async jobs(): Promise<JobView[]> {
    try { return (await this.http.get('/api/jobs', { timeout: 15_000 })).data } catch (e) { unwrap(e) }
  }

  async jobState(jobId: string): Promise<JobProgress> {
    try { return (await this.http.get(`/api/jobs/${jobId}/state`, { timeout: 10_000 })).data } catch (e) { unwrap(e) }
  }

  async retryJob(jobId: string) {
    try { return (await this.http.post(`/api/jobs/${jobId}/retry`, {})).data } catch (e) { unwrap(e) }
  }

  async deleteJob(jobId: string) {
    try { return (await this.http.delete(`/api/jobs/${jobId}`)).data } catch (e) { unwrap(e) }
  }

  async stopAll(): Promise<{ stopped: number }> {
    try { return (await this.http.post('/api/jobs/stop-all', {})).data } catch (e) { unwrap(e) }
  }

  async stats(): Promise<{ waiting: number; active: number; completed: number; failed: number; total: number }> {
    try { return (await this.http.get('/api/jobs/stats')).data } catch (e) { unwrap(e) }
  }

  async schedules(): Promise<Array<{ key: string; pattern: string }>> {
    try { return (await this.http.get('/api/download/schedules')).data } catch (e) { unwrap(e) }
  }

  async deleteSchedule(key: string) {
    try { return (await this.http.delete(`/api/download/schedules/${encodeURIComponent(key)}`)).data } catch (e) { unwrap(e) }
  }

  // ── Files ─────────────────────────────────────────────────────────────────
  async files(jobId: string): Promise<FileEntry[]> {
    try { return (await this.http.get(`/api/files/${jobId}`, { timeout: 15_000 })).data } catch (e) { unwrap(e) }
  }

  /**
   * Download a job file fully into memory. Telegram uploads need a known content
   * length; handing Telegraf an arbitrary (non-fs) Readable makes it hang, so we
   * buffer — safe because the bot only fetches files under the upload cap.
   */
  async fileBuffer(jobId: string, filename: string): Promise<{ buffer: Buffer; mime: string }> {
    const r = await this.http.get(`/api/files/${jobId}/${encodeURIComponent(filename)}`, {
      responseType: 'arraybuffer', timeout: 180_000,
      maxContentLength: Infinity, maxBodyLength: Infinity,
    }).catch(unwrap)
    return {
      buffer: Buffer.from(r.data as ArrayBuffer),
      mime: String(r.headers['content-type'] ?? 'application/octet-stream'),
    }
  }

  // ── System ────────────────────────────────────────────────────────────────
  async status(): Promise<any> {
    try { return (await this.http.get('/api/status', { timeout: 15_000 })).data } catch (e) { unwrap(e) }
  }

  async sites(): Promise<{ named_extractors: number; by_engine: Record<string, number> }> {
    try { return (await this.http.get('/api/content/sites', { timeout: 20_000 })).data } catch (e) { unwrap(e) }
  }

  // ── Proxy manager ─────────────────────────────────────────────────────────
  async proxyList(): Promise<{ presets: any[]; saved: any[] }> {
    try { return (await this.http.get('/api/proxy')).data } catch (e) { unwrap(e) }
  }
  async proxyAdd(label: string, url: string) {
    try { return (await this.http.post('/api/proxy', { label, url })).data } catch (e) { unwrap(e) }
  }
  async proxyTest(proxy: string): Promise<{ ok: boolean; ip?: string; country?: string; error?: string }> {
    try { return (await this.http.post('/api/proxy/test', { proxy }, { timeout: 65_000 })).data } catch (e) { unwrap(e) }
  }
  async proxyDefault(id: string) {
    try { return (await this.http.patch(`/api/proxy/${id}/default`, {})).data } catch (e) { unwrap(e) }
  }
  async proxyDelete(id: string) {
    try { return (await this.http.delete(`/api/proxy/${id}`)).data } catch (e) { unwrap(e) }
  }

  // ── Cookie manager ────────────────────────────────────────────────────────
  async cookieList(): Promise<Array<{ id: string; domain: string; label?: string | null; enabled: boolean; count: number }>> {
    try { return (await this.http.get('/api/cookies')).data } catch (e) { unwrap(e) }
  }
  async cookieAdd(domain: string, cookies: string, label?: string) {
    try { return (await this.http.post('/api/cookies', { domain, cookies, label })).data } catch (e) { unwrap(e) }
  }
  async cookieToggle(id: string, enabled: boolean) {
    try { return (await this.http.patch(`/api/cookies/${id}`, { enabled })).data } catch (e) { unwrap(e) }
  }
  async cookieDelete(id: string) {
    try { return (await this.http.delete(`/api/cookies/${id}`)).data } catch (e) { unwrap(e) }
  }
}

export const api = new Api()
export { BackendError }
