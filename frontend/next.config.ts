import type { NextConfig } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mediadl.app'

// ── Content-Security-Policy ──────────────────────────────────────────────────
// Permissive on `https:` so optional integrations work when configured
// (Cloudflare Turnstile, Google Analytics) alongside media/embed CDNs and the
// headless-capture fallbacks. No third-party script is loaded unless its env
// key is set.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:",
  "script-src-elem 'self' 'unsafe-inline' https: blob:",
  "style-src 'self' 'unsafe-inline' https:",
  "font-src 'self' data: https:",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob: https: http:",
  "connect-src 'self' wss: ws: https: http:",
  "frame-src 'self' https:",
  "child-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https:",
  // NOTE: 'upgrade-insecure-requests' is intentionally omitted. It forces every
  // http:// request to https://, which breaks plain-HTTP deployments (LAN IP /
  // behind a TLS-terminating proxy that talks HTTP to the app). When you serve
  // the app over real HTTPS end-to-end, you can re-add it.
].join('; ')

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',        value: 'on' },
  { key: 'X-Content-Type-Options',         value: 'nosniff' },
  { key: 'X-Frame-Options',                value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection',               value: '1; mode=block' },
  { key: 'Referrer-Policy',                value: 'strict-origin-when-cross-origin' },
  // HSTS omitted — only meaningful over real HTTPS; harmful/pointless on a
  // plain-HTTP LAN deployment. Add it back when serving end-to-end HTTPS.
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

  // This app is one workspace among sibling lockfiles — pin the root explicitly.
  turbopack: { root: __dirname },

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
    // In dev, custom Cache-Control on build assets makes the browser (and the
    // service worker) serve stale Turbopack chunks — "module factory is not
    // available". Only apply the long-cache headers in production builds.
    const prod = process.env.NODE_ENV === 'production'
    return [
      ...(prod ? [
        {
          source: '/_next/static/:path*',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
        },
        {
          source: '/:file(.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp|avif|woff2|woff|ttf|otf))',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }],
        },
      ] : []),
      {
        // All pages — security headers
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
      'sonner',
    ],
  },
}

export default nextConfig
