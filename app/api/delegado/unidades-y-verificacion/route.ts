import { NextRequest, NextResponse } from 'next/server'
import { verifyDelegadoToken } from '@/lib/delegado-verify'

export const dynamic = 'force-dynamic'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const

/**
 * POST /api/delegado/unidades-y-verificacion
 * Body: { codigo_asamblea, token }
 *
 * Lista unidades + estado de verificación de asistencia en la sesión actual.
 * Service role (no depende del JWT del navegador; evita RLS post-hardening).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { codigo_asamblea, token } = body as { codigo_asamblea?: string; token?: string }

    const v = await verifyDelegadoToken(codigo_asamblea, token)
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: v.status, headers: noStoreHeaders })
    }

    const { admin, asamblea } = v

    const soloDemo = asamblea.is_demo && !asamblea.sandbox_usar_unidades_reales
    let q = admin
      .from('unidades')
      .select('id, torre, numero, nombre_propietario, email_propietario, coeficiente')
      .eq('organization_id', asamblea.organization_id)
      .order('torre', { ascending: true })
      .order('numero', { ascending: true })
    q = soloDemo ? q.eq('is_demo', true) : q.or('is_demo.eq.false,is_demo.is.null')

    const { data: todas, error: uErr } = await q
    if (uErr) {
      console.error('[delegado/unidades-y-verificacion] unidades:', uErr)
      return NextResponse.json({ error: uErr.message }, { status: 500, headers: noStoreHeaders })
    }

    const { data: idsSesion, error: rpcErr } = await admin.rpc('unidad_ids_verificados_sesion_actual', {
      p_asamblea_id: asamblea.id,
      p_pregunta_id: null,
    })
    if (rpcErr) {
      console.error('[delegado/unidades-y-verificacion] rpc:', rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500, headers: noStoreHeaders })
    }

    const verificadasSet = new Set<string>()
    const esPoderVerificados = new Map<string, boolean>()
    ;(idsSesion || []).forEach((r: { unidad_id?: string; es_poder?: boolean }) => {
      if (r.unidad_id) {
        verificadasSet.add(r.unidad_id)
        if (r.es_poder === true) esPoderVerificados.set(r.unidad_id, true)
      }
    })

    const unidades = (todas || []).map((u: Record<string, unknown>) => ({
      id: u.id as string,
      torre: (u.torre as string) || 'S/T',
      numero: (u.numero as string) || 'S/N',
      nombre_propietario: (u.nombre_propietario as string) || 'S/N',
      email_propietario: (u.email_propietario as string) || '',
      coeficiente: Number(u.coeficiente) || 0,
      ya_verifico: verificadasSet.has(u.id as string),
      es_poder: esPoderVerificados.get(u.id as string) ?? false,
    }))

    const totalUnidades = unidades.length
    let conAsistencia = verificadasSet.size
    if (!asamblea.verificacion_asistencia_activa) {
      const { data: ultimaSesionCerrada } = await admin
        .from('verificacion_asamblea_sesiones')
        .select('total_verificados')
        .eq('asamblea_id', asamblea.id)
        .is('pregunta_id', null)
        .not('cierre_at', 'is', null)
        .order('cierre_at', { ascending: false })
        .limit(1)
      if (ultimaSesionCerrada?.length) {
        conAsistencia = Number((ultimaSesionCerrada[0] as { total_verificados?: number }).total_verificados ?? 0)
      }
    }
    const pendientes = Math.max(0, totalUnidades - conAsistencia)

    return NextResponse.json(
      {
        ok: true,
        unidades,
        resumen_asistencia: {
          con_asistencia: conAsistencia,
          pendientes_verificar: pendientes,
        },
      },
      { status: 200, headers: noStoreHeaders }
    )
  } catch (e) {
    console.error('[delegado/unidades-y-verificacion]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500, headers: noStoreHeaders })
  }
}
