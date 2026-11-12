import { randomUUID } from 'node:crypto'
import { config, isAdmin } from './config.js'
import { store } from './store.js'
import type { AnalyzeResult, SearchResult } from './api.js'

/**
 * Per-user settings are file-backed (see store.ts) so they survive a restart.
 * The job queue and saved proxies/cookies still live in the backend's memory
 * and reset with it — that's the local build's design.
 */

export interface UserSettings {
  quality: string            // best | max | 2160 | 1440 | 1080 | 720 | 480 | 360
  videoFormat: string        // mp4 | mkv | webm | ...
  audioFormat: string        // mp3 | m4a | opus | ...
  subtitles: boolean
  embedThumbnail: boolean
  embedMetadata: boolean
  sponsorBlock: boolean
  splitChapters: boolean
  normalizeAudio: boolean
  writeThumbnail: boolean
  speedLimit: string         // '' | '5M' | ...
  proxy: string              // '' | 'auto' | preset:0 | <saved id> | raw url
  concurrentFragments: number
  autoDownloadBest: boolean   // skip the quality menu, grab default quality immediately
  adult: boolean              // allow adult sites + unfiltered search (default: admins only)
}

function defaultSettings(): UserSettings {
  return {
    quality: config.defaults.quality || 'best',
    videoFormat: config.defaults.videoFormat || 'mp4',
    audioFormat: config.defaults.audioFormat || 'mp3',
    subtitles: false,
    embedThumbnail: true,
    embedMetadata: true,
    sponsorBlock: false,
    splitChapters: false,
    normalizeAudio: false,
    writeThumbnail: false,
    speedLimit: '',
    proxy: '',
    concurrentFragments: 16,
    autoDownloadBest: false,
    adult: false,
  }
}

/** New users get adult content only if they're an admin; they can change it in /settings. */
const defaultsFor = (userId: number): UserSettings => ({ ...defaultSettings(), adult: isAdmin(userId) })

const settings = new Map<number, UserSettings>()

export function getSettings(userId: number): UserSettings {
  let s = settings.get(userId)
  if (!s) {
    const saved = store.getSettings(userId)
    s = { ...defaultsFor(userId), ...(saved as Partial<UserSettings> | undefined) }
    settings.set(userId, s)
  }
  return s
}

/** Call after mutating a settings object so the change is written to disk. */
export function saveSettings(userId: number): void {
  const s = settings.get(userId)
  if (s) store.saveSettings(userId, s as unknown as Record<string, unknown>)
}

export function resetSettings(userId: number): UserSettings {
  const s = defaultsFor(userId)
  settings.set(userId, s)
  store.saveSettings(userId, s as unknown as Record<string, unknown>)
  return s
}

// ── Short-lived payload store (callback_data is capped at 64 bytes) ──────────
interface Entry<T> { value: T; at: number }
const TTL = 60 * 60 * 1000 // 1h

class TokenStore<T> {
  private m = new Map<string, Entry<T>>()
  put(value: T): string {
    this.sweep()
    const id = randomUUID().slice(0, 8)
    this.m.set(id, { value, at: Date.now() })
    return id
  }
  get(id: string): T | undefined {
    const e = this.m.get(id)
    if (!e) return undefined
    e.at = Date.now()
    return e.value
  }
  private sweep() {
    const cutoff = Date.now() - TTL
    for (const [k, e] of this.m) if (e.at < cutoff) this.m.delete(k)
  }
}

export interface PendingMedia {
  url: string
  analysis: AnalyzeResult
  userId: number
}

export interface PendingSearch {
  token: string
  query: string
  kind: string
  page: number
  filetype?: string
  safe: boolean
  results: SearchResult[]
}

export const mediaTokens = new TokenStore<PendingMedia>()
export const searchTokens = new TokenStore<PendingSearch>()
export const genericTokens = new TokenStore<string>()

// ── Conversational "waiting for the next message" prompts ────────────────────
export type Awaiting =
  | { kind: 'batch' }
  | { kind: 'cookies'; domain: string }
  | { kind: 'proxy_add' }
  | { kind: 'clip'; token: string }         // expects "START END" times for a pending media token
  | { kind: 'speedlimit' }
  | { kind: 'search'; searchKind: string }

const awaiting = new Map<number, Awaiting>()
export const setAwaiting = (userId: number, a: Awaiting) => awaiting.set(userId, a)
export const takeAwaiting = (userId: number): Awaiting | undefined => {
  const a = awaiting.get(userId)
  awaiting.delete(userId)
  return a
}
export const clearAwaiting = (userId: number) => awaiting.delete(userId)
