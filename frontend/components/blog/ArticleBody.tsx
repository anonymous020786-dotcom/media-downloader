import { mediaUrl } from '@/lib/api'

// Lightweight, safe Markdown renderer — supports headings, bold, links, inline
// images (![alt](url)), ordered/unordered lists, and paragraphs. No raw HTML.
function renderInline(text: string, keyBase: string) {
  // Split on images first so we can render them as block <img>
  const parts: React.ReactNode[] = []
  const tokenRe = /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = tokenRe.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('![')) {
      const mm = /!\[([^\]]*)\]\(([^)]+)\)/.exec(tok)!
      parts.push(<img key={`${keyBase}-i${i}`} src={mediaUrl(mm[2])} alt={mm[1]} loading="lazy"
        className="my-4 w-full rounded-xl border border-[var(--border)]" />)
    } else if (tok.startsWith('[')) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!
      parts.push(<a key={`${keyBase}-a${i}`} href={mm[2]} target="_blank" rel="noopener noreferrer"
        className="text-[var(--brand)] hover:underline">{mm[1]}</a>)
    } else if (tok.startsWith('**')) {
      parts.push(<strong key={`${keyBase}-b${i}`} className="text-[var(--text)] font-semibold">{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('`')) {
      parts.push(<code key={`${keyBase}-c${i}`} className="px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--brand)] text-[13px] font-mono">{tok.slice(1, -1)}</code>)
    }
    last = m.index + tok.length; i++
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function ArticleBody({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n')
  const out: React.ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = (k: number) => {
    if (!list) return
    const L = list
    out.push(L.ordered
      ? <ol key={`ol${k}`} className="list-decimal pl-6 space-y-1.5 text-[var(--text-2)] my-4">{L.items.map((t, j) => <li key={j} className="leading-relaxed">{renderInline(t, `ol${k}-${j}`)}</li>)}</ol>
      : <ul key={`ul${k}`} className="list-disc pl-6 space-y-1.5 text-[var(--text-2)] my-4">{L.items.map((t, j) => <li key={j} className="leading-relaxed">{renderInline(t, `ul${k}-${j}`)}</li>)}</ul>)
    list = null
  }

  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    if (!line.trim()) { flush(i); return }
    const ol = /^\d+\.\s+(.*)/.exec(line)
    const ul = /^[-*]\s+(.*)/.exec(line)
    if (ol) { if (!list?.ordered) { flush(i); list = { ordered: true, items: [] } } list.items.push(ol[1]); return }
    if (ul) { if (list && !list.ordered) {} else { flush(i); list = { ordered: false, items: [] } } list.items.push(ul[1]); return }
    flush(i)
    if (line.startsWith('### ')) out.push(<h3 key={i} className="text-lg font-bold text-[var(--text)] mt-7 mb-2">{renderInline(line.slice(4), `h3${i}`)}</h3>)
    else if (line.startsWith('## ')) out.push(<h2 key={i} className="text-2xl font-black text-[var(--text)] mt-9 mb-3">{renderInline(line.slice(3), `h2${i}`)}</h2>)
    else if (line.startsWith('# ')) out.push(<h2 key={i} className="text-2xl font-black text-[var(--text)] mt-9 mb-3">{renderInline(line.slice(2), `h1${i}`)}</h2>)
    else out.push(<p key={i} className="text-[var(--text-2)] leading-relaxed text-[15px] my-3">{renderInline(line, `p${i}`)}</p>)
  })
  flush(lines.length)

  return <div className="max-w-none">{out}</div>
}
