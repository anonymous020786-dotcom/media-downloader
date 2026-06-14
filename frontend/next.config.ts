import type { NextConfig } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mediadl.app'

// ── Strict Content-Security-Policy ───────────────────────────────────────────
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://www.gstatic.com https://embed.tawk.to https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob: https: http:",
  "connect-src 'self' wss: ws: https: http:",
  "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://tawk.to",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',        value: 'on' },
  { key: 'X-Content-Type-Options',         value: 'nosniff' },
  { key: 'X-Frame-Options',                value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection',               value: '1; mode=block' },
  { key: 'Referrer-Policy',                value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security',      value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy',             value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy',     value: 'same-origin-allow-popups' },
  { key: 'Cross-Origin-Embedder-Policy',   value: 'unsafe-none' },
  { key: 'Cross-Origin-Resource-Policy',   value: 'cross-origin' },
  { key: 'Content-Security-Policy',        value: CSP },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,

  // ── Image optimisation ────────────────────────────────────────────────────
  images: {
    formats:          ['image/avif', 'image/webp'],
    deviceSizes:      [375, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes:       [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL:  86400,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },

  compress: true,

  // ── SWC compiler ──────────────────────────────────────────────────────────
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // ── HTTP headers ──────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Static assets — 1 year immutable
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Fonts, images, icons — 7-day cache with stale-while-revalidate
        source: '/:file(.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp|avif|woff2|woff|ttf|otf))',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' },
        ],
      },
      {
        // All pages — security + performance
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  // ── Redirects ─────────────────────────────────────────────────────────────
  async redirects() {
    return [
      { source: '/home',    destination: '/',        permanent: true },
      { source: '/dl',      destination: '/download', permanent: true },
    ]
  },

  // ── Experimental ──────────────────────────────────────────────────────────
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@supabase/supabase-js',
      'sonner',
    ],
  },
}

export default nextConfig
