'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, FileText, Eye, Plus, Pencil, Trash2, X, Save, ImagePlus, Upload, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { fetchBlog, adminCreateBlog, adminUpdateBlog, adminDeleteBlog, uploadMedia, mediaUrl, type BlogPost } from '@/lib/api'

const EMPTY = { id: 0, title: '', slug: '', excerpt: '', content: '', author: 'Admin', cover_image: '', tags: '', category: 'General', published: 1 }

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AdminBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'' | 'cover' | 'inline'>('')

  async function doUpload(file: File, target: 'cover' | 'inline') {
    setUploading(target)
    try {
      const m = await uploadMedia(file)
      if (target === 'cover') {
        setEditing((p: any) => ({ ...p, cover_image: m.url }))
        toast.success('Cover image uploaded')
      } else {
        const isImg = (m.type || '').startsWith('image/')
        const md = isImg ? `\n\n![${m.name}](${m.url})\n\n` : `\n\n[${m.name}](${m.url})\n\n`
        setEditing((p: any) => ({ ...p, content: (p.content ?? '') + md }))
        toast.success(isImg ? 'Image inserted into content' : 'File link inserted')
      }
    } catch (e: any) { toast.error(e.message) } finally { setUploading('') }
  }

  const load = async () => { setLoading(true); try { setPosts(await fetchBlog()) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const openNew  = () => setEditing({ ...EMPTY })
  const openEdit = (p: BlogPost) => setEditing({ ...EMPTY, ...p, published: 1 })

  const save = async () => {
    if (!editing.title) { toast.error('Title required'); return }
    const slug = editing.slug || slugify(editing.title)
    setSaving(true)
    try {
      if (editing.id) await adminUpdateBlog(editing.id, { ...editing, slug })
      else await adminCreateBlog({ ...editing, slug })
      toast.success(editing.id ? 'Post updated' : 'Post created')
      setEditing(null); await load()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!confirm('Delete this post?')) return
    try { await adminDeleteBlog(id); toast.success('Deleted'); setPosts((p)=>p.filter(x=>x.id!==id)) }
    catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">Blog Posts</h1>
          <p className="text-sm text-[var(--text-3)]">{posts.length} posts · Full CRUD</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className={`p-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] ${loading?'animate-spin':''}`}><RefreshCw size={15}/></button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-semibold text-sm rounded-xl"><Plus size={15}/>New Post</button>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
        {posts.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-3)]"><FileText size={36} strokeWidth={1.2} className="mx-auto mb-3"/><p className="text-sm">No posts yet</p></div>
        ) : posts.map((p) => (
          <div key={p.id} className="flex items-center gap-4 px-5 py-4 border-b border-[var(--border)] last:border-0">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--text)] text-sm truncate">{p.title}</p>
              <p className="text-xs text-[var(--text-3)]">/{p.slug} · {p.author}</p>
            </div>
            <Link href={`/blog/${p.slug}`} target="_blank" className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--brand)]"><Eye size={14}/></Link>
            <button onClick={()=>openEdit(p)} className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text)]"><Pencil size={14}/></button>
            <button onClick={()=>del(p.id)} className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-red-400"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)]">
              <h2 className="font-bold text-[var(--text)]">{editing.id ? 'Edit Post' : 'New Post'}</h2>
              <button onClick={()=>setEditing(null)} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { k:'title', label:'Title' }, { k:'slug', label:'Slug (auto if empty)' },
                { k:'excerpt', label:'Excerpt' },
                { k:'tags', label:'Tags (comma separated)' }, { k:'author', label:'Author' },
                { k:'category', label:'Category' },
              ].map((f) => (
                <div key={f.k}>
                  <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">{f.label}</label>
                  <input value={editing[f.k] ?? ''} onChange={(e)=>setEditing((p:any)=>({...p,[f.k]:e.target.value}))}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none" />
                </div>
              ))}

              {/* Cover image: URL or upload */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">Cover Image</label>
                <div className="flex gap-2">
                  <input value={editing.cover_image ?? ''} onChange={(e)=>setEditing((p:any)=>({...p,cover_image:e.target.value}))}
                    placeholder="Paste URL or upload →"
                    className="flex-1 bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none" />
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-2)] cursor-pointer whitespace-nowrap">
                    {uploading==='cover' ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>} Upload
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e)=>{ const f=e.target.files?.[0]; if(f) doUpload(f,'cover'); e.currentTarget.value='' }} />
                  </label>
                </div>
                {editing.cover_image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={mediaUrl(editing.cover_image)} alt="cover preview" className="mt-2 w-full max-h-40 object-cover rounded-lg border border-[var(--border)]" />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--text-2)]">Content (Markdown)</label>
                  <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--brand)] text-[11px] font-semibold text-[var(--text-2)] cursor-pointer">
                    {uploading==='inline' ? <Loader2 size={12} className="animate-spin"/> : <ImagePlus size={12}/>} Insert image / file
                    <input type="file" className="hidden"
                      onChange={(e)=>{ const f=e.target.files?.[0]; if(f) doUpload(f,'inline'); e.currentTarget.value='' }} />
                  </label>
                </div>
                <textarea rows={10} value={editing.content ?? ''} onChange={(e)=>setEditing((p:any)=>({...p,content:e.target.value}))}
                  placeholder="Write in Markdown. Use 'Insert image / file' to upload and embed media inline."
                  className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--brand)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none font-mono resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border)] sticky bottom-0 bg-[var(--bg-card)]">
              <button onClick={()=>setEditing(null)} className="px-4 py-2 text-sm text-[var(--text-2)]">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white font-semibold text-sm rounded-xl">
                {saving ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>}Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
