import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'Format Converter — Re-encode & Convert Files | MediaDL',
  description: 'Convert downloaded files to any format using FFmpeg. Video ↔ video, video → audio, video → GIF. Trim, resize, change codec — all server-side.',
  alternates: { canonical: '/tools/convert' },
}

const FormatConverter = dynamic(() => import('@/components/widgets/FormatConverter'), { ssr: false })

export default function ConvertPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-black text-[var(--text)]">Format Converter</h1>
        <p className="text-sm text-[var(--text-3)]">
          Re-encode or convert any downloaded file using FFmpeg — change format, resolution, codec,
          extract audio, trim a clip, or make a GIF. All processing runs server-side.
        </p>
      </div>
      <FormatConverter />
    </div>
  )
}
