import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Tiny JSON-file persistence so per-user settings survive a bot restart.
 * One file, written atomically, debounced.
 */

const DATA_DIR = process.env.BOT_DATA_DIR
  ? path.resolve(process.env.BOT_DATA_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data')
const FILE = path.join(DATA_DIR, 'state.json')

interface Shape {
  settings: Record<string, unknown>
}

let data: Shape = { settings: {} }

try {
  if (fs.existsSync(FILE)) {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    data = { settings: raw?.settings ?? {} }
  }
} catch (e) {
  console.warn('[bot] could not read state.json — starting fresh:', (e as Error).message)
}

let writeTimer: NodeJS.Timeout | null = null
function persist() {
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      const tmp = FILE + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
      fs.renameSync(tmp, FILE)
    } catch (e) {
      console.warn('[bot] state.json write failed:', (e as Error).message)
    }
  }, 400)
  writeTimer.unref?.()
}

export const store = {
  getSettings(userId: number): Record<string, unknown> | undefined {
    return data.settings[userId] as Record<string, unknown> | undefined
  },
  saveSettings(userId: number, s: Record<string, unknown>) {
    data.settings[userId] = s
    persist()
  },
  flush() {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null }
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.writeFileSync(FILE, JSON.stringify(data, null, 2))
    } catch { /* best effort on shutdown */ }
  },
}
