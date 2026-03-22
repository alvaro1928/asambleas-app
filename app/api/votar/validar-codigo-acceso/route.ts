import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const

/**
 * POST /api/votar/validar-codigo-acceso
 * Body: { codigo: string }
 *
 * Valida el código con service_role (igual que preguntas-abiertas / estado-verificacion).
 * Así no depende del JWT del navegador: un usuario authenticated de otra organización
 * no recibe "código inválido" por RLS al abrir /votar en la misma ventana.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const codigo = typeof body?.codigo === 'string' ? body.codigo.trim() : ''
    if (!codigo) {
      return NextResponse.json({ ok: false, error: 'Falta codigo' }, { status: 400, headers: noStoreHeaders })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRoleKey) {
      return NextResponse.json({ ok: false, error: 'Configuración del servidor incompleta' }, { status: 500, headers: noStoreHeaders })
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: codigoData, error: codigoError } = await admin.rpc('validar_codigo_acceso', {
      p_codigo: codigo,
    })

    if (codigoError) {
      console.error('[validar-codigo-acceso] rpc:', codigoError)
      return NextResponse.json({ ok: false, error: codigoError.message }, { status: 500, headers: noStoreHeaders })
    }

    if (!codigoData || codigoData.length === 0) {
      return NextResponse.json(
        { ok: false, mensaje: 'Código de acceso inválido' },
        { status: 403, headers: noStoreHeaders }
      )
    }

    const row = codigoData[0] as {
      acceso_valido?: boolean
      mensaje?: string
      asamblea_id?: string
    }

    if (!row.acceso_valido) {
      return NextResponse.json(
        { ok: false, mensaje: row.mensaje || 'Acceso denegado' },
        { status: 403, headers: noStoreHeaders }
      )
    }

    return NextResponse.json({ ok: true, asamblea: codigoData[0] }, { status: 200, headers: noStoreHeaders })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    console.error('[validar-codigo-acceso]', e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: noStoreHeaders })
  }
}
