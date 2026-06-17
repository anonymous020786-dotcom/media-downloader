import type { Metadata } from 'next'
import StatusBoard from '@/components/status/StatusBoard'

export const metadata: Metadata = {
  title: 'System Status | MediaDL',
  description: 'Live operational status of MediaDL — download engine, queue, database, storage and supported-site coverage. Auto-refreshes every 20 seconds.',
  alternates: { canonical: '/status' },
}

export default function StatusPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-[var(--text)] mb-3">System Status</h1>
        <p className="text-[var(--text-2)]">Live health of the MediaDL platform and its download engines.</p>
      </div>
      <StatusBoard />
    </div>
  )
}
