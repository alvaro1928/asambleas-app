import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/votar/unidades-delegacion
 * Lista unidades del censo (torre/número/id) para elegir «quién otorga» al declarar un poder pendiente.
 * Requiere código de acceso válido.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { codigo } = body as { codigo?: string }

    if (!codigo?.trim()) {
      return NextResponse.json({ error: 'Código requerido' }, { status: 400 })
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

    const organizationId = codigoData[0].organization_id as string

    const { data: rows, error } = await admin
      .from('unidades')
      .select('id, torre, numero, coeficiente, nombre_propietario')
      .eq('organization_id', organizationId)
      .order('torre', { ascending: true })
      .order('numero', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'No se pudieron cargar las unidades' }, { status: 500 })
    }

    return NextResponse.json({
      unidades: (rows ?? []).map((u) => ({
        id: u.id as string,
        torre: String(u.torre ?? ''),
        numero: String(u.numero ?? ''),
        coeficiente: Number(u.coeficiente) || 0,
        nombre_propietario: u.nombre_propietario ? String(u.nombre_propietario) : null,
      })),
    })
  } catch (e) {
    console.error('[api/votar/unidades-delegacion]', e)
    return NextResponse.json({ error: 'Error al cargar unidades' }, { status: 500 })
  }
}
