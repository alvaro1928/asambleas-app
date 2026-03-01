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
 * Para cada unidad:
 *  - Si ya tiene fila en quorum_asamblea → actualiza verifico_asistencia = true
 *  - Si no tiene fila → inserta una nueva marcándola como presente_fisica = true y verificada
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

    if (!asamblea_id || !Array.isArray(unidad_ids) || unidad_ids.length === 0) {
      return NextResponse.json({ error: 'Faltan asamblea_id o unidad_ids' }, { status: 400 })
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

    // Verificar que la asamblea pertenece a la organización del usuario
    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', session.user.id)
      .single()

    const { data: asamblea } = await admin
      .from('asambleas')
      .select('id, organization_id')
      .eq('id', asamblea_id)
      .single()

    if (!asamblea || (profile?.organization_id && asamblea.organization_id !== profile.organization_id)) {
      return NextResponse.json({ error: 'Asamblea no encontrada o sin permiso' }, { status: 403 })
    }

    // Obtener datos de las unidades (email, nombre) para el upsert
    const { data: unidades } = await admin
      .from('unidades')
      .select('id, email_propietario, email, nombre_propietario')
      .in('id', unidad_ids)

    const now = new Date().toISOString()
    let registradas = 0
    let errores = 0

    for (const unidad_id of unidad_ids) {
      const unidad = (unidades || []).find((u: any) => u.id === unidad_id)
      const emailProp = unidad?.email_propietario || unidad?.email || 'registro.manual@sistema'
      const nombreProp = unidad?.nombre_propietario || null

      const { error } = await admin
        .from('quorum_asamblea')
        .upsert(
          {
            asamblea_id,
            unidad_id,
            email_propietario: emailProp,
            nombre_propietario: nombreProp,
            presente_fisica: true,
            presente_virtual: false,
            verifico_asistencia: true,
            hora_verificacion: now,
            hora_llegada: now,
            ultima_actividad: now,
          },
          {
            onConflict: 'asamblea_id,unidad_id',
            ignoreDuplicates: false,
          }
        )

      if (error) {
        // Si el upsert falla (ej. columna no existe aún), intentar solo update
        const { error: updateErr } = await admin
          .from('quorum_asamblea')
          .update({ verifico_asistencia: true, hora_verificacion: now })
          .eq('asamblea_id', asamblea_id)
          .eq('unidad_id', unidad_id)

        if (updateErr) errores++
        else registradas++
      } else {
        registradas++
      }
    }

    return NextResponse.json({ ok: true, registradas, errores })
  } catch (e) {
    console.error('registrar-asistencia-manual:', e)
    return NextResponse.json({ error: 'Error al registrar asistencia' }, { status: 500 })
  }
}
