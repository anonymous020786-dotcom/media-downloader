import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code        = searchParams.get('code')
  const redirectUrl = searchParams.get('redirect_url') ?? '/download'
  const next        = redirectUrl.startsWith('/') ? redirectUrl : '/download'

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dl.videodownloaders.cloud'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] exchangeCodeForSession error:', JSON.stringify(error))
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}/sign-in?error=no_code`)
}
