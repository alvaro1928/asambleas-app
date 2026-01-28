import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  // Crear el response antes de cualquier operación
  const cookieStore = await cookies()
  const response = NextResponse.redirect(new URL(next, request.url))
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { 
          return cookieStore.get(name)?.value 
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
            response.cookies.set({ name, value, ...options })
          } catch (error) {
            // Ignorar errores de cookies
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
            response.cookies.set({ name, value: '', ...options })
          } catch (error) {
            // Ignorar errores de cookies
          }
        },
      },
    }
  )

  // 🔥 Manejo de Magic Link (token_hash + type)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!error) {
      return response
    }

    console.error('Error verificando OTP:', error)
    return NextResponse.redirect(
      new URL(`/login?error=auth-failed&message=${encodeURIComponent(error.message)}`, request.url)
    )
  }

  // 🔥 Manejo de OAuth flow (code)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return response
    }

    console.error('Error intercambiando código:', error)
    return NextResponse.redirect(
      new URL(`/login?error=auth-callback-failed&message=${encodeURIComponent(error.message)}`, request.url)
    )
  }

  // ❌ Si no hay token_hash ni code
  console.error('No se recibió token_hash ni code')
  return NextResponse.redirect(
    new URL('/login?error=no-token', request.url)
  )
}