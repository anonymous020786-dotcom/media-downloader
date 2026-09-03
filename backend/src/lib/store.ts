/**
 * In-memory replacements for Redis + BullMQ.
 * ---------------------------------------------------------------------------
 * Local-only build: there is no Redis and no external job queue. Everything
 * lives in this single Node process and resets when the backend restarts.
 *
 *  • `kv`         — tiny key/value store with the ioredis subset the app uses
 *  • `MemQueue`   — drop-in for the BullMQ `Queue`/`Worker` surface we call
 */
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'

// ── Key/value store ──────────────────────────────────────────────────────────
class KV {
  private m = new Map<string, { v: string; exp: number | null }>()

  async get(key: string): Promise<string | null> {
    const e = this.m.get(key)
    if (!e) return null
    if (e.exp !== null && Date.now() > e.exp) { this.m.delete(key); return null }
    return e.v
  }

  async set(key: string, val: string | number, ...args: any[]): Promise<'OK'> {
    let ttl: number | null = null
    if (args[0] === 'EX' && typeof args[1] === 'number') ttl = args[1]
    else if (args[0] && typeof args[0] === 'object') {
      if (typeof args[0].EX === 'number') ttl = args[0].EX
      if (typeof args[0].PX === 'number') ttl = args[0].PX / 1000
    }
    this.m.set(key, { v: String(val), exp: ttl !== null ? Date.now() + ttl * 1000 : null })
    return 'OK'
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0
    for (const k of keys) if (this.m.delete(k)) n++
    return n
  }

  async ping(): Promise<'PONG'> { return 'PONG' }

  async keys(pattern = '*'): Promise<string[]> {
    const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
    return [...this.m.keys()].filter((k) => re.test(k))
  }
}

export const kv = new KV()

// ── Job queue ────────────────────────────────────────────────────────────────
export type JobState = 'waiting' | 'active' | 'delayed' | 'completed' | 'failed'

interface AddOpts {
  jobId?: string
  delay?: number
  priority?: number
  attempts?: number
  repeat?: { pattern: string }
}

export class MemJob<T = any> {
  id: string
  name: string
  data: T
  opts: AddOpts
  state: JobState
  addedAt: number
  attemptsMade = 0
  failedReason?: string
  returnvalue?: any

  constructor(private queue: MemQueue, id: string, name: string, data: T, opts: AddOpts) {
    this.id = id
    this.name = name
    this.data = data
    this.opts = opts
    this.addedAt = Date.now()
    this.state = opts.delay && opts.delay > 0 ? 'delayed' : 'waiting'
  }

  async getState(): Promise<JobState> { return this.state }
  async remove(): Promise<void> { this.queue._remove(this.id) }
  async retry(): Promise<void> { this.queue._retry(this.id) }
}

/**
 * Implements the subset of the BullMQ Queue/Worker API that `download.ts`,
 * `jobs.ts` and `socket.ts` actually use. Emits `failed` / `completed` like a
 * BullMQ Worker so `startWorker()` can attach the same handlers.
 */
