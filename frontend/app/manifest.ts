import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MediaDL — Video & Image Downloader',
    short_name: 'MediaDL',
    description: 'Download any video or image from any website. 1000+ sites, free, unlimited.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0e1a',
    theme_color: '#6366f1',
    icons: [
      { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
