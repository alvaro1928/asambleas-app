import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const

/**
 * Lógica compartida GET/POST.
 * POST evita que proxies/CDN cacheen la respuesta como GET (útil si la lista queda “pegada”).
 */
async function responderPreguntasAbiertas(codigoRaw: string | null | undefined) {
  const codigo = codigoRaw?.trim()
  if (!codigo) {
    return NextResponse.json({ error: 'Falta codigo' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
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
    return NextResponse.json({ preguntas: [] }, { headers: noStoreHeaders })
  }

  const asambleaId = codigoData[0].asamblea_id as string

  const { data: preguntasData, error: preguntasError } = await admin
    .from('preguntas')
    .select('id, texto_pregunta, descripcion, tipo_votacion, estado, umbral_aprobacion')
    .eq('asamblea_id', asambleaId)
    .eq('estado', 'abierta')
    .eq('is_archived', false)
    .order('created_at', { ascending: true })

  if (preguntasError) {
    console.error('[preguntas-abiertas] preguntas:', preguntasError)
    return NextResponse.json({ error: preguntasError.message }, { status: 500 })
  }

  const preguntas = preguntasData || []
  if (preguntas.length === 0) {
    return NextResponse.json({ preguntas: [] }, { headers: noStoreHeaders })
  }

  const preguntaIds = preguntas.map((p: { id: string }) => p.id)
  const { data: opcionesData, error: opcionesError } = await admin
    .from('opciones_pregunta')
    .select('id, pregunta_id, texto_opcion, color, orden')
    .in('pregunta_id', preguntaIds)
    .order('orden', { ascending: true })

  if (opcionesError) {
    console.error('[preguntas-abiertas] opciones:', opcionesError)
    return NextResponse.json({ error: opcionesError.message }, { status: 500 })
  }

  const opcionesPorPregunta: Record<string, { id: string; texto: string; color: string }[]> = {}
  for (const p of preguntas) {
    opcionesPorPregunta[p.id] = []
  }
  for (const o of opcionesData || []) {
    const row = o as {
      pregunta_id: string
      id: string
      texto_opcion: string
      color: string
    }
    const pid = row.pregunta_id
    if (opcionesPorPregunta[pid]) {
      opcionesPorPregunta[pid].push({
        id: row.id,
        texto: row.texto_opcion,
        color: row.color,
      })
    }
  }

  const preguntasConOpciones = preguntas.map((p: Record<string, unknown>) => ({
    ...p,
    opciones: opcionesPorPregunta[String(p.id)] || [],
  }))

  return NextResponse.json({ preguntas: preguntasConOpciones }, { headers: noStoreHeaders })
}

/**
 * GET /api/votar/preguntas-abiertas?codigo=XXXX
 * Lista preguntas abiertas + opciones para la asamblea del código.
 * Usa service_role para no depender del JWT del navegador (evita RLS que oculta
 * filas cuando hay sesión authenticated de otra organización — típico en móvil).
 */
export async function GET(request: NextRequest) {
  try {
    const codigo = request.nextUrl.searchParams.get('codigo')
    return await responderPreguntasAbiertas(codigo)
  } catch (e) {
    console.error('GET /api/votar/preguntas-abiertas:', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/votar/preguntas-abiertas  body: { codigo: string }
 * Misma respuesta que GET; preferido desde el cliente para evitar caché de GET.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { codigo?: string }
    return await responderPreguntasAbiertas(body.codigo)
  } catch (e) {
    console.error('POST /api/votar/preguntas-abiertas:', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
