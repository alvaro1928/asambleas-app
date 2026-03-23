import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const

type ReqBody = {
  codigo?: string
  preguntaIds?: string[]
  unidadIds?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ReqBody
    const codigo = body.codigo?.trim()
    const preguntaIds = Array.isArray(body.preguntaIds) ? body.preguntaIds.filter(Boolean) : []
    const unidadIds = Array.isArray(body.unidadIds) ? body.unidadIds.filter(Boolean) : []

    if (!codigo) {
      return NextResponse.json({ error: 'Falta codigo' }, { status: 400, headers: noStoreHeaders })
    }
    if (preguntaIds.length === 0 || unidadIds.length === 0) {
      return NextResponse.json({ votos: [] }, { status: 200, headers: noStoreHeaders })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500, headers: noStoreHeaders })
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: codigoData, error: codigoError } = await admin.rpc('validar_codigo_acceso', {
      p_codigo: codigo,
    })
    if (
      codigoError ||
      !codigoData ||
      codigoData.length === 0 ||
      !codigoData[0]?.acceso_valido
    ) {
      return NextResponse.json({ votos: [] }, { status: 200, headers: noStoreHeaders })
    }

    const asambleaId = codigoData[0].asamblea_id as string

    const { data: preguntasValidas, error: preguntasErr } = await admin
      .from('preguntas')
      .select('id')
      .eq('asamblea_id', asambleaId)
      .in('id', preguntaIds)
    if (preguntasErr) {
      return NextResponse.json({ error: preguntasErr.message }, { status: 500, headers: noStoreHeaders })
    }
    const preguntaIdsValidos = (preguntasValidas || []).map((p: { id: string }) => p.id)
    if (preguntaIdsValidos.length === 0) {
      return NextResponse.json({ votos: [] }, { status: 200, headers: noStoreHeaders })
    }

    const { data: votosData, error: votosErr } = await admin
      .from('votos')
      .select('pregunta_id, unidad_id, opcion_id, opciones_pregunta(texto_opcion)')
      .in('pregunta_id', preguntaIdsValidos)
      .in('unidad_id', unidadIds)
    if (votosErr) {
      return NextResponse.json({ error: votosErr.message }, { status: 500, headers: noStoreHeaders })
    }

    const votos = (votosData || []).map((v: Record<string, unknown>) => ({
      pregunta_id: String(v.pregunta_id || ''),
      unidad_id: String(v.unidad_id || ''),
      opcion_id: String(v.opcion_id || ''),
      opcion_texto:
        (v.opciones_pregunta as { texto_opcion?: string } | null | undefined)?.texto_opcion || '',
    }))

    return NextResponse.json({ votos }, { status: 200, headers: noStoreHeaders })
  } catch (e) {
    console.error('POST /api/votar/votos-por-unidades:', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500, headers: noStoreHeaders })
  }
}
