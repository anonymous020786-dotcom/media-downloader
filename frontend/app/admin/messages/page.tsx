'use client'
import { useEffect, useState, useRef } from 'react'
import {
  RefreshCw, Mail, MailOpen, Trash2, Reply, Send, X, Loader2,
  CheckCircle2, Clock, MessageSquare, Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  adminMessages, adminDeleteMessage, adminMarkMessage, adminReplyMessage,
  adminEmailConfig,
} from '@/lib/api'

type MsgStatus = 'unread' | 'read' | 'replied'

interface Msg {
  id: number
  name: string
  email: string
  subject?: string
  message: string
  status: MsgStatus
  created_at: string
  replied_at?: string
  replied_by?: string
  admin_note?: string
  read_at?: string
}

const STATUS_META: Record<MsgStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  unread:  { label: 'Unread',  cls: 'bg-blue-900/40 text-blue-300',     icon: <Mail size={11} /> },
  read:    { label: 'Read',    cls: 'bg-slate-800 text-slate-400',       icon: <MailOpen size={11} /> },
  replied: { label: 'Replied', cls: 'bg-emerald-900/40 text-emerald-300', icon: <CheckCircle2 size={11} /> },
}

function ReplyModal({
  msg,
  emailReady,
  onClose,
  onReplied,
}: {
  msg: Msg
  emailReady: boolean
  onClose: () => void
  onReplied: (id: number) => void
}) {
  const [text, setText]       = useState('')
  const [busy, setBusy]       = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textRef.current?.focus() }, [])

  async function send() {
    if (!text.trim()) { toast.error('Reply cannot be empty'); return }
    setBusy(true)
    try {
      await adminReplyMessage(msg.id, text.trim())
      toast.success(`Reply sent to ${msg.email}`)
      onReplied(msg.id)
      onClose()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="font-bold text-[var(--text)] text-sm">Reply to {msg.name}</h2>
            <p className="text-xs text-[var(--brand)]">{msg.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]">
            <X size={15} />
          </button>
        </div>

        {/* Original message */}
        <div className="mx-5 mt-4 p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">Original message</p>
          <p className="text-xs text-[var(--text-2)] line-clamp-3">{msg.message}</p>
        </div>

        {/* Compose */}
        <div className="p-5">
          {!emailReady && (
            <div className="mb-4 p-3 rounded-xl bg-amber-950/30 border border-amber-800/30 text-xs text-amber-300">
              ⚠ Email not configured — add SMTP env vars in Settings to send replies via email.
              Replies will be recorded in DB only.
            </div>
          )}
          <label className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">Your reply</label>
          <textarea
            ref={textRef}
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your reply here…"
            className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] outline-none resize-none placeholder:text-[var(--text-3)]"
          />
          <div className="flex gap-2 mt-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
              Cancel
            </button>
            <button onClick={send} disabled={busy || !text.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white font-bold text-sm transition-colors">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {busy ? 'Sending…' : 'Send Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminMessages() {
  const [data,        setData]       = useState<{ messages: Msg[]; unread: number }>({ messages: [], unread: 0 })
  const [loading,     setLoading]    = useState(true)
  const [filter,      setFilter]     = useState<MsgStatus | 'all'>('all')
  const [expanded,    setExpanded]   = useState<number | null>(null)
  const [replyMsg,    setReplyMsg]   = useState<Msg | null>(null)
  const [emailReady,  setEmailReady] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [d, cfg] = await Promise.all([
        adminMessages().catch(() => ({ messages: [], unread: 0 })),
        adminEmailConfig().catch(() => ({ configured: false })),
      ])
      setData(d as any)
      setEmailReady((cfg as any).configured)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const msgs = filter === 'all'
    ? data.messages
    : data.messages.filter((m) => m.status === filter)

  const markRead = async (id: number) => {
    try {
      await adminMarkMessage(id, 'read')
      setData((d) => ({
        ...d,
        messages: d.messages.map((m) => m.id === id ? { ...m, status: 'read' } : m),
        unread: Math.max(0, d.unread - 1),
      }))
    } catch {}
  }

  const markUnread = async (id: number) => {
    try {
      await adminMarkMessage(id, 'unread')
      setData((d) => ({
        ...d,
        messages: d.messages.map((m) => m.id === id ? { ...m, status: 'unread' } : m),
        unread: d.unread + 1,
      }))
    } catch {}
  }

  const del = async (id: number) => {
    try {
      await adminDeleteMessage(id)
      setData((d) => ({
        ...d,
        messages: d.messages.filter((m) => m.id !== id),
        unread: d.unread - (d.messages.find((m) => m.id === id)?.status === 'unread' ? 1 : 0),
      }))
      toast.success('Deleted')
    } catch (e: any) { toast.error(e.message) }
  }

  const onExpand = (id: number, status: MsgStatus) => {
    setExpanded(expanded === id ? null : id)
    if (status === 'unread') markRead(id)
  }

  const onReplied = (id: number) => {
    setData((d) => ({
      ...d,
      messages: d.messages.map((m) => m.id === id ? { ...m, status: 'replied' } : m),
    }))
  }

  const FILTERS: { key: MsgStatus | 'all'; label: string }[] = [
    { key: 'all',     label: `All (${data.messages.length})` },
    { key: 'unread',  label: `Unread (${data.messages.filter(m => m.status === 'unread').length})` },
    { key: 'read',    label: `Read (${data.messages.filter(m => m.status === 'read').length})` },
    { key: 'replied', label: `Replied (${data.messages.filter(m => m.status === 'replied').length})` },
  ]

  return (
    <>
      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[var(--text)]">Contact Messages</h1>
            <p className="text-sm text-[var(--text-3)]">
              {data.messages.length} total
              {data.unread > 0 && <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 text-[11px] font-bold">{data.unread} unread</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!emailReady && (
              <span className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/30 px-2.5 py-1.5 rounded-lg">
                Email not configured
              </span>
            )}
            <button onClick={load}
              className={`p-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] ${loading ? 'animate-spin' : ''}`}>
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === f.key
                  ? 'bg-[var(--brand)] text-white'
                  : 'text-[var(--text-3)] hover:text-[var(--text)]'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Messages list */}
        {msgs.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-3)]">
            <MessageSquare size={36} strokeWidth={1.2} className="mx-auto mb-3" />
            <p className="text-sm">No {filter !== 'all' ? filter : ''} messages</p>
          </div>
        ) : (
          <div className="space-y-2">
            {msgs.map((m) => {
              const meta    = STATUS_META[m.status]
              const isOpen  = expanded === m.id
              return (
                <div key={m.id}
                  className={`rounded-2xl border transition-all ${isOpen ? 'bg-[var(--bg-card)] border-[var(--border-focus)]/40' : 'bg-[var(--bg-card)] border-[var(--border)]'}`}>
                  {/* Row header */}
                  <button
                    onClick={() => onExpand(m.id, m.status)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${m.status === 'unread' ? 'bg-blue-400' : m.status === 'replied' ? 'bg-emerald-400' : 'bg-[var(--border)]'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-bold text-sm ${m.status === 'unread' ? 'text-[var(--text)]' : 'text-[var(--text-2)]'}`}>{m.name}</span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${meta.cls}`}>
                          {meta.icon}{meta.label}
                        </span>
                        {m.subject && <span className="text-xs text-[var(--text-3)] truncate">{m.subject}</span>}
                      </div>
                      <p className="text-xs text-[var(--text-3)] truncate">{m.email}</p>
                    </div>
                    <span className="text-[11px] text-[var(--text-3)] shrink-0">
                      {new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </button>

                  {/* Expanded body */}
                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-[var(--border)]">
                      <div className="mt-4 p-4 rounded-xl bg-[var(--bg)] text-sm text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">
                        {m.message}
                      </div>
                      {m.replied_at && (
                        <p className="mt-2 text-[11px] text-emerald-400">
                          ✓ Replied {new Date(m.replied_at).toLocaleString()}
                          {m.replied_by && ` by ${m.replied_by}`}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-4">
                        <button onClick={() => setReplyMsg(m)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-xs font-bold transition-colors">
                          <Reply size={13} /> Reply
                        </button>
                        <button
                          onClick={() => m.status === 'unread' ? markRead(m.id) : markUnread(m.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                          {m.status === 'unread' ? <><MailOpen size={13}/> Mark read</> : <><Mail size={13}/> Mark unread</>}
                        </button>
                        <div className="ml-auto">
                          <button onClick={() => del(m.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-800/40 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors">
                            <Trash2 size={13}/> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {replyMsg && (
        <ReplyModal
          msg={replyMsg}
          emailReady={emailReady}
          onClose={() => setReplyMsg(null)}
          onReplied={onReplied}
        />
      )}
    </>
  )
}
