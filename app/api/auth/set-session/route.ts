import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Cabeceras para que el navegador no cachee y persista las cookies de sesión
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
}

function jsonSuccess(data: object) {
  return NextResponse.json(data, { headers: noCacheHeaders })
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: noCacheHeaders })
}

export async function POST(request: Request) {
  try {
    const { access_token, refresh_token, code } = await request.json()

    console.log('🔍 [API SET-SESSION] Recibiendo tokens o code...')

    // Si tenemos un code, intercambiarlo primero
    if (code && !access_token) {
      console.log('🔍 [API SET-SESSION] Intercambiando code por sesión...')
      
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
                // Ignorar errores
              }
            },
            remove(name: string, options: CookieOptions) {
              try {
                cookieStore.set({ name, value: '', ...options })
              } catch (error) {
                // Ignorar errores
              }
            },
          },
        }
      )

      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('❌ [API SET-SESSION] Error intercambiando code:', error)
        return jsonError(error.message, 400)
      }

      console.log('✅ [API SET-SESSION] Code intercambiado correctamente')
      console.log('✅ [API SET-SESSION] Usuario:', data.user?.email)

      return jsonSuccess({ success: true, user: data.user })
    }

    if (!access_token || !refresh_token) {
      console.error('❌ [API SET-SESSION] Tokens o code faltantes')
      return jsonError('Tokens o code faltantes', 400)
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
      return jsonError(error.message, 400)
    }

    console.log('✅ [API SET-SESSION] Sesión establecida correctamente')
    console.log('✅ [API SET-SESSION] Usuario:', data.user?.email)

    return jsonSuccess({ success: true, user: data.user })
  } catch (error) {
    console.error('❌ [API SET-SESSION] Error:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
