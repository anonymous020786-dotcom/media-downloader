'use client'
import type { Socket } from 'socket.io-client'
import type { JobProgress } from './types'

// ── Singleton socket client ───────────────────────────────────────────────────
// Lazily initialised on first use so SSR never tries to connect.

let _socket: Socket | null = null
let _connecting = false

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null   // SSR guard
  if (_socket?.connected) return _socket
  if (_connecting) return _socket

  _connecting = true
  // Empty NEXT_PUBLIC_API_URL → same-origin (production behind nginx). socket.io
  // with an empty/undefined URL connects to the page origin, which nginx proxies.
  const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

  // Dynamic import so the browser bundle includes socket.io-client,
  // but the SSR bundle never loads it.
  import('socket.io-client').then(({ io }) => {
    _socket = io(BASE || undefined, {
      path:               '/socket.io/',
      transports:         ['websocket', 'polling'],
      reconnection:       true,
      reconnectionDelay:  1000,
      reconnectionAttempts: 15,
      timeout:            10_000,
    })
    _socket.on('connect',        () => console.debug('[socket] connected'))
    _socket.on('disconnect',     (r) => console.debug('[socket] disconnected:', r))
    _socket.on('connect_error',  () => { /* silent — SSE fallback is active */ })
    _connecting = false
  }).catch(() => { _connecting = false })

  return null  // will return socket once connected
}

export function isSocketConnected(): boolean {
  return _socket?.connected ?? false
}

// ── Subscribe to job progress via WebSocket ───────────────────────────────────
// Returns an unsubscribe function. Falls back transparently to SSE (handled
// in api.ts subscribeProgress which calls this first, SSE second).
export function subscribeJobSocket(
  jobId:      string,
  onProgress: (p: JobProgress) => void,
  onDone:     () => void,
): (() => void) | null {
  const s = _socket
  if (!s?.connected) return null

  s.emit('subscribe:job', jobId)

  const onP = (data: any) => {
    if (data.jobId !== jobId) return
    onProgress(data as JobProgress)
  }
  const onD = (data: any) => {
    if (data.jobId !== jobId) return
    onProgress({ ...(data as JobProgress), status: 'completed' })
    onDone()
  }
  const onF = (data: any) => {
    if (data.jobId !== jobId) return
    onProgress({ ...(data as JobProgress), status: 'failed' })
    onDone()
  }

  s.on('progress',   onP)
  s.on('job:done',   onD)
  s.on('job:failed', onF)

  return () => {
    s.off('progress',   onP)
    s.off('job:done',   onD)
    s.off('job:failed', onF)
    s.emit('unsubscribe:job', jobId)
  }
}

// ── Subscribe to admin feed ───────────────────────────────────────────────────
export function joinAdminRoom(): void {
  _socket?.emit('subscribe:admin')
}

export function leaveAdminRoom(): void {
  _socket?.emit('unsubscribe:admin')
}

// ── Initialise early (call once in a client component) ───────────────────────
export function initSocket(): void {
  getSocket() // triggers lazy init
}
