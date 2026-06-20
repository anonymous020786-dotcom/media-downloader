import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code        = searchParams.get('code')
  const redirectUrl = searchParams.get('redirect_url') ?? '/download'
  const next        = redirectUrl.startsWith('/') ? redirectUrl : '/download'

  // request.url reflects the container-internal address (http://0.0.0.0:3000)
  // when running behind nginx-proxy. Use the public site URL instead.
  const forwardedHost  = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = process.env.NEXT_PUBLIC_SITE_URL
    ?? (forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`)
}
