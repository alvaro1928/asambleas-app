import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (code) {
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
              // Ignorar errores de cookies en producción
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
              response.cookies.set({ name, value: '', ...options })
            } catch (error) {
              // Ignorar errores de cookies en producción
            }
          },
        },
      }
    )

    // 🔥 Intercambiamos el código por la sesión
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // ✅ Retornar la respuesta con las cookies seteadas
      return response
    }

    // ❌ Si hay error en el intercambio
    console.error('Error intercambiando código:', error)
    return NextResponse.redirect(
      new URL(`/login?error=auth-callback-failed&message=${encodeURIComponent(error.message)}`, request.url)
    )
  }

  // ❌ Si no hay código
  return NextResponse.redirect(
    new URL('/login?error=no-code', request.url)
  )
}