import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()             { return request.cookies.getAll() },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  // Refreshes session and rotates tokens — must not be removed.
  const { data: { user } } = await supabase.auth.getUser()

  // ── Authentication-gated routes ───────────────────────────────────────────────
  // All interactive tools require a signed-in user. Public pages (landing,
  // movies/people/news browsing, blog, legal, auth pages) stay open.
  const PROTECTED_PREFIXES = [
    '/admin',
    '/download',
    '/tools',
    '/player',
    '/history',
    '/schedules',
    '/account',
    '/movies',
    '/people',
    '/news',
  ]

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p))

  if (isProtected && !user) {
    const signIn = request.nextUrl.clone()
    signIn.pathname = '/sign-in'
    signIn.searchParams.set('redirect_url', path + request.nextUrl.search)
    return NextResponse.redirect(signIn)
  }

  return supabaseResponse
}
