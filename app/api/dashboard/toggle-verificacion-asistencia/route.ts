import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function usuarioTieneAccesoConjunto(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (profile) return true

  const { data: byId } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  return !!byId
}

type ToggleBody = {
  asamblea_id?: string
  activar?: boolean
}

/**
 * POST /api/dashboard/toggle-verificacion-asistencia
 * Body: { asamblea_id: string, activar: boolean }
 *
 * Fuerza el ciclo correcto de verificación general:
 * - activar=true: abre una nueva sesión general (pregunta_id null)
 * - activar=false: cierra sesiones abiertas y persiste snapshot
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

    const body = (await request.json().catch(() => ({}))) as ToggleBody
    const asambleaId = typeof body.asamblea_id === 'string' ? body.asamblea_id.trim() : ''
    const activar = body.activar === true

    if (!asambleaId) {
      return NextResponse.json({ error: 'Falta asamblea_id' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: asambleaRow, error: asambleaErr } = await admin
      .from('asambleas')
      .select('id, organization_id, verificacion_asistencia_activa, verificacion_pregunta_id')
      .eq('id', asambleaId)
      .maybeSingle()

    if (asambleaErr || !asambleaRow?.organization_id) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const orgId = asambleaRow.organization_id as string
    const autorizado = await usuarioTieneAccesoConjunto(supabase, session.user.id, orgId)
    if (!autorizado) {
      return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
    }

    if (activar) {
      const { error: updateErr } = await admin
        .from('asambleas')
        .update({
          verificacion_asistencia_activa: true,
          verificacion_pregunta_id: null,
        })
        .eq('id', asambleaId)
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      // Asegurar sesión general abierta (si el trigger no está, la creamos).
      const { data: sesionAbierta, error: openReadErr } = await admin
        .from('verificacion_asamblea_sesiones')
        .select('id')
        .eq('asamblea_id', asambleaId)
        .is('pregunta_id', null)
        .is('cierre_at', null)
        .order('apertura_at', { ascending: false })
        .limit(1)

      if (openReadErr) {
        return NextResponse.json({ error: openReadErr.message }, { status: 500 })
      }

      if (!sesionAbierta?.length) {
        const { error: insertErr } = await admin
          .from('verificacion_asamblea_sesiones')
          .insert({
            asamblea_id: asambleaId,
            pregunta_id: null,
            apertura_at: new Date().toISOString(),
          })
        if (insertErr) {
          return NextResponse.json({ error: insertErr.message }, { status: 500 })
        }
      }
    } else {
      // Cerrar por RPC si existe (incluye snapshot).
      const rpcResult = await admin.rpc('cerrar_sesiones_verificacion_abiertas', {
        p_asamblea_id: asambleaId,
      })
      if (rpcResult.error) {
        // Fallback: cerrar sesión general abierta manualmente con snapshot.
        const { data: verData } = await admin.rpc('calcular_verificacion_quorum', {
          p_asamblea_id: asambleaId,
          p_pregunta_id: null,
          p_solo_sesion_actual: true,
        })
        const v = (verData?.[0] ?? {}) as {
          total_verificados?: number
          coeficiente_verificado?: number
          porcentaje_verificado?: number
          quorum_alcanzado?: boolean
        }
        const { error: manualCloseErr } = await admin
          .from('verificacion_asamblea_sesiones')
          .update({
            cierre_at: new Date().toISOString(),
            total_verificados: Number(v.total_verificados) || 0,
            coeficiente_verificado: Number(v.coeficiente_verificado) || 0,
            porcentaje_verificado: Number(v.porcentaje_verificado) || 0,
            quorum_alcanzado: !!v.quorum_alcanzado,
          })
          .eq('asamblea_id', asambleaId)
          .is('pregunta_id', null)
          .is('cierre_at', null)
        if (manualCloseErr) {
          return NextResponse.json({ error: manualCloseErr.message }, { status: 500 })
        }
      }

      const { error: updateErr } = await admin
        .from('asambleas')
        .update({
          verificacion_asistencia_activa: false,
          verificacion_pregunta_id: null,
        })
        .eq('id', asambleaId)
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
    }

    const { data: updatedRow, error: readErr } = await admin
      .from('asambleas')
      .select('verificacion_asistencia_activa, verificacion_pregunta_id')
      .eq('id', asambleaId)
      .single()
    if (readErr) {
      return NextResponse.json({ error: readErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      verificacion_asistencia_activa: !!updatedRow.verificacion_asistencia_activa,
      verificacion_pregunta_id: updatedRow.verificacion_pregunta_id ?? null,
    })
  } catch (e) {
    console.error('POST /api/dashboard/toggle-verificacion-asistencia:', e)
    return NextResponse.json({ error: 'Error al cambiar verificación de asistencia' }, { status: 500 })
  }
}
