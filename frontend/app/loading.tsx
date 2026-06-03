export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-[var(--border)] border-t-[var(--brand)] rounded-full spin"
             style={{ borderWidth: 3 }} />
        <p className="text-sm text-[var(--text-3)]">Loading…</p>
      </div>
    </div>
  )
}
