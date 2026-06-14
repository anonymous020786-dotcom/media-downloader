import axios from 'axios'
import { Client } from 'basic-ftp'
import { Readable } from 'stream'

// ── PHP-API mode (recommended for shared hosting) ─────────────────────────────
// Uploads go through a PHP script you place on your Hostinger site.
const UPLOAD_URL = process.env.HOSTINGER_UPLOAD_URL ?? ''   // e.g. https://yourdomain.com/api/upload.php
const DELETE_URL = process.env.HOSTINGER_DELETE_URL ?? ''   // e.g. https://yourdomain.com/api/delete.php
const API_KEY    = process.env.HOSTINGER_API_KEY    ?? ''   // shared secret, must match the PHP script

// ── FTP mode (fallback) ───────────────────────────────────────────────────────
const FTP_HOST = process.env.HOSTINGER_FTP_HOST ?? ''
const FTP_USER = process.env.HOSTINGER_FTP_USER ?? ''
const FTP_PASS = process.env.HOSTINGER_FTP_PASS ?? ''
const DOMAIN   = process.env.HOSTINGER_DOMAIN   ?? ''
const FTP_ROOT = process.env.HOSTINGER_FTP_ROOT ?? '/public_html/uploads'

// ══════════════════════════════════════════════════════════════════════════════
//  PHP-API mode  — POSTs multipart/form-data to your upload.php
// ══════════════════════════════════════════════════════════════════════════════
export async function uploadToHostingerApi(
  buffer: Buffer,
  filename: string,
  contentType: string,
  folder = '',
): Promise<string> {
  if (!UPLOAD_URL || !API_KEY) {
    throw new Error('Hostinger API not configured (HOSTINGER_UPLOAD_URL / HOSTINGER_API_KEY missing)')
  }

  // Node 18+ has global FormData / Blob; axios sends them as multipart.
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: contentType }), filename)
  if (folder) form.append('folder', folder)

  const { data } = await axios.post(UPLOAD_URL, form, {
    headers: { 'X-API-Key': API_KEY },
    maxBodyLength: Infinity,
    timeout: 30_000,
  })

  if (!data?.url) throw new Error(data?.error ?? 'Upload failed: no URL returned by Hostinger script')
  return data.url as string
}

export async function deleteFromHostingerApi(filename: string, folder = ''): Promise<void> {
  if (!DELETE_URL || !API_KEY) return // nothing to do if not configured
  try {
    await axios.post(DELETE_URL, { filename, folder }, {
      headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
      timeout: 15_000,
    })
  } catch (e: any) {
    // Non-fatal — log and continue (the DB record is cleared regardless)
    console.warn('[hostinger] delete failed:', e.response?.data?.error ?? e.message)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  FTP mode  — direct FTP upload (fallback)
// ══════════════════════════════════════════════════════════════════════════════
function bufferToReadable(buffer: Buffer): Readable {
  const readable = new Readable()
  readable.push(buffer)
  readable.push(null)
  return readable
}

export async function uploadToHostinger(buffer: Buffer, filename: string, folder = ''): Promise<string> {
  const client = new Client()
  try {
    await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASS, secure: false })
    const remotePath = folder ? `${FTP_ROOT}/${folder}` : FTP_ROOT
    await client.ensureDir(remotePath)
    await client.uploadFrom(bufferToReadable(buffer), `${remotePath}/${filename}`)
    const urlPath = folder ? `uploads/${folder}/${filename}` : `uploads/${filename}`
    return `${DOMAIN}/${urlPath}`
  } finally {
    client.close()
  }
}

export async function deleteFromHostinger(filename: string, folder = ''): Promise<void> {
  const client = new Client()
  try {
    await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASS, secure: false })
    const remotePath = folder ? `${FTP_ROOT}/${folder}/${filename}` : `${FTP_ROOT}/${filename}`
    await client.remove(remotePath)
  } finally {
    client.close()
  }
}
