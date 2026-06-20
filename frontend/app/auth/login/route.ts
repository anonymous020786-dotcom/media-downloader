import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const provider    = (searchParams.get('provider') ?? 'google') as 'google'
  const redirectUrl = searchParams.get('redirect_url') ?? '/download'
  const next        = redirectUrl.startsWith('/') ? redirectUrl : '/download'

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dl.videodownloaders.cloud'

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?redirect_url=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error?.message ?? 'oauth_failed')}`)
  }

  // The server client has already written the PKCE code verifier into the
  // response cookies (HttpOnly). We forward those cookies and redirect.
  return NextResponse.redirect(data.url)
}
