import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { Toaster } from 'sonner'
import ThemeProvider from '@/components/layout/ThemeProvider'
import WhatsAppButton from '@/components/widgets/WhatsAppButton'
import TawkChat from '@/components/widgets/TawkChat'
import AuthSync from '@/components/auth/AuthSync'
import LanguageProvider from '@/components/i18n/LanguageProvider'
import PWAInstall from '@/components/widgets/PWAInstall'
import './globals.css'

const SITE  = process.env.NEXT_PUBLIC_SITE_URL  ?? 'https://mediadl.app'
const GA_ID = process.env.NEXT_PUBLIC_GA_ID     ?? ''

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title:       { default: 'MediaDL — Download Any Video or Image', template: '%s | MediaDL' },
  description: 'Free online downloader for videos and images from 1000+ sites. YouTube, Instagram, TikTok, Twitter, Facebook and more. HD, 4K, MP3, MP4, bulk download, playlist, HLS streams.',
  keywords:    ['video downloader','image downloader','youtube downloader','instagram downloader','tiktok downloader','free downloader','mp4','mp3','hls'],
  authors:     [{ name: 'MediaDL Team' }],
  openGraph: {
    type:        'website',
    locale:      'en_US',
    url:          SITE,
    siteName:    'MediaDL',
    title:       'MediaDL — Download Any Video or Image from Any Website',
    description: 'Free online downloader. 1000+ sites, unlimited downloads, HD/4K/8K, MP4/MP3/WebM, playlists, bulk scraping.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'MediaDL' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'MediaDL — Download Any Video or Image',
    description: 'Free online downloader. 1000+ sites, unlimited, no limits.',
    images:      ['/og-image.jpg'],
  },
  robots:  { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  icons:   { icon: '/logo.svg', shortcut: '/logo.svg', apple: '/logo.svg' },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor:  [{ media: '(prefers-color-scheme: dark)', color: '#0a0e1a' }, { media: '(prefers-color-scheme: light)', color: '#ffffff' }],
  colorScheme: 'dark light',
  width:       'device-width',
  initialScale: 1,
}

const SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type':       'Organization',
      '@id':         `${SITE}/#organization`,
      name:          'MediaDL',
      url:           SITE,
      logo:          { '@type': 'ImageObject', url: `${SITE}/logo.svg` },
      sameAs:        ['https://twitter.com/mediadl','https://github.com/mediadl'],
    },
    {
      '@type':           'WebSite',
      '@id':             `${SITE}/#website`,
      url:               SITE,
      name:              'MediaDL',
      publisher:         { '@id': `${SITE}/#organization` },
      potentialAction:   { '@type': 'SearchAction', target: `${SITE}/download?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
    {
      '@type':             'SoftwareApplication',
      name:                'MediaDL',
      applicationCategory:'MultimediaApplication',
      operatingSystem:    'Web',
      offers:              { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:         'Free online video and image downloader supporting 1000+ websites.',
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{ baseTheme: dark, variables: { colorPrimary: '#6366f1' } }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
    >
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Schema.org JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
        {/* Google AdSense */}
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body>
        {/* Google Analytics */}
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{page_path:window.location.pathname});`}
            </Script>
          </>
        )}

        {/* Service worker registration */}
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{})}`}
        </Script>

        <ThemeProvider>
          <LanguageProvider>
          <AuthSync />
          {children}
          <WhatsAppButton phone={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '+1234567890'} />
          <TawkChat
            propertyId={process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID ?? ''}
            widgetId={process.env.NEXT_PUBLIC_TAWK_WIDGET_ID ?? 'default'}
          />
          <Toaster
            theme="system"
            position="bottom-right"
            richColors
            toastOptions={{ style: { fontSize: '13px' } }}
          />
          <PWAInstall />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
    </ClerkProvider>
  )
}
