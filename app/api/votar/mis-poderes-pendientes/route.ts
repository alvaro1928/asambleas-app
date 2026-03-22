import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { identificadorCoincide } from '@/lib/votar-identificador'

/**
 * POST /api/votar/mis-poderes-pendientes
 * Poderes en pendiente_verificacion declarados por este identificador en la asamblea del código.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { codigo, identificador } = body as { codigo?: string; identificador?: string }

    if (!codigo?.trim() || !identificador?.trim()) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: codigoData, error: codigoError } = await admin.rpc('validar_codigo_acceso', {
      p_codigo: codigo.trim(),
    })
    if (codigoError || !codigoData || codigoData.length === 0 || !codigoData[0].acceso_valido) {
      return NextResponse.json({ error: 'Código de acceso inválido o cerrado' }, { status: 403 })
    }

    const asambleaId = codigoData[0].asamblea_id as string
    const ident = identificador.trim()

    const { data: rows, error } = await admin
      .from('vista_poderes_completa')
      .select(
        'id, unidad_otorgante_id, unidad_otorgante_numero, unidad_otorgante_torre, nombre_otorgante, email_otorgante, email_receptor, nombre_receptor, estado, archivo_poder, observaciones, created_at, coeficiente_delegado'
      )
      .eq('asamblea_id', asambleaId)
      .eq('estado', 'pendiente_verificacion')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'No se pudieron cargar los poderes' }, { status: 500 })
    }

    const filtrados = (rows ?? []).filter((r) =>
      identificadorCoincide((r as { email_receptor?: string }).email_receptor, ident)
    )

    return NextResponse.json({ poderes: filtrados })
  } catch (e) {
    console.error('[api/votar/mis-poderes-pendientes]', e)
    return NextResponse.json({ error: 'Error al cargar poderes' }, { status: 500 })
  }
}
