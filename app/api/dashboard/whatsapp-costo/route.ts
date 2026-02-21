import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dashboard/whatsapp-costo
 * Devuelve tokens_por_mensaje_whatsapp para que el gestor vea cuántos tokens se descontarán antes de enviar.
 * No expone información de Super Admin.
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const { data } = await admin
      .from('configuracion_whatsapp')
      .select('tokens_por_mensaje_whatsapp')
      .eq('key', 'default')
      .maybeSingle()

    const tokensPorMensaje = data?.tokens_por_mensaje_whatsapp != null
      ? Math.max(1, Number(data.tokens_por_mensaje_whatsapp))
      : 1

    return NextResponse.json({ tokens_por_mensaje_whatsapp: tokensPorMensaje })
  } catch (e) {
    console.error('GET /api/dashboard/whatsapp-costo:', e)
    return NextResponse.json({ error: 'Error al obtener costo' }, { status: 500 })
  }
}
