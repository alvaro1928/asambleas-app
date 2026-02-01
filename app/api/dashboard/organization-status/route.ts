import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getCostoEnTokens } from '@/lib/costo-tokens'

/**
 * GET /api/dashboard/organization-status?organization_id=xxx
 * Modelo Billetera de Tokens por Gestor.
 * Devuelve tokens_disponibles del gestor (perfil), unidades del conjunto y costo (1 token = 1 unidad).
 * Solo si el usuario tiene perfil en esa organización.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Falta organization_id' },
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
          set() {},
          remove() {},
        },
      }
    )

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id

    // Verificar acceso: usuario tiene perfil en esta organización (user_id o id = auth uid)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, tokens_disponibles')
      .eq('organization_id', organizationId)

    const list = Array.isArray(profiles) ? profiles : profiles ? [profiles] : []
    const profileAccess = list.find(
      (p: { user_id?: string; id?: string }) => p.user_id === userId || p.id === userId
    )

    if (!profileAccess) {
      return NextResponse.json(
        { error: 'No tienes acceso a este conjunto' },
        { status: 403 }
      )
    }

    // Tokens del gestor: leer de cualquier perfil del usuario (user_id o id)
    let tokensDisponibles = Math.max(0, Number(profileAccess?.tokens_disponibles ?? 0))
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('tokens_disponibles')
      .eq('user_id', userId)
    if (Array.isArray(allProfiles) && allProfiles[0]) {
      tokensDisponibles = Math.max(0, Number(allProfiles[0].tokens_disponibles ?? 0))
    } else {
      const { data: byId } = await supabase
        .from('profiles')
        .select('tokens_disponibles')
        .eq('id', userId)
        .limit(1)
        .maybeSingle()
      if (byId) tokensDisponibles = Math.max(0, Number(byId.tokens_disponibles ?? 0))
    }

    // Unidades del conjunto (costo = unidades; 1 token = 1 unidad)
    const { count: unidadesCount } = await supabase
      .from('unidades')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    const unidades = Math.max(0, unidadesCount ?? 0)
    const costo = getCostoEnTokens(unidades)

    return NextResponse.json({
      tokens_disponibles: tokensDisponibles,
      unidades_conjunto: unidades,
      costo_operacion: costo,
      puede_operar: tokensDisponibles >= costo,
    })
  } catch (e) {
    console.error('organization-status:', e)
    return NextResponse.json(
      { error: 'Error al obtener el estado' },
      { status: 500 }
    )
  }
}
