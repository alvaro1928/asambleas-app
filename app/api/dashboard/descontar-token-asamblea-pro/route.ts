import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getCostoEnTokens } from '@/lib/costo-tokens'

/**
 * POST /api/dashboard/descontar-token-asamblea-pro
 * Modelo Billetera de Tokens por Gestor.
 * Al activar votación: costo = unidades del conjunto (1 token = 1 unidad).
 * Descuenta del perfil del gestor (todas las filas del mismo user_id).
 * Devuelve 200 si se descontó; 402 si no hay tokens suficientes.
 */
export async function POST(request: NextRequest) {
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

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { asamblea_id } = body as { asamblea_id?: string }
    if (!asamblea_id) {
      return NextResponse.json({ error: 'Falta asamblea_id' }, { status: 400 })
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

    const { data: asamblea, error: asambleaError } = await admin
      .from('asambleas')
      .select('id, organization_id, estado')
      .eq('id', asamblea_id)
      .maybeSingle()

    if (asambleaError || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const orgId = (asamblea as { organization_id?: string }).organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'Asamblea sin conjunto' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!profile) {
      const { data: byId } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .eq('organization_id', orgId)
        .maybeSingle()
      if (!byId) {
        return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
      }
    }

    const estado = (asamblea as { estado?: string }).estado
    if (estado !== 'borrador') {
      return NextResponse.json({ ok: true, descontado: false, motivo: 'asamblea_ya_activada' })
    }

    const { count: unidadesCount } = await admin
      .from('unidades')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)

    const unidades = Math.max(0, unidadesCount ?? 0)
    const costo = getCostoEnTokens(unidades)

    const { data: perfilesGestor } = await admin
      .from('profiles')
      .select('tokens_disponibles')
      .eq('user_id', session.user.id)

    const firstProfile = Array.isArray(perfilesGestor) ? perfilesGestor[0] : perfilesGestor
    const tokensActuales = Math.max(0, Number(firstProfile?.tokens_disponibles ?? 0))

    if (tokensActuales < costo) {
      return NextResponse.json(
        {
          error: `Tokens insuficientes. Necesitas ${costo} (1 por unidad; este conjunto tiene ${unidades} unidades).`,
          code: 'SIN_TOKENS',
          costo,
          unidades,
        },
        { status: 402 }
      )
    }

    const nuevoSaldo = Math.max(0, tokensActuales - costo)

    let updateError = (await admin
      .from('profiles')
      .update({ tokens_disponibles: nuevoSaldo })
      .eq('user_id', session.user.id)).error

    if (updateError) {
      const byId = await admin
        .from('profiles')
        .update({ tokens_disponibles: nuevoSaldo })
        .eq('id', session.user.id)
      updateError = byId.error
    }
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      descontado: true,
      tokens_restantes: nuevoSaldo,
      costo,
      unidades,
    })
  } catch (e) {
    console.error('descontar-token-asamblea-pro:', e)
    return NextResponse.json({ error: 'Error al descontar tokens' }, { status: 500 })
  }
}
