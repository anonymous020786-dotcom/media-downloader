'use client'
import Script from 'next/script'

const GA_ID = (process.env.NEXT_PUBLIC_GA_ID ?? '').trim()

/**
 * Google Analytics 4. Renders nothing unless NEXT_PUBLIC_GA_ID is set, so local
 * and self-hosted runs stay tracking-free. IP anonymisation is on.
 */
export default function GoogleAnalytics() {
  if (!GA_ID) return null
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA_ID}', { anonymize_ip: true });
      `}</Script>
    </>
  )
}
