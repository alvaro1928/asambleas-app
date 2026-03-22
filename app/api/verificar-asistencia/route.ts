import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/verificar-asistencia
 * El votante confirma su asistencia cuando el administrador activa
 * la verificación de quórum. Actualiza quorum_asamblea.verifico_asistencia = true.
 * Body: { asamblea_id: string, email: string }
 *
 * Sin sesión requerida (votantes acceden via código público), pero:
 *  - El asamblea_id debe ser UUID válido y la verificación debe estar activa.
 *  - El email debe existir ya en quorum_asamblea para esa asamblea (creado al validar el votante).
 *  - Si el email no está registrado la operación afecta 0 filas → 404 al cliente.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { asamblea_id, email } = body as { asamblea_id?: string; email?: string }

    // Validación básica de inputs
    if (
      !asamblea_id ||
      !email ||
      typeof asamblea_id !== 'string' ||
      typeof email !== 'string' ||
      !email.trim() ||
      // Validación básica de formato UUID (evita inyecciones a nivel de query)
      !/^[0-9a-f-]{36}$/i.test(asamblea_id.trim())
    ) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
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

    // Verificar que la asamblea existe y tiene la verificación activa
    const { data: asamblea, error: fetchErr } = await admin
      .from('asambleas')
      .select('id, verificacion_asistencia_activa')
      .eq('id', asamblea_id.trim())
      .single()

    if (fetchErr || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    if (!asamblea.verificacion_asistencia_activa) {
      return NextResponse.json(
        { error: 'La verificación de asistencia no está activa en este momento' },
        { status: 409 }
      )
    }

    /** Solo sesión general (misma fila que pregunta_id IS NULL en registro). */
    const preguntaId: string | null = null

    // Obtener los quorum_asamblea.id donde este email puede verificar (incl. múltiples correos y poder a terceros)
    let idRows: { quorum_id: string }[] | null = null
    let fetchFilasErr: unknown = null
    ;({ data: idRows, error: fetchFilasErr } = await admin.rpc('quorum_ids_para_verificar_asistencia', {
      p_asamblea_id: asamblea_id.trim(),
      p_email: email.trim(),
    }))

    if (fetchFilasErr) {
      console.error('verificar-asistencia fetch filas:', fetchFilasErr)
      return NextResponse.json({ error: 'Error al buscar registro' }, { status: 500 })
    }

    const normalizarTelefono = (v: string) => v.replace(/\D/g, '')
    const normalizarDoc = (v: string) => v.replace(/[^a-z0-9]/gi, '').toLowerCase()
    const identificadorCoincide = (storedRaw: string | null | undefined, identRaw: string): boolean => {
      if (!storedRaw) return false
      const a = storedRaw.trim().toLowerCase()
      const b = identRaw.trim().toLowerCase()
      if (!a || !b) return false
      if (a === b) return true
      const telA = normalizarTelefono(a)
      const telB = normalizarTelefono(b)
      if (telA && telB && telA === telB) return true
      const docA = normalizarDoc(a)
      const docB = normalizarDoc(b)
      return !!docA && !!docB && docA === docB
    }

    let filas = (idRows ?? []).map((r) => ({ id: r.quorum_id }))
    if (filas.length === 0 && email.trim().includes('@')) {
      try {
        await admin.rpc('asegurar_quorum_para_identificador', {
          p_asamblea_id: asamblea_id.trim(),
          p_email: email.trim(),
        })
        const { data: idRowsRetry } = await admin.rpc('quorum_ids_para_verificar_asistencia', {
          p_asamblea_id: asamblea_id.trim(),
          p_email: email.trim(),
        })
        filas = (idRowsRetry ?? []).map((r: { quorum_id: string }) => ({ id: r.quorum_id }))
      } catch {
        // Si asegurar_quorum_para_identificador no existe o falla, se mantiene filas.length === 0
      }
    }
    if (filas.length === 0 && !email.trim().includes('@')) {
      const { data: poderesRows } = await admin
        .from('poderes')
        .select('unidad_otorgante_id, email_receptor')
        .eq('asamblea_id', asamblea_id.trim())
        .eq('estado', 'activo')

      const unidadesPoder = (poderesRows ?? [])
        .filter((p) => identificadorCoincide(p.email_receptor, email.trim()))
        .map((p) => p.unidad_otorgante_id)
        .filter(Boolean) as string[]

      if (unidadesPoder.length > 0) {
        // Si no existen filas de quorum para esas unidades, crearlas para permitir verificación inmediata.
        const { data: filasQuorum } = await admin
          .from('quorum_asamblea')
          .select('id, unidad_id')
          .eq('asamblea_id', asamblea_id.trim())
          .in('unidad_id', unidadesPoder)

        const unidadesConFila = new Set((filasQuorum ?? []).map((f) => f.unidad_id))
        const unidadesSinFila = unidadesPoder.filter((uid) => !unidadesConFila.has(uid))
        if (unidadesSinFila.length > 0) {
          await admin
            .from('quorum_asamblea')
            .insert(
              unidadesSinFila.map((uid) => ({
                asamblea_id: asamblea_id.trim(),
                unidad_id: uid,
                email_propietario: email.trim(),
                presente_virtual: true,
              }))
            )
        }

        const { data: filasRetry } = await admin
          .from('quorum_asamblea')
          .select('id')
          .eq('asamblea_id', asamblea_id.trim())
          .in('unidad_id', unidadesPoder)
        filas = (filasRetry ?? []).map((r) => ({ id: r.id }))
      }
    }
    if (filas.length === 0) {
      return NextResponse.json(
        { error: 'No se encontró tu registro en esta asamblea. Intenta salir y volver a entrar.' },
        { status: 404 }
      )
    }

    const MAX_FILAS_VERIFICACION = 100
    if (filas.length > MAX_FILAS_VERIFICACION) {
      return NextResponse.json(
        { error: 'Demasiados registros asociados a este identificador. Contacta al administrador.' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Un solo upsert en bloque (evita N round-trips y posibles timeouts con varios poderes / filas).
    const registros = filas.map((row) => ({
      asamblea_id: asamblea_id.trim(),
      quorum_asamblea_id: row.id,
      pregunta_id: preguntaId,
      creado_en: now,
    }))
    const { error: upsertRegErr } = await admin
      .from('verificacion_asistencia_registro')
      .upsert(registros, {
        onConflict: 'quorum_asamblea_id,pregunta_id',
        ignoreDuplicates: false,
      })
    if (upsertRegErr) {
      console.error('verificar-asistencia upsert registros:', upsertRegErr)
      return NextResponse.json({ error: 'Error al registrar verificación' }, { status: 500 })
    }

    const insertadas = filas.length

    // Mantener quorum_asamblea.verifico_asistencia/hora para compatibilidad (cualquier verificación = presente)
    const ids = filas.map((f) => f.id)
    await admin
      .from('quorum_asamblea')
      .update({ verifico_asistencia: true, hora_verificacion: now })
      .in('id', ids)

    return NextResponse.json({ ok: true, filas_actualizadas: insertadas })
  } catch (e) {
    console.error('verificar-asistencia:', e)
    return NextResponse.json({ error: 'Error al registrar verificación' }, { status: 500 })
  }
}
