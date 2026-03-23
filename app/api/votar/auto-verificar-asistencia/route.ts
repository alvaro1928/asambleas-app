import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type ReqBody = {
  asamblea_id?: string
  identificador?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ReqBody
    const asambleaId = String(body.asamblea_id || '').trim()
    const identificador = String(body.identificador || '').trim()

    if (!asambleaId || !identificador || !/^[0-9a-f-]{36}$/i.test(asambleaId)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Configuración interna incompleta' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const { data: asamblea, error: asambleaErr } = await admin
      .from('asambleas')
      .select('id, verificacion_asistencia_activa')
      .eq('id', asambleaId)
      .single()
    if (asambleaErr || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    let marcaEn = new Date().toISOString()
    let origen: 'activa' | 'ultima_cerrada' | 'sin_sesion' = 'activa'

    if (!asamblea.verificacion_asistencia_activa) {
      const { data: ultimaSesion } = await admin
        .from('verificacion_asamblea_sesiones')
        .select('cierre_at')
        .eq('asamblea_id', asambleaId)
        .is('pregunta_id', null)
        .not('cierre_at', 'is', null)
        .order('cierre_at', { ascending: false })
        .limit(1)
      const cierreAt = ultimaSesion?.[0]?.cierre_at
      if (cierreAt) {
        marcaEn = cierreAt
        origen = 'ultima_cerrada'
      } else {
        origen = 'sin_sesion'
      }
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

    let filas: Array<{ id: string }> = []
    const { data: idRows, error: idRowsErr } = await admin.rpc('quorum_ids_para_verificar_asistencia', {
      p_asamblea_id: asambleaId,
      p_email: identificador,
    })
    if (idRowsErr) {
      console.error('[auto-verificar-asistencia] rpc quorum ids:', idRowsErr)
      return NextResponse.json({ error: 'Error buscando registros de asistencia' }, { status: 500 })
    }
    filas = (idRows ?? []).map((r: { quorum_id: string }) => ({ id: r.quorum_id }))

    if (filas.length === 0) {
      const { data: poderesRows } = await admin
        .from('poderes')
        .select('unidad_otorgante_id, email_receptor')
        .eq('asamblea_id', asambleaId)
        .eq('estado', 'activo')

      const unidadesPoder = (poderesRows ?? [])
        .filter((p) => identificadorCoincide(p.email_receptor, identificador))
        .map((p) => p.unidad_otorgante_id)
        .filter(Boolean) as string[]

      if (unidadesPoder.length > 0) {
        const { data: filasQuorum } = await admin
          .from('quorum_asamblea')
          .select('id, unidad_id')
          .eq('asamblea_id', asambleaId)
          .in('unidad_id', unidadesPoder)

        const unidadesConFila = new Set((filasQuorum ?? []).map((f) => f.unidad_id))
        const unidadesSinFila = unidadesPoder.filter((uid) => !unidadesConFila.has(uid))
        if (unidadesSinFila.length > 0) {
          await admin
            .from('quorum_asamblea')
            .insert(
              unidadesSinFila.map((uid) => ({
                asamblea_id: asambleaId,
                unidad_id: uid,
                email_propietario: identificador,
                presente_virtual: true,
              }))
            )
        }

        const { data: filasRetry } = await admin
          .from('quorum_asamblea')
          .select('id')
          .eq('asamblea_id', asambleaId)
          .in('unidad_id', unidadesPoder)
        filas = (filasRetry ?? []).map((r) => ({ id: r.id }))
      }
    }

    if (filas.length === 0) {
      return NextResponse.json({ ok: true, filas_actualizadas: 0, origen, marca_en: marcaEn })
    }

    const preguntaId: string | null = null
    const registros = filas.map((row) => ({
      asamblea_id: asambleaId,
      quorum_asamblea_id: row.id,
      pregunta_id: preguntaId,
      creado_en: marcaEn,
    }))
    const { error: upsertRegErr } = await admin
      .from('verificacion_asistencia_registro')
      .upsert(registros, {
        onConflict: 'quorum_asamblea_id,pregunta_id',
        ignoreDuplicates: false,
      })
    if (upsertRegErr) {
      console.error('[auto-verificar-asistencia] upsert registros:', upsertRegErr)
      return NextResponse.json({ error: 'Error al registrar verificación' }, { status: 500 })
    }

    const ids = filas.map((f) => f.id)
    await admin
      .from('quorum_asamblea')
      .update({ verifico_asistencia: true, hora_verificacion: marcaEn })
      .in('id', ids)

    return NextResponse.json({
      ok: true,
      filas_actualizadas: filas.length,
      origen,
      marca_en: marcaEn,
    })
  } catch (e) {
    console.error('POST /api/votar/auto-verificar-asistencia:', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
