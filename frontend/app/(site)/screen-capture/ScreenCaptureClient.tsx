'use client'
import dynamic from 'next/dynamic'

const ScreenCapture = dynamic(() => import('@/components/widgets/ScreenCapture'), { ssr: false })

export default function ScreenCaptureClient() {
  return <ScreenCapture />
}
