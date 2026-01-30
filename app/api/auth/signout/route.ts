import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Cierra sesión solo en el servidor (borra cookies de sesión).
 * No llamamos signOut() en el cliente para no borrar el code_verifier de PKCE,
 * así "Entrar con Google" sigue funcionando después de cerrar sesión.
 */
export async function POST() {
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
            // Ignorar si ya se enviaron headers
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

  await supabase.auth.signOut()

  return NextResponse.json({ success: true })
}
