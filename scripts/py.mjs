// Run the project's Python — prefers the local venv (.venv), falls back to PATH.
// Also makes sure ffmpeg is reachable (Windows winget installs it but only adds
// it to PATH for new shells).
import { existsSync, readdirSync } from 'node:fs'
import { spawnSync, spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

const win = path.join('.venv', 'Scripts', 'python.exe')
const nix = path.join('.venv', 'bin', 'python')
const py = existsSync(win) ? win : existsSync(nix) ? nix : 'python'

// ── ffmpeg on PATH? ──────────────────────────────────────────────────────────
const env = { ...process.env }
const hasFfmpeg = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { stdio: 'ignore' }).status === 0
if (!hasFfmpeg && process.platform === 'win32') {
  const roots = [
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages'),
  ]
  for (const root of roots) {
    try {
      for (const d of readdirSync(root)) {
        if (!/ffmpeg/i.test(d)) continue
        const stack = [path.join(root, d)]
        while (stack.length) {
          const cur = stack.pop()
          let entries = []
          try { entries = readdirSync(cur, { withFileTypes: true }) } catch { continue }
          if (entries.some((e) => e.isFile() && e.name.toLowerCase() === 'ffmpeg.exe')) {
            env.PATH = `${cur}${path.delimiter}${env.PATH}`
            stack.length = 0
            break
          }
          for (const e of entries) if (e.isDirectory()) stack.push(path.join(cur, e.name))
        }
      }
    } catch { /* ignore */ }
  }
}

const child = spawn(py, process.argv.slice(2), { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (e) => { console.error(`[py] failed to launch ${py}:`, e.message); process.exit(1) })
