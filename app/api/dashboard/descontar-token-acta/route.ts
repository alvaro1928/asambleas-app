import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getCostoEnTokens } from '@/lib/costo-tokens'

/**
 * POST /api/dashboard/descontar-token-acta
 * Trigger de cobro: ANTES de entregar el acta (PDF/impresión).
 * Descuenta tokens del gestor (todas las filas del user_id en profiles).
 * 402 si saldo < costo; mensaje: "Saldo insuficiente: Necesitas {costo} tokens y tienes {saldo}".
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
      .select('id, organization_id')
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

    const { count: unidadesCount } = await admin
      .from('unidades')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)

    const unidades = Math.max(0, unidadesCount ?? 0)
    const costoInt = Math.max(0, Math.floor(Number(getCostoEnTokens(unidades))))

    const { data: perfilesGestor } = await admin
      .from('profiles')
      .select('tokens_disponibles')
      .eq('user_id', session.user.id)

    const firstProfile = Array.isArray(perfilesGestor) ? perfilesGestor[0] : perfilesGestor
    let tokensActuales = Math.max(0, Math.floor(Number(firstProfile?.tokens_disponibles ?? 0)))
    if (perfilesGestor == null || (Array.isArray(perfilesGestor) && perfilesGestor.length === 0)) {
      const { data: byId } = await admin
        .from('profiles')
        .select('tokens_disponibles')
        .eq('id', session.user.id)
        .limit(1)
        .maybeSingle()
      tokensActuales = Math.max(0, Math.floor(Number((byId as { tokens_disponibles?: number } | null)?.tokens_disponibles ?? 0)))
    }

    if (tokensActuales < costoInt) {
      return NextResponse.json(
        {
          error: `Saldo insuficiente: Necesitas ${costoInt} tokens y tienes ${tokensActuales}.`,
          code: 'SIN_TOKENS',
          costo: costoInt,
          saldo: tokensActuales,
        },
        { status: 402 }
      )
    }

    const nuevoSaldo = Math.max(0, tokensActuales - costoInt)

    const { error: updateByUser } = await admin
      .from('profiles')
      .update({ tokens_disponibles: nuevoSaldo })
      .eq('user_id', session.user.id)
    let updateError = updateByUser
    if (updateError) {
      const { error: updateById } = await admin
        .from('profiles')
        .update({ tokens_disponibles: nuevoSaldo })
        .eq('id', session.user.id)
      updateError = updateById
    }
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await admin
      .from('billing_logs')
      .insert({
        user_id: session.user.id,
        tipo_operacion: 'Acta',
        asamblea_id,
        organization_id: orgId,
        tokens_usados: costoInt,
        saldo_restante: nuevoSaldo,
        metadata: { unidades },
      })
      .then(() => {})
      .catch((e) => console.error('billing_logs insert:', e))

    return NextResponse.json({
      ok: true,
      tokens_restantes: nuevoSaldo,
      costo: costoInt,
    })
  } catch (e) {
    console.error('descontar-token-acta:', e)
    return NextResponse.json({ error: 'Error al descontar tokens' }, { status: 500 })
  }
}
