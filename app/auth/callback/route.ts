import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const code = requestUrl.searchParams.get('code')
  const access_token = requestUrl.searchParams.get('access_token')
  const refresh_token = requestUrl.searchParams.get('refresh_token')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  console.log('🔍 [CALLBACK] Params recibidos:', {
    token_hash: !!token_hash,
    type,
    code: !!code,
    access_token: !!access_token,
    refresh_token: !!refresh_token,
  })

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

  // 🔥 Manejo de Implicit Flow (access_token + refresh_token)
  if (access_token && refresh_token) {
    console.log('✅ [CALLBACK] Usando Implicit Flow (access_token)')
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (!error) {
      console.log('✅ [CALLBACK] Sesión establecida correctamente')
      return response
    }

    console.error('❌ [CALLBACK] Error estableciendo sesión:', error)
    return NextResponse.redirect(
      new URL(`/login?error=session-failed&message=${encodeURIComponent(error.message)}`, request.url)
    )
  }

  // 🔥 Manejo de Magic Link (token_hash + type)
  if (token_hash && type) {
    console.log('✅ [CALLBACK] Usando PKCE Flow (token_hash)')
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!error) {
      console.log('✅ [CALLBACK] OTP verificado correctamente')
      return response
    }

    console.error('❌ [CALLBACK] Error verificando OTP:', error)
    return NextResponse.redirect(
      new URL(`/login?error=auth-failed&message=${encodeURIComponent(error.message)}`, request.url)
    )
  }

  // 🔥 Manejo de OAuth flow (code)
  if (code) {
    console.log('✅ [CALLBACK] Usando OAuth Flow (code)')
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      console.log('✅ [CALLBACK] Código intercambiado correctamente')
      return response
    }

    console.error('❌ [CALLBACK] Error intercambiando código:', error)
    return NextResponse.redirect(
      new URL(`/login?error=auth-callback-failed&message=${encodeURIComponent(error.message)}`, request.url)
    )
  }

  // ❌ Si no hay ningún método de autenticación
  console.error('❌ [CALLBACK] No se recibió ningún parámetro de autenticación')
  return NextResponse.redirect(
    new URL('/login?error=no-auth-params', request.url)
  )
}