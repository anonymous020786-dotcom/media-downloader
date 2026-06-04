import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',

  // ── Image optimisation ────────────────────────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [375, 640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400, // 24 h
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },

  // ── Compression ───────────────────────────────────────────────────────────
  compress: true,

  // ── Power user: keep console.log in dev, strip in prod ───────────────────
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // ── Security & caching headers ───────────────────────────────────────────
  async headers() {
    return [
      {
        // Static assets — 1 year immutable cache
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Public files — 24 h cache
        source: '/:file(.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp|avif|woff2|woff|ttf|otf))',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        // All pages — prevent stale UI on redeploy
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },

  // ── Experimental ──────────────────────────────────────────────────────────
  experimental: {
    optimizePackageImports: ['lucide-react', '@clerk/nextjs'],
  },
}

export default nextConfig
