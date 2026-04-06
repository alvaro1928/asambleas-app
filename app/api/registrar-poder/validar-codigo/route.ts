import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { logRouteError, publicErrorMessage } from '@/lib/route-errors'

export const dynamic = 'force-dynamic'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const

/**
 * POST /api/registrar-poder/validar-codigo
 * Valida código para el portal de registro de poderes (acceso público O registro_poderes_publico).
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

    const { data: codigoData, error: codigoError } = await admin.rpc('validar_codigo_registro_poderes', {
      p_codigo: codigo,
    })

    if (codigoError) {
      logRouteError('api/registrar-poder/validar-codigo', codigoError, { rpc: 'validar_codigo_registro_poderes' })
      return NextResponse.json(
        { ok: false, error: publicErrorMessage(codigoError, 'No se pudo validar el código. Intenta de nuevo.') },
        { status: 500, headers: noStoreHeaders }
      )
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
      registro_poderes_publico?: boolean
    }

    if (!row.acceso_valido) {
      return NextResponse.json(
        { ok: false, mensaje: row.mensaje || 'Acceso denegado' },
        { status: 403, headers: noStoreHeaders }
      )
    }

    return NextResponse.json({ ok: true, asamblea: codigoData[0] }, { status: 200, headers: noStoreHeaders })
  } catch (e: unknown) {
    logRouteError('api/registrar-poder/validar-codigo', e)
    return NextResponse.json(
      { ok: false, error: publicErrorMessage(e, 'Error al validar el código. Intenta de nuevo.') },
      { status: 500, headers: noStoreHeaders }
    )
  }
}
