import nodemailer from 'nodemailer'

// ── Provider presets ──────────────────────────────────────────────────────────
const PRESETS: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail:     { host: 'smtp.gmail.com',       port: 587, secure: false },
  microsoft: { host: 'smtp.office365.com',   port: 587, secure: false },
  hostinger: { host: 'smtp.hostinger.com',   port: 587, secure: false },
  yahoo:     { host: 'smtp.mail.yahoo.com',  port: 587, secure: false },
  custom:    { host: '',                     port: 587, secure: false },
}

function getTransport() {
  const user = process.env.SMTP_USER ?? ''
  const pass = process.env.SMTP_PASS ?? ''
  if (!user || !pass) return null

  const provider = (process.env.SMTP_PROVIDER ?? 'custom').toLowerCase()
  const preset   = PRESETS[provider] ?? PRESETS.custom

  const host   = process.env.SMTP_HOST   ?? preset.host
  const port   = parseInt(process.env.SMTP_PORT ?? String(preset.port))
  const secure = process.env.SMTP_SECURE === 'true' || preset.secure

  if (!host) return null

  return nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  })
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS && (
    process.env.SMTP_HOST || (process.env.SMTP_PROVIDER ?? 'custom') !== 'custom'
  ))
}

export interface SendOptions {
  to:       string
  subject:  string
  html:     string
  text?:    string
  replyTo?: string
}

export async function sendEmail(opts: SendOptions): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransport()
  if (!transport) return { ok: false, error: 'Email not configured (SMTP_USER / SMTP_PASS missing or SMTP_HOST empty)' }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!

  try {
    await transport.sendMail({
      from,
      to:      opts.to,
      subject: opts.subject,
      html:    opts.html,
      text:    opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
      replyTo: opts.replyTo,
    })
    return { ok: true }
  } catch (err: any) {
    console.error('[email] send failed:', err.message)
    return { ok: false, error: err.message }
  }
}

// ── Branded templates ─────────────────────────────────────────────────────────
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mediadl.app'

export function tplNewMessage(data: { name: string; email: string; subject?: string; message: string }): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:16px;border:1px solid #1f2d42;overflow:hidden;max-width:100%;">
      <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:900;">📬 New Contact Message</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">MediaDL Admin Panel</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding-bottom:16px;border-bottom:1px solid #1f2d42;">
            <p style="margin:0 0 4px;font-size:11px;color:#4b5563;text-transform:uppercase;letter-spacing:.08em;">From</p>
            <p style="margin:0;font-size:15px;font-weight:700;color:#f9fafb;">${escHtml(data.name)}</p>
            <a href="mailto:${escHtml(data.email)}" style="color:#6366f1;font-size:13px;">${escHtml(data.email)}</a>
          </td></tr>
          ${data.subject ? `<tr><td style="padding:16px 0;border-bottom:1px solid #1f2d42;">
            <p style="margin:0 0 4px;font-size:11px;color:#4b5563;text-transform:uppercase;letter-spacing:.08em;">Subject</p>
            <p style="margin:0;font-size:14px;font-weight:600;color:#f9fafb;">${escHtml(data.subject)}</p>
          </td></tr>` : ''}
          <tr><td style="padding-top:16px;">
            <p style="margin:0 0 8px;font-size:11px;color:#4b5563;text-transform:uppercase;letter-spacing:.08em;">Message</p>
            <div style="background:#0a0e1a;border-radius:10px;padding:16px;border:1px solid #1f2d42;">
              <p style="margin:0;font-size:14px;color:#9ca3af;line-height:1.7;white-space:pre-wrap;">${escHtml(data.message)}</p>
            </div>
          </td></tr>
        </table>
        <div style="margin-top:24px;text-align:center;">
          <a href="${SITE}/admin/messages" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;font-weight:700;font-size:13px;border-radius:10px;text-decoration:none;">
            Reply in Admin Panel →
          </a>
        </div>
      </td></tr>
      <tr><td style="padding:16px 32px;background:#0a0e1a;border-top:1px solid #1f2d42;text-align:center;">
        <p style="margin:0;font-size:11px;color:#4b5563;">Sent from <a href="${SITE}" style="color:#6366f1;">${SITE}</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

export function tplReply(data: { name: string; originalMessage: string; replyText: string }): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;max-width:100%;">
      <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:900;">MediaDL Support</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">We've replied to your message</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hi <strong>${escHtml(data.name)}</strong>,</p>
        <div style="background:#f9fafb;border-radius:10px;padding:20px;border-left:4px solid #6366f1;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.7;white-space:pre-wrap;">${escHtml(data.replyText)}</p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;">Your original message</p>
        <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;white-space:pre-wrap;">${escHtml(data.originalMessage)}</p>
      </td></tr>
      <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">© MediaDL · <a href="${SITE}" style="color:#6366f1;">${SITE}</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

export function tplAutoReply(data: { name: string }): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
  <tr><td align="center">
    <table width="600" style="background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;max-width:100%;">
      <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;">
        <h1 style="margin:0;color:#fff;font-size:18px;font-weight:900;">Thanks for reaching out, ${escHtml(data.name)}!</h1>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">
          We've received your message and will get back to you within <strong>24 hours</strong>.<br>
          In the meantime, check our <a href="${SITE}/faq" style="color:#6366f1;">FAQ</a> — your question may already be answered there.
        </p>
        <a href="${SITE}" style="display:inline-block;padding:11px 24px;background:#6366f1;color:#fff;font-weight:700;font-size:13px;border-radius:10px;text-decoration:none;">
          Back to MediaDL
        </a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function escHtml(s: string): string {
  return (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
