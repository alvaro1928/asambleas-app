import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
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

    if (code && !access_token) {
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
              } catch {
                // Ignorar si headers ya enviados
              }
            },
            remove(name: string, options: CookieOptions) {
              try {
                cookieStore.set({ name, value: '', ...options })
              } catch {
                // Ignorar
              }
            },
          },
        }
      )

      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) return jsonError(error.message, 400)
      return jsonSuccess({ success: true, user: data.user })
    }

    if (!access_token || !refresh_token) {
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
            } catch {
              // Ignorar
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch {
              // Ignorar
            }
          },
        },
      }
    )

    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) return jsonError(error.message, 400)
    return jsonSuccess({ success: true, user: data.user })
  } catch (error) {
    console.error('[api/auth/set-session]', error)
    return jsonError('Error interno del servidor', 500)
  }
}
