import { Kafka, Producer, logLevel } from 'kafkajs'

// ── Kafka is opt-in: set KAFKA_BROKER=kafka:9092 to enable ───────────────────
const BROKER  = process.env.KAFKA_BROKER ?? ''
const ENABLED = !!BROKER

const client = ENABLED
  ? new Kafka({
      clientId: 'mediadl-backend',
      brokers:  [BROKER],
      logLevel: logLevel.ERROR,
      retry:    { retries: 5, initialRetryTime: 500, factor: 2 },
    })
  : null

let _producer: Producer | null = null
let _connecting = false

async function producer(): Promise<Producer | null> {
  if (!client) return null
  if (_producer) return _producer
  if (_connecting) return null
  _connecting = true
  try {
    _producer = client.producer({ allowAutoTopicCreation: true })
    await _producer.connect()
    console.log('[kafka] producer connected →', BROKER)
    return _producer
  } catch (e: any) {
    console.error('[kafka] producer connect failed:', e.message)
    _producer = null
    _connecting = false
    return null
  }
}

// ── Topics ────────────────────────────────────────────────────────────────────
export const TOPICS = {
  DOWNLOAD_EVENTS:     'mediadl.download.events',
  ANALYTICS_EVENTS:    'mediadl.analytics.events',
  NOTIFICATION_EVENTS: 'mediadl.notification.events',
  CONTACT_EVENTS:      'mediadl.contact.events',
} as const

// ── Emit an event ─────────────────────────────────────────────────────────────
export async function emit(
  topic: string,
  key:   string,
  value: object,
): Promise<void> {
  const p = await producer()
  if (!p) return
  try {
    await p.send({
      topic,
      messages: [{ key, value: JSON.stringify({ ...value, _ts: Date.now() }) }],
    })
  } catch (e: any) {
    console.error('[kafka] emit failed:', e.message)
  }
}

// ── Typed event helpers ───────────────────────────────────────────────────────
export const kafka = {
  downloadQueued: (jobId: string, url: string, mediaType: string) =>
    emit(TOPICS.DOWNLOAD_EVENTS, jobId, { event: 'queued', jobId, url, mediaType }),

  downloadStarted: (jobId: string, url: string) =>
    emit(TOPICS.DOWNLOAD_EVENTS, jobId, { event: 'started', jobId, url }),

  downloadCompleted: (jobId: string, url: string, files: string[]) =>
    emit(TOPICS.DOWNLOAD_EVENTS, jobId, { event: 'completed', jobId, url, files }),

  downloadFailed: (jobId: string, url: string, error: string) =>
    emit(TOPICS.DOWNLOAD_EVENTS, jobId, { event: 'failed', jobId, url, error }),

  contactReceived: (email: string, subject: string) =>
    emit(TOPICS.CONTACT_EVENTS, email, { event: 'contact.received', email, subject }),

  notificationSent: (userId: string, type: string) =>
    emit(TOPICS.NOTIFICATION_EVENTS, userId, { event: 'notification.sent', userId, type }),
}

export function isEnabled() { return ENABLED }

export async function disconnectKafka(): Promise<void> {
  if (_producer) {
    try { await _producer.disconnect() } catch {}
    _producer = null
  }
}
