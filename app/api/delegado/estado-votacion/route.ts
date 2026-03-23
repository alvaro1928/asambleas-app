import { NextRequest, NextResponse } from 'next/server'
import { verifyDelegadoToken } from '@/lib/delegado-verify'

export const dynamic = 'force-dynamic'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const

type ResultadoOpcionGrafica = {
  opcion_id: string
  opcion_texto: string
  color: string
  votos_cantidad: number
  votos_coeficiente: number
  porcentaje_coeficiente_total: number
  porcentaje_nominal_total?: number
}

type VotoEstadoDelegado = {
  unidad_id: string
  pregunta_id: string
  opcion_id: string | null
  es_poder: boolean
  registrado_por_delegado: boolean
}

function parsearResultadosStats(
  statsData: Record<string, unknown>[] | null
): ResultadoOpcionGrafica[] {
  const rows = statsData ?? []
  const s = rows[0] as { resultados?: unknown } | undefined
  if (s?.resultados) {
    const raw = typeof s.resultados === 'string' ? JSON.parse((s.resultados as string) || '[]') : s.resultados
    const arr = Array.isArray(raw) ? raw : []
    return arr.map((r: Record<string, unknown>) => ({
      opcion_id: String(r.opcion_id ?? ''),
      opcion_texto: String(r.opcion_texto ?? r.texto_opcion ?? 'Opción'),
      color: String(r.color ?? '#6366f1'),
      votos_cantidad: Number(r.votos_cantidad ?? r.votos_count ?? 0),
      votos_coeficiente: Number(r.votos_coeficiente ?? 0),
      porcentaje_coeficiente_total: Number(r.porcentaje_coeficiente_total ?? r.porcentaje_coeficiente ?? 0),
      porcentaje_nominal_total: Number(r.porcentaje_nominal_total ?? r.porcentaje_nominal ?? 0),
    }))
  }
  if (rows.length > 0) {
    return rows.map((r: Record<string, unknown>) => ({
      opcion_id: String(r.opcion_id ?? ''),
      opcion_texto: String(r.texto_opcion ?? r.opcion_texto ?? 'Opción'),
      color: String(r.color ?? '#6366f1'),
      votos_cantidad: Number(r.votos_count ?? r.votos_cantidad ?? 0),
      votos_coeficiente: Number(r.votos_coeficiente ?? 0),
      porcentaje_coeficiente_total: Number(r.porcentaje_coeficiente ?? r.porcentaje_coeficiente_total ?? 0),
      porcentaje_nominal_total: Number(r.porcentaje_nominal ?? r.porcentaje_nominal_total ?? 0),
    }))
  }
  return []
}

