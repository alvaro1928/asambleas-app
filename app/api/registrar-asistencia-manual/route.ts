import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/registrar-asistencia-manual
 * El administrador registra la asistencia de una o varias unidades
 * directamente desde el Centro de Control.
 * Body: { asamblea_id: string, unidad_ids: string[] }
 *
 * Seguridad:
 *  - Requiere sesión activa de admin (cookies).
 *  - Verifica que la asamblea pertenece a la organización del admin.
 *  - Verifica que cada unidad_id pertenece también a la misma organización
 *    (evita que un admin registre asistencia en asambleas/unidades ajenas).
 *  - Usa bulk upsert (un solo query) para eficiencia.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set() {},
          remove() {},
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { asamblea_id, unidad_ids } = body as { asamblea_id?: string; unidad_ids?: string[] }

    if (
      !asamblea_id ||
      typeof asamblea_id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(asamblea_id.trim()) ||
      !Array.isArray(unidad_ids) ||
      unidad_ids.length === 0 ||
      unidad_ids.length > 500 // límite razonable por petición
    ) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    // Validar que todos los unidad_ids son UUIDs válidos
    const validUUIDs = /^[0-9a-f-]{36}$/i
    if (unidad_ids.some((id) => typeof id !== 'string' || !validUUIDs.test(id))) {
      return NextResponse.json({ error: 'unidad_ids contiene valores inválidos' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración interna incompleta' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // Obtener organización del admin
    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', session.user.id)
      .single()

    // Obtener organización y contexto de verificación de la asamblea
    const { data: asamblea } = await admin
      .from('asambleas')
      .select('id, organization_id, verificacion_pregunta_id')
      .eq('id', asamblea_id.trim())
      .single()

    if (!asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    // Un super admin (sin organization_id) puede actuar en cualquier asamblea;
    // un admin normal solo puede actuar en su propia organización.
    if (profile?.organization_id && asamblea.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Sin permiso para esta asamblea' }, { status: 403 })
    }

    const orgId = asamblea.organization_id
    const preguntaId = (asamblea as { verificacion_pregunta_id?: string | null }).verificacion_pregunta_id ?? null

    // Obtener datos de las unidades Y validar que pertenecen a la misma organización.
    // Esto previene que un admin registre unidades de otro conjunto.
    const { data: unidades, error: unidadesErr } = await admin
      .from('unidades')
      .select('id, email_propietario, email, nombre_propietario')
      .in('id', unidad_ids)
      .eq('organization_id', orgId)

    if (unidadesErr) {
      return NextResponse.json({ error: 'Error al verificar unidades' }, { status: 500 })
    }

    // Solo procesar las unidades que efectivamente pertenecen a la organización
    const unidadesValidadas = unidades || []
    if (unidadesValidadas.length === 0) {
      return NextResponse.json({ error: 'Ninguna unidad válida para esta asamblea' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Bulk upsert — un solo query en lugar de N queries individuales
    const rows = unidadesValidadas.map((u: any) => ({
      asamblea_id: asamblea_id.trim(),
      unidad_id: u.id,
      email_propietario: u.email_propietario || u.email || 'registro.manual@sistema',
      nombre_propietario: u.nombre_propietario || null,
      presente_fisica: true,
      presente_virtual: false,
      verifico_asistencia: true,
      hora_verificacion: now,
      hora_llegada: now,
      ultima_actividad: now,
    }))

    const { error: upsertErr } = await admin
      .from('quorum_asamblea')
      .upsert(rows, { onConflict: 'asamblea_id,unidad_id', ignoreDuplicates: false })

    if (upsertErr) {
      const { error: updateErr } = await admin
        .from('quorum_asamblea')
        .update({ verifico_asistencia: true, hora_verificacion: now })
        .eq('asamblea_id', asamblea_id.trim())
        .in('unidad_id', unidadesValidadas.map((u: any) => u.id))

      if (updateErr) {
        console.error('registrar-asistencia-manual fallback update:', updateErr)
        return NextResponse.json({ error: 'Error al guardar asistencia' }, { status: 500 })
      }
    }

    const unidadIds = unidadesValidadas.map((u: any) => u.id)
    const { data: quorumRows } = await admin
      .from('quorum_asamblea')
      .select('id')
      .eq('asamblea_id', asamblea_id.trim())
      .in('unidad_id', unidadIds)

    if (quorumRows?.length) {
      const registros = quorumRows.map((r: { id: string }) => ({
        asamblea_id: asamblea_id.trim(),
        quorum_asamblea_id: r.id,
        pregunta_id: preguntaId,
        creado_en: now,
      }))
      await admin
        .from('verificacion_asistencia_registro')
        .upsert(registros, { onConflict: 'quorum_asamblea_id,pregunta_id', ignoreDuplicates: false })
    }

    return NextResponse.json({
      ok: true,
      registradas: unidadesValidadas.length,
      ignoradas: unidad_ids.length - unidadesValidadas.length,
    })
  } catch (e) {
    console.error('registrar-asistencia-manual:', e)
    return NextResponse.json({ error: 'Error al registrar asistencia' }, { status: 500 })
  }
}
