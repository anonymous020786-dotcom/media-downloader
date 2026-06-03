'use client'
import { useState } from 'react'

// Client tab switcher that receives server-rendered nodes (RSC) as props and
// toggles their visibility — lets detail pages surface many endpoints cleanly.
type Tab = { label: string; count?: number; node: React.ReactNode }
export default function DetailTabs({ tabs }: { tabs: (Tab | null | false | undefined)[] }) {
  const visible = tabs.filter((t): t is Tab => !!t && !!t.node)
  const [active, setActive] = useState(0)
  if (!visible.length) return null
  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] mb-6 overflow-x-auto">
        {visible.map((t, i) => (
          <button key={t.label} onClick={() => setActive(i)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              active === i ? 'border-[var(--brand)] text-[var(--text)]' : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
            {t.label}{t.count != null && <span className="ml-1.5 text-[10px] text-[var(--text-3)]">{t.count}</span>}
          </button>
        ))}
      </div>
      <div>{visible[active]?.node}</div>
    </div>
  )
}
