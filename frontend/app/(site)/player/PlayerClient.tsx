'use client'
import dynamic from 'next/dynamic'

const VideoPlayer = dynamic(
  () => import('@/components/player/VideoPlayer'),
  { ssr: false }
)

export default function PlayerClient({ initialUrl }: { initialUrl?: string }) {
  return <VideoPlayer initialUrl={initialUrl} />
}
