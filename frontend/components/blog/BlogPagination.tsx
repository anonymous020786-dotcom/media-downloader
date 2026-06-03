import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function pageList(page: number, pages: number): (number | '…')[] {
  const out: (number | '…')[] = []
  const add = (n: number) => out.push(n)
  const win = 1
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - win && i <= page + win)) add(i)
    else if (out[out.length - 1] !== '…') out.push('…')
  }
  return out
}

export default function BlogPagination({
  page, pages, makeHref,
}: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null
  const items = pageList(page, pages)
  const cls = 'min-w-9 h-9 px-3 flex items-center justify-center rounded-lg text-sm font-semibold border transition-colors'
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 mt-12">
      <Link href={makeHref(Math.max(1, page - 1))} aria-disabled={page === 1}
        className={`${cls} border-[var(--border)] text-[var(--text-2)] ${page === 1 ? 'pointer-events-none opacity-40' : 'hover:border-[var(--border-hover)]'}`}>
        <ChevronLeft size={15} />
      </Link>
      {items.map((it, i) => it === '…'
        ? <span key={`e${i}`} className="px-2 text-[var(--text-3)]">…</span>
        : <Link key={it} href={makeHref(it)}
            className={`${cls} ${it === page ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-hover)]'}`}>
            {it}
          </Link>)}
      <Link href={makeHref(Math.min(pages, page + 1))} aria-disabled={page === pages}
        className={`${cls} border-[var(--border)] text-[var(--text-2)] ${page === pages ? 'pointer-events-none opacity-40' : 'hover:border-[var(--border-hover)]'}`}>
        <ChevronRight size={15} />
      </Link>
    </nav>
  )
}
