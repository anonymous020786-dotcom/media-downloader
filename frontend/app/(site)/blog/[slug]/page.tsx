import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, User, ArrowLeft, Download, Clock, Tag } from 'lucide-react'
import { fetchBlogPost, fetchBlogList, mediaUrl, type BlogPost } from '@/lib/api'
import ArticleBody from '@/components/blog/ArticleBody'

export const dynamic = 'force-dynamic'

interface Params { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const post = await fetchBlogPost(slug).catch(() => null)
  if (!post) return { title: 'Article' }
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title, description: post.excerpt, type: 'article',
      images: post.cover_image ? [mediaUrl(post.cover_image)] : undefined,
    },
  }
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) } catch { return d }
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params
  const post: BlogPost | null = await fetchBlogPost(slug).catch(() => null)

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-black text-[var(--text)] mb-3">Article Not Found</h1>
        <p className="text-[var(--text-2)] mb-6">This article may have been moved or removed.</p>
        <Link href="/blog" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white font-semibold text-sm"><ArrowLeft size={14}/>Back to Blog</Link>
      </div>
    )
  }

  // Related posts (same category)
  const related = post.category
    ? await fetchBlogList({ category: post.category, limit: 4 })
        .then((r) => r.posts.filter((p) => p.slug !== slug).slice(0, 3))
        .catch(() => [])
    : []

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: post.title, description: post.excerpt,
    image: post.cover_image ? mediaUrl(post.cover_image) : undefined,
    author: { '@type': 'Organization', name: post.author },
    datePublished: post.published_at,
  }

  return (
    <article className="max-w-3xl mx-auto px-4 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-8 transition-colors">
        <ArrowLeft size={14} /> All articles
      </Link>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {post.category && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--brand)]/15 text-[var(--brand)] uppercase tracking-wide">{post.category}</span>}
        {post.tags?.split(',').slice(0,3).map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-2)] uppercase tracking-wide"><Tag size={9}/>{t.trim()}</span>
        ))}
      </div>

      <h1 className="text-3xl md:text-4xl font-black text-[var(--text)] leading-tight mb-4">{post.title}</h1>

      <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-3)] mb-8">
        <span className="flex items-center gap-1.5"><User size={13} />{post.author}</span>
        <span className="flex items-center gap-1.5"><Calendar size={13} />{fmtDate(post.published_at)}</span>
        {post.read_minutes ? <span className="flex items-center gap-1.5"><Clock size={13} />{post.read_minutes} min read</span> : null}
      </div>

      {post.cover_image && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={mediaUrl(post.cover_image)} alt={post.title}
          className="w-full aspect-video object-cover rounded-2xl border border-[var(--border)] mb-10" />
      )}

      <ArticleBody markdown={post.content ?? post.excerpt ?? ''} />

      {related.length > 0 && (
        <div className="mt-14 pt-8 border-t border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--text)] mb-4">Related articles</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {related.map((r) => (
              <Link key={r.id} href={`/blog/${r.slug}`}
                className="block p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors">
                <p className="text-sm font-semibold text-[var(--text)] line-clamp-2 mb-1">{r.title}</p>
                <p className="text-xs text-[var(--text-3)] line-clamp-2">{r.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-indigo-900/30 to-violet-900/20 border border-indigo-800/30 text-center">
        <p className="text-[var(--text)] font-bold mb-3">Ready to try it yourself?</p>
        <Link href="/download" className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-bold text-sm rounded-xl transition-colors">
          <Download size={15} /> Open MediaDL Free
        </Link>
      </div>
    </article>
  )
}
