import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() reads JWT from cookies locally — NO network call to Supabase
  // getUser() calls Supabase Auth API on EVERY request, which crashes the NANO server
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = request.nextUrl.pathname
  const isPublicRoute = pathname.startsWith('/login') || pathname.startsWith('/api/') || pathname.startsWith('/cambiar-clave')

  // If no session and not on public route, redirect to login
  if (!session && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If session exists and user is on login page, redirect to dashboard
  // But first verify the session is not expired to prevent redirect loops
  if (session && pathname.startsWith('/login')) {
    const expiresAt = session.expires_at
    const now = Math.floor(Date.now() / 1000)
    if (expiresAt && expiresAt < now) {
      // Session expired — clear it and stay on login
      await supabase.auth.signOut()
      return supabaseResponse
    }
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
