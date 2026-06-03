import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, ArrowRight, BookOpen, Clock } from 'lucide-react'
import { fetchBlogList, mediaUrl, type BlogPost, type BlogListResponse } from '@/lib/api'
import BlogControls from '@/components/blog/BlogControls'
import BlogPagination from '@/components/blog/BlogPagination'

export const metadata: Metadata = {
  title: 'Blog — Guides & Tutorials',
  description: 'Hundreds of tutorials and guides for downloading videos, audio, and images from YouTube, Instagram, TikTok and more — searchable and filterable by topic.',
  alternates: { canonical: '/blog' },
}

export const dynamic = 'force-dynamic'

const EMPTY: BlogListResponse = { posts: [], total: 0, page: 1, limit: 24, pages: 1, categories: [] }

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) } catch { return d }
}

type SP = { q?: string; category?: string; tag?: string; sort?: string; page?: string }

export default async function BlogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1') || 1)
  const data = await fetchBlogList({
    q: sp.q, category: sp.category, tag: sp.tag, sort: sp.sort, page, limit: 24,
  }).catch(() => EMPTY)

  const posts: BlogPost[] = data.posts
  const makeHref = (p: number) => {
    const params = new URLSearchParams()
    if (sp.q) params.set('q', sp.q)
    if (sp.category) params.set('category', sp.category)
    if (sp.sort) params.set('sort', sp.sort)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/blog${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-2)] mb-4">
          <BookOpen size={12} className="text-[var(--brand)]" /> Blog · {data.total.toLocaleString()} articles
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text)] mb-4">
          Guides & <span className="gradient-text">Tutorials</span>
        </h1>
        <p className="text-lg text-[var(--text-2)]">Tips, tutorials, and deep-dives on downloading media — search or filter to find exactly what you need.</p>
      </div>

      <BlogControls categories={data.categories} />

      {posts.length === 0 ? (
        <div className="text-center py-20 text-[var(--text-3)]">
          <BookOpen size={40} strokeWidth={1.2} className="mx-auto mb-3" />
          <p>No articles match your search. Try different keywords or clear the filters.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:-translate-y-1 transition-all overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-indigo-900/40 to-violet-900/30 flex items-center justify-center overflow-hidden">
                {post.cover_image
                  ? <img src={mediaUrl(post.cover_image)} alt={post.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  : <BookOpen size={32} className="text-[var(--brand)]/40" />}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {post.category && <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--brand)]/15 text-[var(--brand)] uppercase tracking-wide">{post.category}</span>}
                  {post.tags?.split(',').slice(0,1).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--bg-hover)] text-[var(--text-2)] uppercase tracking-wide">{t.trim()}</span>
                  ))}
                </div>
                <h2 className="font-bold text-[var(--text)] leading-snug mb-2 line-clamp-2 group-hover:text-[var(--brand)] transition-colors">{post.title}</h2>
                <p className="text-sm text-[var(--text-2)] line-clamp-2 leading-relaxed mb-4 flex-1">{post.excerpt}</p>
                <div className="flex items-center justify-between text-xs text-[var(--text-3)]">
                  <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(post.published_at)}</span>
                  {post.read_minutes ? <span className="flex items-center gap-1"><Clock size={11} />{post.read_minutes} min</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <BlogPagination page={data.page} pages={data.pages} makeHref={makeHref} />
    </div>
  )
}
