import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter, Lexend } from 'next/font/google'
import { Toaster } from 'sonner'
import ThemeProvider from '@/components/layout/ThemeProvider'
import { AuthProvider } from '@/components/auth/AuthContext'
import BackgroundDownloads from '@/components/BackgroundDownloads'
import LanguageProvider from '@/components/i18n/LanguageProvider'
import PWAInstall from '@/components/widgets/PWAInstall'
import CookieBanner from '@/components/widgets/CookieBanner'
import WelcomeBanner from '@/components/widgets/WelcomeBanner'
import ScrollButtons from '@/components/widgets/ScrollButtons'
import './globals.css'

// ── Fonts — self-hosted via next/font (no external network request) ───────────
const inter = Inter({
  subsets:  ['latin'],
  display:  'swap',
  variable: '--font-inter',
  preload:  true,
})

const lexend = Lexend({
  subsets:  ['latin'],
  display:  'swap',
  variable: '--font-lexend',
  preload:  false,
})

const SITE  = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title:       { default: 'MediaDL — Download Any Video or Image', template: '%s | MediaDL' },
  description: 'Free online downloader for videos and images from 14,000+ sites. YouTube, Instagram, TikTok, Twitter, Facebook and more. HD, 4K, MP3, MP4, bulk download, playlist, HLS streams.',
  keywords:    ['video downloader','image downloader','youtube downloader','instagram downloader','tiktok downloader','free downloader','mp4','mp3','hls'],
  authors:     [{ name: 'MediaDL Team' }],
  openGraph: {
    type:        'website',
    locale:      'en_US',
    url:          SITE,
    siteName:    'MediaDL',
    title:       'MediaDL — Download Any Video or Image from Any Website',
    description: 'Free online downloader. 14,000+ sites, unlimited downloads, HD/4K/8K, MP4/MP3/WebM, playlists, bulk scraping.',
    images: [{ url: '/og-image.svg', width: 1200, height: 630, alt: 'MediaDL' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'MediaDL — Download Any Video or Image',
    description: 'Free online downloader. 1000+ sites, unlimited, no limits.',
    images:      ['/og-image.svg'],
  },
  robots:  { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  icons:   { icon: '/logo.svg', shortcut: '/logo.svg', apple: '/logo.svg' },
  manifest: '/manifest.json',
  alternates: {
    canonical: SITE,
    languages: {
      'x-default': SITE, 'en': SITE, 'es': SITE, 'pt': SITE,
      'fr': SITE, 'de': SITE, 'it': SITE, 'nl': SITE, 'ru': SITE,
      'pl': SITE, 'ar': SITE, 'tr': SITE, 'hi': SITE, 'zh': SITE,
      'ja': SITE, 'ko': SITE, 'id': SITE, 'vi': SITE, 'th': SITE,
    },
  },
}

export const viewport: Viewport = {
  themeColor:   [{ media: '(prefers-color-scheme: dark)', color: '#080c17' }, { media: '(prefers-color-scheme: light)', color: '#ffffff' }],
  colorScheme:  'dark light',
  width:        'device-width',
  initialScale: 1,
  viewportFit:  'cover',
}

const SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization', '@id': `${SITE}/#organization`,
      name: 'MediaDL', url: SITE,
      logo: { '@type': 'ImageObject', url: `${SITE}/logo.svg` },
      sameAs: ['https://twitter.com/mediadl', 'https://github.com/mediadl'],
    },
    {
      '@type': 'WebSite', '@id': `${SITE}/#website`,
      url: SITE, name: 'MediaDL',
      publisher: { '@id': `${SITE}/#organization` },
      potentialAction: { '@type': 'SearchAction', target: `${SITE}/download?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'MediaDL', applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web, iOS, Android', url: SITE,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'Free online video and image downloader supporting 14,000+ websites.',
      aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '12847', bestRating: '5' },
    },
    {
      '@type': 'HowTo', name: 'How to Download a Video with MediaDL',
      description: 'Download any video or image from 1000+ websites in 4 steps.',
      step: [
        { '@type': 'HowToStep', name: 'Copy URL',        text: 'Copy the video URL from YouTube, Instagram, TikTok or any supported site.' },
        { '@type': 'HowToStep', name: 'Paste & Analyze', text: 'Paste the URL into the MediaDL download box. The tool instantly detects quality options.' },
        { '@type': 'HowToStep', name: 'Select format',   text: 'Choose your format (MP4, MP3, WebM…) and quality (Best, 4K, 1080p…).' },
        { '@type': 'HowToStep', name: 'Download',        text: 'Click Download. Your file is processed and saved to your device.' },
      ],
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning
      className={`${inter.variable} ${lexend.variable}`}
    >
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      </head>
      <body className={inter.className}>
        <Script id="sw-register" strategy="afterInteractive">{`
          (function(){
            if(!('serviceWorker' in navigator)) return;
            var DEV = ${process.env.NODE_ENV !== 'production'};
            if(DEV){
              // The service worker cache-firsts build chunks — in dev that serves
              // stale Turbopack chunks ("module factory is not available"). Kill it.
              navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})});
              if(window.caches) caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})});
            } else {
              navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});
            }
          })();
        `}</Script>

        <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <BackgroundDownloads />
            <Toaster
              theme="system"
              position="bottom-right"
              richColors
              toastOptions={{ style: { fontSize: '13px' } }}
            />
            <PWAInstall />
            <CookieBanner />
            <WelcomeBanner />
            <ScrollButtons />
          </LanguageProvider>
        </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
