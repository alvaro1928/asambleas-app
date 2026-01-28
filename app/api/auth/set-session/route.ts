import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { access_token, refresh_token } = await request.json()

    console.log('🔍 [API SET-SESSION] Recibiendo tokens...')

    if (!access_token || !refresh_token) {
      console.error('❌ [API SET-SESSION] Tokens faltantes')
      return NextResponse.json(
        { error: 'Tokens faltantes' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    
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
            } catch (error) {
              // Ignorar errores de cookies en headers ya enviados
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // Ignorar errores de cookies en headers ya enviados
            }
          },
        },
      }
    )

    // Establecer la sesión con las cookies del servidor
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (error) {
      console.error('❌ [API SET-SESSION] Error estableciendo sesión:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.log('✅ [API SET-SESSION] Sesión establecida correctamente')
    console.log('✅ [API SET-SESSION] Usuario:', data.user?.email)

    return NextResponse.json({
      success: true,
      user: data.user,
    })
  } catch (error) {
    console.error('❌ [API SET-SESSION] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
