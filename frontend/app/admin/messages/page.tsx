'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, Mail, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { adminMessages, adminDeleteMessage } from '@/lib/api'

export default function AdminMessages() {
  const [msgs, setMsgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => { setLoading(true); try { setMsgs(await adminMessages()) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const del = async (id: number) => {
    try { await adminDeleteMessage(id); setMsgs((m)=>m.filter(x=>x.id!==id)); toast.success('Deleted') }
    catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">Contact Messages</h1>
          <p className="text-sm text-[var(--text-3)]">{msgs.length} messages</p>
        </div>
        <button onClick={load} className={`p-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] ${loading?'animate-spin':''}`}><RefreshCw size={15}/></button>
      </div>

      {msgs.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-3)]">
          <Mail size={36} strokeWidth={1.2} className="mx-auto mb-3" />
          <p className="text-sm">No messages yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {msgs.map((m) => (
            <div key={m.id} className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold text-[var(--text)] text-sm">{m.name}</p>
                  <a href={`mailto:${m.email}`} className="text-xs text-[var(--brand)]">{m.email}</a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-3)]">{new Date(m.created_at).toLocaleString()}</span>
                  <button onClick={()=>del(m.id)} className="p-1 rounded-lg text-[var(--text-3)] hover:text-red-400"><Trash2 size={13}/></button>
                </div>
              </div>
              {m.subject && <p className="text-sm font-semibold text-[var(--text-2)] mb-1">{m.subject}</p>}
              <p className="text-sm text-[var(--text-2)] leading-relaxed">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
