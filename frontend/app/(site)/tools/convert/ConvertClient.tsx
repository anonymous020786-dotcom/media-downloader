'use client'
import dynamic from 'next/dynamic'

const FormatConverter = dynamic(() => import('@/components/widgets/FormatConverter'), { ssr: false })

export default function ConvertClient() {
  return <FormatConverter />
}
