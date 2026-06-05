import type { Metadata } from 'next'
import ScreenCaptureClient from './ScreenCaptureClient'

export const metadata: Metadata = {
  title: 'Screen Capture — Record Your Screen | MediaDL',
  description: 'Record your screen directly in the browser using WebRTC. No extensions, no installs. Save recordings as WebM or MP4.',
  alternates: { canonical: '/screen-capture' },
}

export default function ScreenCapturePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-black text-[var(--text)]">Screen Capture</h1>
        <p className="text-sm text-[var(--text-3)]">
          Record your screen directly in the browser — no extensions or installs required.
          Uses the WebRTC <code className="text-xs font-mono bg-[var(--bg-hover)] px-1 py-0.5 rounded">getDisplayMedia</code> API.
        </p>
      </div>
      <ScreenCaptureClient />
    </div>
  )
}
