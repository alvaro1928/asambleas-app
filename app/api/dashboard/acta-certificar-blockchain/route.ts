import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const OTS_CALENDAR = 'https://alice.btc.calendar.opentimestamps.org'

/**
 * POST /api/dashboard/acta-certificar-blockchain
 * Si la configuración global acta_blockchain_ots_enabled está activa,
 * construye un contenido canónico del acta, lo hashea, lo sella con OpenTimestamps
 * y guarda la prueba .ots en asambleas.acta_ots_proof_base64.
 * Si está desactivado, responde { ok: true, skipped: true }.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { asamblea_id, pdf_sha256_hex } = body as { asamblea_id?: string; pdf_sha256_hex?: string }
    if (!asamblea_id) {
      return NextResponse.json({ error: 'Falta asamblea_id' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // 1. ¿Está activada la certificación blockchain?
    const { data: configRow } = await admin
      .from('configuracion_global')
      .select('acta_blockchain_ots_enabled')
      .eq('key', 'landing')
      .maybeSingle()

    const otsEnabled = configRow?.acta_blockchain_ots_enabled === true
    if (!otsEnabled) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    // 2. Cargar asamblea y organización
    const { data: asamblea, error: errAsam } = await admin
      .from('asambleas')
      .select('id, nombre, fecha, estado, organization_id')
      .eq('id', asamblea_id)
      .single()

    if (errAsam || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', asamblea.organization_id)
      .single()

    // 3. Quórum
    const { data: quorumRows } = await admin.rpc('calcular_quorum_asamblea', {
      p_asamblea_id: asamblea_id,
    })
    const quorum = quorumRows?.[0] ?? null

    // 4. Preguntas (no archivadas) con opciones
    const { data: preguntasData } = await admin
      .from('preguntas')
      .select('id, texto_pregunta, tipo_votacion, umbral_aprobacion, orden')
      .eq('asamblea_id', asamblea_id)
      .eq('is_archived', false)
      .order('orden', { ascending: true })

    const preguntasConResultados: Array<{
      id: string
      texto_pregunta: string
      tipo_votacion: string
      umbral_aprobacion: number | null
      orden: number
      resultados: unknown[]
    }> = []

    for (const p of preguntasData || []) {
      const { data: statsData } = await admin.rpc('calcular_estadisticas_pregunta', {
        p_pregunta_id: p.id,
      })
      const resultados = (statsData ?? []).map((r: unknown) => r)
      preguntasConResultados.push({
        id: p.id,
        texto_pregunta: p.texto_pregunta ?? '',
        tipo_votacion: p.tipo_votacion ?? 'coeficiente',
        umbral_aprobacion: p.umbral_aprobacion ?? null,
        orden: p.orden ?? 0,
        resultados,
      })
    }

    // Hash a sellar: si viene el hash del PDF (64 hex) lo usamos para que opentimestamps.org valide el PDF; si no, usamos contenido canónico (legacy).
    let digest: Buffer
    if (typeof pdf_sha256_hex === 'string' && /^[a-fA-F0-9]{64}$/.test(pdf_sha256_hex)) {
      digest = Buffer.from(pdf_sha256_hex, 'hex')
      if (digest.length !== 32) {
        return NextResponse.json({ error: 'Hash del PDF inválido' }, { status: 400 })
      }
    } else {
      const canonical = JSON.stringify({
        asamblea: {
          id: asamblea.id,
          nombre: asamblea.nombre ?? '',
          fecha: asamblea.fecha ?? '',
          estado: asamblea.estado ?? '',
          organization_id: asamblea.organization_id ?? '',
        },
        organization_name: (org as { name?: string } | null)?.name ?? '',
        quorum: quorum
          ? {
              total_unidades: (quorum as { total_unidades?: number }).total_unidades ?? 0,
              unidades_votantes: (quorum as { unidades_votantes?: number }).unidades_votantes ?? 0,
              coeficiente_votante: (quorum as { coeficiente_votante?: number }).coeficiente_votante ?? 0,
              quorum_alcanzado: (quorum as { quorum_alcanzado?: boolean }).quorum_alcanzado ?? false,
            }
          : null,
        preguntas: preguntasConResultados,
      })
      digest = crypto.createHash('sha256').update(canonical, 'utf8').digest()
    }

    // OpenTimestamps: sello con calendar público (puede fallar por red o calendario no disponible)
    let otsBase64: string
    try {
      const OpenTimestamps = require('opentimestamps')
      const detached = OpenTimestamps.DetachedTimestampFile.fromHash(
        new OpenTimestamps.Ops.OpSHA256(),
        Array.from(digest)
      )

      await OpenTimestamps.stamp([detached], {
        calendars: [OTS_CALENDAR],
        m: 1,
      })

      const otsBytes = detached.serializeToBytes()
      otsBase64 = Buffer.from(otsBytes).toString('base64')
    } catch (otsErr) {
      const msg = otsErr instanceof Error ? otsErr.message : String(otsErr)
      console.error('acta-certificar-blockchain OpenTimestamps:', otsErr)
      return NextResponse.json(
        {
          error:
            'El servidor de OpenTimestamps no pudo sellar el acta. Suele ser por red o calendario temporalmente no disponible. Intenta finalizar de nuevo en unos minutos.',
          detail: msg,
        },
        { status: 500 }
      )
    }

    const { error: updateErr } = await admin
      .from('asambleas')
      .update({
        acta_ots_proof_base64: otsBase64,
        updated_at: new Date().toISOString(),
      })
      .eq('id', asamblea_id)

    if (updateErr) {
      console.error('acta-certificar-blockchain update:', updateErr)
      return NextResponse.json(
        { error: 'No se pudo guardar el certificado en la base de datos. ¿Ejecutaste la migración ADD-ACTA-BLOCKCHAIN-OTS.sql?' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, ots_base64: otsBase64 })
  } catch (e) {
    console.error('acta-certificar-blockchain:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al certificar el acta con blockchain' },
      { status: 500 }
    )
  }
}
