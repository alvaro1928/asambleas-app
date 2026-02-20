import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/votar/consentimiento?codigo=XXX&identificador=YYY
 * Devuelve si el votante ya aceptó el tratamiento de datos para esta asamblea.
 * identificador = email o teléfono (normalizado).
 */
export async function GET(request: NextRequest) {
  try {
    const codigo = request.nextUrl.searchParams.get('codigo')
    const identificador = request.nextUrl.searchParams.get('identificador')
    if (!codigo?.trim() || !identificador?.trim()) {
      return NextResponse.json({ error: 'Faltan codigo o identificador' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const { data: asamblea } = await admin
      .from('asambleas')
      .select('id')
      .eq('codigo_acceso', codigo.trim().toUpperCase())
      .maybeSingle()

    if (!asamblea?.id) {
      return NextResponse.json({ accepted: false })
    }

    const idNorm = identificador.trim().toLowerCase()
    const { data: row } = await admin
      .from('consentimiento_tratamiento_datos')
      .select('id, accepted_at')
      .eq('asamblea_id', asamblea.id)
      .eq('identificador', idNorm)
      .maybeSingle()

    return NextResponse.json({ accepted: !!row, accepted_at: row?.accepted_at ?? null })
  } catch (e) {
    console.error('GET /api/votar/consentimiento:', e)
    return NextResponse.json({ error: 'Error al consultar consentimiento' }, { status: 500 })
  }
}

/**
 * POST /api/votar/consentimiento
 * Body: { codigo, identificador, ip? }
 * Registra la aceptación del tratamiento de datos para esta asamblea + votante.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { codigo, identificador, ip } = body as { codigo?: string; identificador?: string; ip?: string }
    if (!codigo?.trim() || !identificador?.trim()) {
      return NextResponse.json({ error: 'Faltan codigo o identificador' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const { data: asamblea } = await admin
      .from('asambleas')
      .select('id')
      .eq('codigo_acceso', codigo.trim().toUpperCase())
      .maybeSingle()

    if (!asamblea?.id) {
      return NextResponse.json({ error: 'Código de asamblea no válido' }, { status: 400 })
    }

    const idNorm = identificador.trim().toLowerCase()
    const { error } = await admin.from('consentimiento_tratamiento_datos').upsert(
      {
        asamblea_id: asamblea.id,
        identificador: idNorm,
        accepted_at: new Date().toISOString(),
        ip_address: typeof ip === 'string' ? ip : null,
      },
      { onConflict: 'asamblea_id,identificador' }
    )

    if (error) {
      console.error('POST consentimiento upsert:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/votar/consentimiento:', e)
    return NextResponse.json({ error: 'Error al registrar consentimiento' }, { status: 500 })
  }
}
