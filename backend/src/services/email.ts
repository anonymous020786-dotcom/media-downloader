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

// ── OTP / Welcome / Admin templates ──────────────────────────────────────────
function darkTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MediaDL</title>
</head>
<body style="margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f12;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a24;border:1px solid #2d2d3d;border-radius:16px;overflow:hidden;max-width:100%;">
        <tr><td style="background:linear-gradient(135deg,#6c63ff 0%,#9b5de5 100%);padding:28px 32px;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.5px;">MediaDL</h1>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">Your media download platform</p>
        </td></tr>
        <tr><td style="padding:32px;">${content}</td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #2d2d3d;text-align:center;font-size:11px;color:#4b5563;">
          &copy; ${new Date().getFullYear()} MediaDL. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const OTP_LABELS: Record<string, string> = {
  verify:       'Email Verification',
  reset:        'Password Reset',
  login:        'Sign In',
  backup_email: 'Backup Email Verification',
  mfa:          'Two-Factor Verification',
}

export async function sendOtpEmail(to: string, otp: string, type: string): Promise<void> {
  const label = OTP_LABELS[type] ?? 'Verification'
  const html = darkTemplate(`
    <p style="font-size:16px;font-weight:600;margin:0 0 8px;color:#e2e8f0;">${label} Code</p>
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;">Use the code below to complete your ${label.toLowerCase()}. It expires in 10 minutes.</p>
    <div style="background:#0f0f12;border:1px solid #2d2d3d;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
      <span style="font-size:44px;font-weight:900;letter-spacing:14px;color:#6c63ff;">${otp}</span>
    </div>
    <p style="font-size:12px;color:#64748b;margin:0;">Never share this code with anyone. It is valid for 10 minutes only.</p>
  `)
  await sendEmail({ to, subject: `[MediaDL] Your ${label} Code: ${otp}`, html })
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mediadl.app'
  const html = darkTemplate(`
    <p style="font-size:18px;font-weight:700;margin:0 0 12px;color:#e2e8f0;">Welcome to MediaDL, ${escHtml(name)}!</p>
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;line-height:1.7;">Your account is all set up. Start downloading videos, music, and more from hundreds of platforms — all in one place.</p>
    <a href="${siteUrl}/download" style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#9b5de5);color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">Start Downloading</a>
  `)
  await sendEmail({ to, subject: 'Welcome to MediaDL!', html })
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const html = darkTemplate(`
    <p style="font-size:16px;font-weight:600;margin:0 0 8px;color:#e2e8f0;">Reset Your Password</p>
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;line-height:1.7;">Click the button below to set a new password. This link expires in 1 hour.</p>
    <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#9b5de5);color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">Reset Password</a>
    <p style="font-size:12px;color:#64748b;margin-top:24px;">If you didn't request this, ignore this email.</p>
  `)
  await sendEmail({ to, subject: '[MediaDL] Password Reset Request', html })
}

export async function sendAdminNotification(subject: string, body: string): Promise<void> {
  const adminTo = process.env.SMTP_ADMIN_TO ?? ''
  if (!adminTo) return
  const html = darkTemplate(`<pre style="font-size:13px;color:#94a3b8;white-space:pre-wrap;word-break:break-word;">${escHtml(body)}</pre>`)
  await sendEmail({ to: adminTo, subject: `[MediaDL Admin] ${subject}`, html })
}
