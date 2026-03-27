import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type ReqBody = {
  codigo?: string
  preguntaIds?: string[]
}

type EstadisticaRow = {
  total_votos?: number | string | null
  total_coeficiente?: number | string | null
  coeficiente_total_conjunto?: number | string | null
  porcentaje_participacion?: number | string | null
  tipo_votacion?: string | null
  resultados?: unknown
}

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const

function parseResultados(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  try {
    const body = (await request.json().catch(() => ({}))) as ReqBody
    const codigo = typeof body.codigo === 'string' ? body.codigo.trim() : ''
    const preguntaIds = Array.isArray(body.preguntaIds) ? body.preguntaIds.filter(Boolean) : []

    if (!codigo) {
      return NextResponse.json({ error: 'Falta codigo' }, { status: 400, headers: noStoreHeaders })
    }
    if (preguntaIds.length === 0) {
      return NextResponse.json({ stats: {} }, { status: 200, headers: noStoreHeaders })
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
    if (codigoError || !codigoData || codigoData.length === 0 || !codigoData[0]?.acceso_valido) {
      return NextResponse.json({ stats: {} }, { status: 200, headers: noStoreHeaders })
    }

    const asambleaId = String(codigoData[0].asamblea_id ?? '')
    const { data: preguntasValidas } = await admin
      .from('preguntas')
      .select('id')
      .eq('asamblea_id', asambleaId)
      .in('id', preguntaIds)

    const ids = (preguntasValidas ?? []).map((p: { id: string }) => p.id)
    if (ids.length === 0) {
      return NextResponse.json({ stats: {} }, { status: 200, headers: noStoreHeaders })
    }

    const perQuestion = await Promise.all(
      ids.map(async (preguntaId) => {
        const { data, error } = await admin.rpc('calcular_estadisticas_pregunta', {
          p_pregunta_id: preguntaId,
        })
        const row = (Array.isArray(data) ? data[0] : data) as EstadisticaRow | undefined
        if (error || !row) {
          return [preguntaId, null] as const
        }
        return [
          preguntaId,
          {
            total_votos: Number(row.total_votos ?? 0) || 0,
            total_coeficiente: Number(row.total_coeficiente ?? 0) || 0,
            coeficiente_total_conjunto: Number(row.coeficiente_total_conjunto ?? 100) || 100,
            porcentaje_participacion: Number(row.porcentaje_participacion ?? 0) || 0,
            tipo_votacion: row.tipo_votacion ?? 'coeficiente',
            resultados: parseResultados(row.resultados),
          },
        ] as const
      })
    )

    const stats = Object.fromEntries(perQuestion.filter((entry) => entry[1] !== null))
    const res = NextResponse.json({ stats }, { status: 200, headers: noStoreHeaders })
    res.headers.set('X-Response-Time-Ms', String(Date.now() - startedAt))
    return res
  } catch (error) {
    console.error('POST /api/votar/estadisticas-preguntas', error)
    const res = NextResponse.json({ error: 'Error interno' }, { status: 500, headers: noStoreHeaders })
    res.headers.set('X-Response-Time-Ms', String(Date.now() - startedAt))
    return res
  }
}
