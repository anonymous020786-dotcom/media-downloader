#!/usr/bin/env node
// Builds the MediaDL extension for every browser family — no dependencies.
//
//   node extension/build.mjs            → extension/dist/{chromium,firefox}/ + .zip
//   EXT_VERSION=2.0.42 node build.mjs   → override the manifest version
//
// chromium: Chrome, Edge, Brave, Opera, Vivaldi, Arc… (MV3 service worker)
// firefox:  Firefox desktop & Android (MV3 background scripts + gecko id)
// Safari needs Apple's converter on a Mac — see extension/README.md.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(ROOT, 'src')
const DIST = path.join(ROOT, 'dist')
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.base.json'), 'utf8'))
if (process.env.EXT_VERSION) base.version = process.env.EXT_VERSION

const TARGETS = {
  chromium: (m) => ({
    ...m,
    background: { service_worker: 'background.js' },
    minimum_chrome_version: '116',
  }),
  firefox: (m) => ({
    ...m,
    background: { scripts: ['lib/shared.js', 'background.js'] },
    browser_specific_settings: {
      gecko: {
        id: 'mediadl@mediadl.extension',
        strict_min_version: '128.0',
        data_collection_permissions: { required: ['none'] },
      },
      gecko_android: { strict_min_version: '128.0' },
    },
  }),
}

// ── checks: every JS file parses, every manifest path exists ────────────────
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
}
const files = walk(SRC)
let failed = false
for (const f of files.filter((f) => f.endsWith('.js'))) {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }) } catch (e) {
    console.error(`✗ syntax error in ${path.relative(ROOT, f)}: ${e.message}`); failed = true
  }
}
function referencedPaths(m) {
  const out = [m.action?.default_popup, m.options_ui?.page, m.background?.service_worker,
    ...(m.background?.scripts || []), ...Object.values(m.icons || {}), ...Object.values(m.action?.default_icon || {})]
  return out.filter(Boolean)
}
for (const [name, make] of Object.entries(TARGETS)) {
  for (const p of referencedPaths(make(base))) {
    if (!fs.existsSync(path.join(SRC, p))) { console.error(`✗ ${name}: manifest references missing ${p}`); failed = true }
  }
}
for (const html of files.filter((f) => f.endsWith('.html'))) {
  const text = fs.readFileSync(html, 'utf8')
  for (const [, ref] of text.matchAll(/(?:src|href)="([^":#]+)"/g)) {
    if (!fs.existsSync(path.join(path.dirname(html), ref))) { console.error(`✗ ${path.basename(html)} references missing ${ref}`); failed = true }
  }
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(text)) { console.error(`✗ ${path.basename(html)} has an inline <script> (blocked by MV3 CSP)`); failed = true }
}
if (failed) process.exit(1)

// ── minimal zip writer (deflate) ────────────────────────────────────────────
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function zip(entries) { // entries: [{ name, data: Buffer }]
  const local = []; const central = []; let offset = 0
  const DOS_TIME = 0, DOS_DATE = (2020 - 1980) << 9 | 1 << 5 | 1 // fixed → reproducible zips
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const comp = zlib.deflateRawSync(data, { level: 9 })
    const crc = crc32(data)
    const h = Buffer.alloc(30)
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8)
    h.writeUInt16LE(DOS_TIME, 10); h.writeUInt16LE(DOS_DATE, 12); h.writeUInt32LE(crc, 14)
    h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nameBuf.length, 26)
    local.push(h, nameBuf, comp)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8)
    c.writeUInt16LE(8, 10); c.writeUInt16LE(DOS_TIME, 12); c.writeUInt16LE(DOS_DATE, 14); c.writeUInt32LE(crc, 16)
    c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nameBuf.length, 28)
    c.writeUInt32LE(offset, 42)
    central.push(c, nameBuf)
    offset += h.length + nameBuf.length + comp.length
  }
  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, cd, end])
}

// ── build ───────────────────────────────────────────────────────────────────
// Clear old outputs, not dist/ itself — on Windows the folder may be held open
// (an Explorer window, a shell cwd), which makes removing it fail.
fs.mkdirSync(DIST, { recursive: true })
for (const e of fs.readdirSync(DIST)) {
  fs.rmSync(path.join(DIST, e), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
for (const [name, make] of Object.entries(TARGETS)) {
  const out = path.join(DIST, name)
  fs.cpSync(SRC, out, { recursive: true })
  const manifest = JSON.stringify(make(base), null, 2) + '\n'
  fs.writeFileSync(path.join(out, 'manifest.json'), manifest)
  const entries = walk(out).sort().map((f) => ({ name: path.relative(out, f).split(path.sep).join('/'), data: fs.readFileSync(f) }))
  const zipPath = path.join(DIST, `mediadl-${name}-${base.version}.zip`)
  fs.writeFileSync(zipPath, zip(entries))
  console.log(`✓ ${name.padEnd(9)} ${base.version}  ${entries.length} files → ${path.relative(process.cwd(), zipPath)}`)
}
