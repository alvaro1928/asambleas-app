import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Si Google/Supabase redirige a la raíz con ?code= (en vez de /auth/callback/oauth), enviar al callback para intercambiar el code y llevar al dashboard
  const pathname = request.nextUrl.pathname
  const code = request.nextUrl.searchParams.get('code')
  if (pathname === '/' && code) {
    const callbackUrl = new URL('/auth/callback/oauth', request.url)
    callbackUrl.searchParams.set('code', code)
    callbackUrl.searchParams.set('next', '/dashboard')
    return NextResponse.redirect(callbackUrl)
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // 🔥 Asegurar que las cookies se setean correctamente en producción
          request.cookies.set({ name, value, ...options })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // 🔥 Refrescar la sesión del usuario
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // ✅ Proteger rutas del dashboard y super-admin
  if (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/super-admin')) {
    if (!session) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // ✅ Si está en /login y ya tiene sesión, redirigir al dashboard
  if (request.nextUrl.pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/', // raíz: redirigir /?code= a callback OAuth
    '/((?!_next/static|_next/image|favicon.ico|auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}