/**
 * POST /api/delegado/estado-votacion
 * Body: { codigo_asamblea, token }
 *
 * Preguntas abiertas + opciones, votos registrados y avance (estadísticas).
 * Service role: no depende del JWT del navegador (RLS / hardening).
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

    /** Incluir NULL: .eq(false) excluye filas con is_archived NULL en algunas BD. */
    const { data: pregData, error: pregErr } = await admin
      .from('preguntas')
      .select('id, texto_pregunta, estado, tipo_votacion, umbral_aprobacion')
      .eq('asamblea_id', asamblea.id)
      .eq('estado', 'abierta')
      .or('is_archived.is.null,is_archived.eq.false')
      .order('orden', { ascending: true })

    if (pregErr) {
      console.error('[delegado/estado-votacion] preguntas:', pregErr)
      return NextResponse.json({ error: pregErr.message }, { status: 500, headers: noStoreHeaders })
    }

    const pregIds = (pregData || []).map((p: { id: string }) => p.id)
    const opcMap: Record<string, { id: string; texto_opcion: string; color: string; orden: number }[]> = {}

    if (pregIds.length > 0) {
      const { data: opcs, error: opErr } = await admin
        .from('opciones_pregunta')
        .select('id, pregunta_id, texto_opcion, color, orden')
        .in('pregunta_id', pregIds)
        .order('orden', { ascending: true })

      if (opErr) {
        console.error('[delegado/estado-votacion] opciones:', opErr)
        return NextResponse.json({ error: opErr.message }, { status: 500, headers: noStoreHeaders })
      }
      ;(opcs || []).forEach((o: Record<string, unknown>) => {
        const pid = o.pregunta_id as string
        if (!opcMap[pid]) opcMap[pid] = []
        opcMap[pid].push({
          id: o.id as string,
          texto_opcion: o.texto_opcion as string,
          color: (o.color as string) || '#6366f1',
          orden: Number(o.orden) || 0,
        })
      })
    }

    const preguntas = (pregData || []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      texto_pregunta: p.texto_pregunta as string,
      estado: p.estado as string,
      tipo_votacion: p.tipo_votacion as string,
      umbral_aprobacion: p.umbral_aprobacion as number | null,
      opciones: opcMap[p.id as string] || [],
    }))

    /**
     * Votos: fuente única desde `votos` por pregunta_id abierta.
     * Evita inconsistencias del join con preguntas y refleja cualquier voto
     * (página pública, admin o delegado) para el estado Ya votó/Pendiente.
     */
    let votosRegistrados: VotoEstadoDelegado[] = []
    /** No usar `votos.user_agent` en SELECT: en muchas BD antiguas esa columna no existe (500 en PostgREST). La RPC ya guarda el texto en `votante_nombre`. */
    const esRegistradoPorDelegado = (v: Record<string, unknown>) => {
      const nombre = String(v.votante_nombre ?? '').toLowerCase()
      return nombre.includes('(registrado por asistente delegado)')
    }

    const mapVotoRow = (v: Record<string, unknown>): VotoEstadoDelegado => ({
      unidad_id: v.unidad_id as string,
      pregunta_id: v.pregunta_id as string,
      opcion_id:
        esRegistradoPorDelegado(v)
          ? (v.opcion_id as string)
          : null,
      es_poder: !!v.es_poder,
      registrado_por_delegado: esRegistradoPorDelegado(v),
    })

    /**
     * Votos: consulta directa `votos` por IDs de preguntas abiertas (mismos filtros que arriba).
     * El join embebido `preguntas!inner` a veces devolvía [] sin error aunque hubiera filas en `votos`,
     * y el fallback solo corría si el join fallaba → todo quedaba "Pendiente" en el panel.
     */
    const { data: openRows, error: openErr } = await admin
      .from('preguntas')
      .select('id')
      .eq('asamblea_id', asamblea.id)
      .eq('estado', 'abierta')
      .or('is_archived.is.null,is_archived.eq.false')

    if (openErr) {
      console.error('[delegado/estado-votacion] preguntas ids abiertas:', openErr)
      return NextResponse.json({ error: openErr.message }, { status: 500, headers: noStoreHeaders })
    }

    const openIds = (openRows || []).map((p: { id: string }) => p.id)
    if (openIds.length > 0) {
      const { data: votosData, error: vErr } = await admin
        .from('votos')
        .select('unidad_id, pregunta_id, opcion_id, es_poder, votante_nombre')
        .in('pregunta_id', openIds)
      if (vErr) {
        console.error('[delegado/estado-votacion] votos:', vErr)
        return NextResponse.json({ error: vErr.message }, { status: 500, headers: noStoreHeaders })
      }
      votosRegistrados = (votosData || []).map((v: Record<string, unknown>) => mapVotoRow(v))
    }

    const avanceVotaciones: Array<{
      id: string
      texto_pregunta: string
      tipo_votacion: string
      umbral_aprobacion: number | null
      resultados: ResultadoOpcionGrafica[]
    }> = []

    for (const p of preguntas) {
      try {
        const { data: statsData, error: stErr } = await admin.rpc('calcular_estadisticas_pregunta', {
          p_pregunta_id: p.id,
        })
        if (stErr) {
          console.error('[delegado/estado-votacion] stats', p.id, stErr)
          continue
        }
        const rows = (statsData as Record<string, unknown>[] | null) ?? []
        let resultados: ResultadoOpcionGrafica[]
        try {
          resultados = parsearResultadosStats(rows)
        } catch (parseErr) {
          console.error('[delegado/estado-votacion] parse stats', p.id, parseErr)
          resultados = []
        }
        avanceVotaciones.push({
          id: p.id,
          texto_pregunta: p.texto_pregunta,
          tipo_votacion: p.tipo_votacion ?? 'coeficiente',
          umbral_aprobacion: p.umbral_aprobacion ?? null,
          resultados,
        })
      } catch (loopErr) {
        console.error('[delegado/estado-votacion] avance pregunta', p.id, loopErr)
      }
    }

    return NextResponse.json(
      { ok: true, preguntas, votosRegistrados, avanceVotaciones },
      { status: 200, headers: noStoreHeaders }
    )
  } catch (e) {
    console.error('[delegado/estado-votacion]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500, headers: noStoreHeaders })
  }
}
