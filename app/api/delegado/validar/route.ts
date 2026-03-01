import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/delegado/validar
 * Valida que { codigo_asamblea, token } sean correctos.
 * Devuelve información básica de la asamblea para que la página
 * del delegado pueda renderizarse.
 *
 * No requiere sesión (endpoint público, protegido por el token UUID).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { codigo_asamblea, token } = body as { codigo_asamblea?: string; token?: string }

    if (
      !codigo_asamblea || !token ||
      typeof codigo_asamblea !== 'string' ||
      typeof token !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(token.trim())
    ) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return NextResponse.json({ error: 'Config interna incompleta' }, { status: 500 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const { data: asamblea } = await admin
      .from('asambleas')
      .select('id, nombre, fecha, estado, organization_id, is_demo, sandbox_usar_unidades_reales, token_delegado, codigo_acceso')
      .eq('codigo_acceso', codigo_asamblea.trim().toUpperCase())
      .single()

    if (!asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    if (!asamblea.token_delegado) {
      return NextResponse.json({ error: 'El acceso de asistente no está activo para esta asamblea' }, { status: 403 })
    }

    if (asamblea.token_delegado !== token.trim()) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 403 })
    }

    if (asamblea.estado === 'finalizada') {
      return NextResponse.json({ error: 'Esta asamblea ya fue finalizada' }, { status: 409 })
    }

    // Obtener nombre del conjunto
    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', asamblea.organization_id)
      .single()

    return NextResponse.json({
      ok: true,
      asamblea_id: asamblea.id,
      nombre: asamblea.nombre,
      fecha: asamblea.fecha,
      estado: asamblea.estado,
      organization_id: asamblea.organization_id,
      nombre_conjunto: org?.name || '',
      is_demo: !!asamblea.is_demo,
      sandbox_usar_unidades_reales: !!asamblea.sandbox_usar_unidades_reales,
    })
  } catch (e) {
    console.error('delegado/validar:', e)
    return NextResponse.json({ error: 'Error al validar acceso' }, { status: 500 })
  }
}
