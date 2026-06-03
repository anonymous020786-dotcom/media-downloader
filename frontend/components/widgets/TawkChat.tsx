'use client'
import Script from 'next/script'
interface Props { propertyId: string; widgetId: string }

export default function TawkChat({ propertyId, widgetId }: Props) {
  if (!propertyId || propertyId === 'XXXXXXXXXX') return null
  return (
    <Script id="tawk-to" strategy="afterInteractive">
      {`var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src='https://embed.tawk.to/${propertyId}/${widgetId}';s1.charset='UTF-8';s1.setAttribute('crossorigin','*');s0.parentNode.insertBefore(s1,s0);})();`}
    </Script>
  )
}