export class MemQueue extends EventEmitter {
  private jobs = new Map<string, MemJob>()
  private repeatables = new Map<string, { key: string; name: string; pattern: string; data: any; opts: AddOpts }>()
  private processor?: (job: MemJob) => Promise<any>
  private concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 3))
  private running = 0

  constructor() {
    super()
    // Coarse cron for the hourly / daily / weekly patterns download.ts uses.
    setInterval(() => this._fireDueRepeatables(), 60_000).unref()
  }

  setProcessor(fn: (job: MemJob) => Promise<any>) {
    this.processor = fn
    this._pump()
  }

  // ── BullMQ-compatible surface ─────────────────────────────────────────────
  async add(name: string, data: any, opts: AddOpts = {}): Promise<MemJob> {
    if (opts.repeat?.pattern) {
      const key = `${name}:${opts.repeat.pattern}:${JSON.stringify(data).slice(0, 120)}`
      this.repeatables.set(key, { key, name, pattern: opts.repeat.pattern, data, opts })
      return new MemJob(this, opts.jobId ?? randomUUID(), name, data, opts)
    }
    const id = opts.jobId ?? randomUUID()
    const job = new MemJob(this, id, name, data, opts)
    this.jobs.set(id, job)
    if (job.state === 'delayed') {
      setTimeout(() => {
        if (job.state === 'delayed') { job.state = 'waiting'; this._pump() }
      }, opts.delay).unref?.()
    } else {
      this._pump()
    }
    return job
  }

  async getJob(id: string): Promise<MemJob | undefined> { return this.jobs.get(id) }

  async getJobs(states: readonly string[]): Promise<MemJob[]> {
    const want = new Set(states)
    // BullMQ's "prioritized" ≈ our "waiting"
    if (want.has('prioritized')) want.add('waiting')
    return [...this.jobs.values()].filter((j) => want.has(j.state))
  }

  async getWaitingCount() { return this._count('waiting') + this._count('delayed') }
  async getActiveCount() { return this._count('active') }
  async getCompletedCount() { return this._count('completed') }
  async getFailedCount() { return this._count('failed') }

  async clean(_grace: number, limit: number, state: 'completed' | 'failed'): Promise<string[]> {
    const removed: string[] = []
    for (const [id, job] of this.jobs) {
      if (job.state === state) {
        this.jobs.delete(id)
        removed.push(id)
        if (removed.length >= limit) break
      }
    }
    return removed
  }

  async getRepeatableJobs() {
    return [...this.repeatables.values()].map((r) => ({
      key: r.key, name: r.name, pattern: r.pattern, next: 0,
    }))
  }

  async removeRepeatableByKey(key: string): Promise<boolean> {
    return this.repeatables.delete(key)
  }

  // ── Internals ────────────────────────────────────────────────────────────
  _remove(id: string) { this.jobs.delete(id) }

  _retry(id: string) {
    const job = this.jobs.get(id)
    if (!job) return
    job.state = 'waiting'
    job.attemptsMade = 0
    job.failedReason = undefined
    this._pump()
  }

  private _count(state: JobState) {
    let n = 0
    for (const j of this.jobs.values()) if (j.state === state) n++
    return n
  }

  private _pump() {
    if (!this.processor) return
    while (this.running < this.concurrency) {
      const next = [...this.jobs.values()]
        .filter((j) => j.state === 'waiting')
        .sort((a, b) => (a.opts.priority ?? 5) - (b.opts.priority ?? 5) || a.addedAt - b.addedAt)[0]
      if (!next) break
      next.state = 'active'
      this.running++
      void this._run(next)
    }
  }

  private async _run(job: MemJob) {
    try {
      job.returnvalue = await this.processor!(job)
      job.state = 'completed'
      this.emit('completed', job, job.returnvalue)
    } catch (err: any) {
      job.attemptsMade++
      const maxAttempts = job.opts.attempts ?? 1
      if (job.attemptsMade < maxAttempts) {
        job.state = 'delayed'
        const backoff = Math.min(30_000, 5_000 * job.attemptsMade)
        setTimeout(() => { job.state = 'waiting'; this._pump() }, backoff).unref?.()
      } else {
        job.state = 'failed'
        job.failedReason = err?.message ?? String(err)
        this.emit('failed', job, err instanceof Error ? err : new Error(String(err)))
      }
    } finally {
      this.running--
      this._prune()
      this._pump()
    }
  }

  /** Cap memory: keep the newest 300 completed + 150 failed jobs. */
  private _prune() {
    for (const state of [['completed', 300], ['failed', 150]] as const) {
      const list = [...this.jobs.values()]
        .filter((j) => j.state === state[0])
        .sort((a, b) => a.addedAt - b.addedAt)
      const excess = list.length - state[1]
      for (let i = 0; i < excess; i++) this.jobs.delete(list[i].id)
    }
  }

  private _fireDueRepeatables() {
    if (this.repeatables.size === 0) return
    const now = new Date()
    for (const r of this.repeatables.values()) {
      // patterns: '0 * * * *' hourly | '0 9 * * *' daily | '0 9 * * 1' weekly
      const [min, hr, , , dow] = r.pattern.split(' ')
      if (Number(min) !== now.getMinutes()) continue
      if (hr !== '*' && Number(hr) !== now.getHours()) continue
      if (dow !== '*' && Number(dow) !== now.getDay()) continue
      const id = randomUUID()
      const data = { ...r.data, jobId: id, addedAt: Date.now() }
      const job = new MemJob(this, id, r.name, data, {})
      this.jobs.set(id, job)
      this._pump()
    }
  }
}
