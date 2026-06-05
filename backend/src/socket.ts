import { Server as IOServer } from 'socket.io'
import type { Server as HTTPServer } from 'node:http'
import { redisConnection, downloadQueue } from './workers/downloadWorker.js'
import type { JobProgress } from './types.js'

let io: IOServer | null = null

// Jobs currently being watched for progress (jobId → last known status)
const watched = new Map<string, string>()
// Admin stats broadcast interval
let adminTicker: NodeJS.Timeout | null = null

export function initSocket(httpServer: HTTPServer): IOServer {
  io = new IOServer(httpServer, {
    cors:       { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    path:       '/socket.io/',
    pingTimeout:     30_000,
    pingInterval:    10_000,
    connectTimeout:  10_000,
  })

  io.on('connection', (socket) => {
    // Client subscribes to a specific job's room
    socket.on('subscribe:job', (jobId: string) => {
      if (typeof jobId !== 'string' || jobId.length > 100) return
      socket.join(`job:${jobId}`)
      watched.set(jobId, 'unknown')
    })

    socket.on('unsubscribe:job', (jobId: string) => {
      socket.leave(`job:${jobId}`)
    })

    // Admin subscribes for the full live feed
    socket.on('subscribe:admin', () => {
      socket.join('admin')
    })

    socket.on('disconnect', () => {
      // nothing to clean up — rooms are auto-cleaned by socket.io
    })
  })

  // ── Progress watcher: poll Redis for all watched jobs (350 ms) ──────────────
  const progressTicker = setInterval(async () => {
    if (!io || watched.size === 0) return
    for (const [jobId, prevStatus] of watched) {
      try {
        const raw = await redisConnection.get(`job:${jobId}:progress`)
        if (!raw) continue
        const data: JobProgress = JSON.parse(raw)

        // Emit to job room + admin room on every tick
        io.to(`job:${jobId}`).emit('progress', { jobId, ...data })
        if (io.sockets.adapter.rooms.has('admin')) {
          io.to('admin').emit('admin:job', { jobId, ...data })
        }

        // Stop watching when terminal
        if (data.status === 'completed' || data.status === 'failed') {
          watched.delete(jobId)
        }
      } catch {
        // Redis error — keep trying
      }
    }
  }, 350)

  // ── Admin stats broadcast every 5 s ──────────────────────────────────────────
  adminTicker = setInterval(async () => {
    if (!io) return
    const adminRoom = io.sockets.adapter.rooms.get('admin')
    if (!adminRoom || adminRoom.size === 0) return
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        downloadQueue.getWaitingCount(),
        downloadQueue.getActiveCount(),
        downloadQueue.getCompletedCount(),
        downloadQueue.getFailedCount(),
      ])
      io.to('admin').emit('admin:stats', {
        waiting, active, completed, failed,
        total: waiting + active + completed + failed,
        ts: Date.now(),
      })
    } catch {}
  }, 5_000)

  // Clean up tickers if server closes
  httpServer.on('close', () => {
    clearInterval(progressTicker)
    if (adminTicker) clearInterval(adminTicker)
  })

  console.log('[socket.io] server ready')
  return io
}

export function getIO(): IOServer | null { return io }

/** Called by the worker when it receives an active BullMQ job. */
export function watchJob(jobId: string): void {
  watched.set(jobId, 'queued')
}

/** Broadcast job completion to job room + admin room. */
export function emitJobDone(jobId: string, data: Partial<JobProgress>): void {
  if (!io) return
  const payload = { jobId, ...data, status: 'completed' }
  io.to(`job:${jobId}`).emit('job:done', payload)
  io.to('admin').emit('admin:job:done', payload)
  watched.delete(jobId)
}

/** Broadcast job failure to job room + admin room. */
export function emitJobFailed(jobId: string, error: string): void {
  if (!io) return
  const payload = { jobId, status: 'failed', error, progress: 0 }
  io.to(`job:${jobId}`).emit('job:failed', payload)
  io.to('admin').emit('admin:job:failed', payload)
  watched.delete(jobId)
}

/** Emit arbitrary event to admin room (analytics, etc.). */
export function emitAdmin(event: string, data: object): void {
  io?.to('admin').emit(event, data)
}
