import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  identificadorCoincide,
  unidadesPropiasParaIdentificador,
  type UnidadVotarRow,
} from '@/lib/votar-identificador'
import { emailContactoUnidad, extensionDocPoder, esDocumentoPoderValido } from '@/lib/poderes-registro'
import { normDoc, normPhone } from '@/lib/votar-identificador'

/**
 * POST /api/votar/registrar-poder-pendiente (multipart/form-data)
 * Registra un poder en estado pendiente_verificacion para verificación del gestor.
 *
 * Campos: codigo, identificador, unidad_otorgante_id, nombre_receptor (opcional), observaciones (opcional), archivo (opcional)
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const codigo = String(form.get('codigo') ?? '').trim()
    const identificador = String(form.get('identificador') ?? '').trim()
    const unidadOtorganteId = String(form.get('unidad_otorgante_id') ?? '').trim()
    const nombreReceptor = String(form.get('nombre_receptor') ?? '').trim()
    const observaciones = String(form.get('observaciones') ?? '').trim()
    const registroExterno =
      String(form.get('registro_externo') ?? '').toLowerCase() === 'true' ||
      String(form.get('registro_externo') ?? '') === '1'
    const rawArchivo = form.get('archivo')

    if (!codigo || !identificador || !unidadOtorganteId) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: codigoData, error: codigoError } = await admin.rpc('validar_codigo_registro_poderes', {
      p_codigo: codigo,
    })
    if (codigoError || !codigoData || codigoData.length === 0 || !codigoData[0].acceso_valido) {
      return NextResponse.json({ error: 'Código de acceso inválido o cerrado' }, { status: 403 })
    }

    const asambleaId = codigoData[0].asamblea_id as string
    const organizationId = codigoData[0].organization_id as string
    const ident = identificador.trim()

    const { data: unidadesRows, error: unidadesErr } = await admin
      .from('unidades')
      .select('id, torre, numero, coeficiente, nombre_propietario, email, email_propietario, telefono, telefono_propietario')
      .eq('organization_id', organizationId)

    if (unidadesErr) {
      return NextResponse.json({ error: 'Error consultando unidades' }, { status: 500 })
    }

    const lista = (unidadesRows ?? []) as UnidadVotarRow[]
    const propias = unidadesPropiasParaIdentificador(lista, ident)
    const propiasIds = new Set(propias.map((u) => u.id))

    if (!registroExterno) {
      if (propias.length === 0) {
        const { data: poderesActivosReceptor, error: paErr } = await admin
          .from('poderes')
          .select('id, email_receptor')
          .eq('asamblea_id', asambleaId)
          .eq('estado', 'activo')
        if (paErr) {
          return NextResponse.json({ error: 'Error validando tu sesión de votación' }, { status: 500 })
        }
        const coincideComoApoderado = (poderesActivosReceptor ?? []).some((p) =>
          identificadorCoincide(p.email_receptor, ident)
        )
        if (!coincideComoApoderado) {
          return NextResponse.json(
            {
              error:
                'Tu identificador no está asociado a una unidad ni a un poder vigente; no puedes declarar poderes recibidos.',
            },
            { status: 403 }
          )
        }
      }
    } else {
      if (nombreReceptor.length < 2) {
        return NextResponse.json(
          { error: 'Indica tu nombre completo como apoderado (campo nombre del receptor).' },
          { status: 400 }
        )
      }
      const tel = normPhone(ident)
      const doc = normDoc(ident)
      if (tel.length < 7 && doc.length < 4) {
        return NextResponse.json(
          {
            error:
              'Como apoderado externo debes indicar un celular válido (mín. 7 dígitos) o un documento (cédula) con al menos 4 caracteres.',
          },
          { status: 400 }
        )
      }
    }

    if (propiasIds.has(unidadOtorganteId)) {
      return NextResponse.json(
        { error: 'No puedes registrar un poder «recibido» desde una unidad que te pertenece. Elige el apartamento que te delegó el voto.' },
        { status: 400 }
      )
    }

    const uOt = lista.find((u) => u.id === unidadOtorganteId)
    if (!uOt) {
      return NextResponse.json({ error: 'La unidad indicada no existe en este conjunto' }, { status: 400 })
    }

    const emailOtorgante = emailContactoUnidad(uOt)
    const nombreOtorgante = String(uOt.nombre_propietario ?? '').trim() || '—'

    const { data: existentes, error: exErr } = await admin
      .from('poderes')
      .select('id, estado, email_receptor')
      .eq('asamblea_id', asambleaId)
      .eq('unidad_otorgante_id', unidadOtorganteId)
      .in('estado', ['activo', 'pendiente_verificacion'])

    if (exErr) {
      return NextResponse.json({ error: 'No se pudo comprobar delegaciones existentes' }, { status: 500 })
    }

    for (const row of existentes ?? []) {
      if (identificadorCoincide(row.email_receptor, ident)) {
        return NextResponse.json(
          {
            error:
              row.estado === 'activo'
                ? 'Ya tienes un poder activo desde esa unidad en esta asamblea.'
                : 'Ya registraste una solicitud pendiente desde esa unidad; espera la verificación del administrador.',
          },
          { status: 409 }
        )
      }
    }

    const unidadReceptorId = propias.length > 0 ? propias[0].id : null
    const nombreRecFinal =
      nombreReceptor.trim() ||
      (propias.length > 0 ? String(propias[0]?.nombre_propietario ?? '').trim() : '') ||
      null

    let archivoPoder: string | null = null
    let insertedId: string | null = null

    const { data: inserted, error: insErr } = await admin
      .from('poderes')
      .insert({
        asamblea_id: asambleaId,
        unidad_otorgante_id: unidadOtorganteId,
        unidad_receptor_id: unidadReceptorId,
        email_otorgante: emailOtorgante || '—',
        nombre_otorgante: nombreOtorgante,
        email_receptor: ident,
        nombre_receptor: nombreRecFinal,
        estado: 'pendiente_verificacion',
        observaciones: observaciones || null,
        archivo_poder: null,
      })
      .select('id')
      .single()

    if (insErr) {
      console.error('[registrar-poder-pendiente] insert', insErr)
      const m = String(insErr.message ?? '').toLowerCase()
      if (insErr.code === '23505' || m.includes('duplicate') || m.includes('unique')) {
        return NextResponse.json(
          {
            error:
              'Ya existe una delegación activa o pendiente desde esa unidad hacia tu identificador. Si el administrador ya registró el poder, no hace falta repetir.',
          },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'No se pudo registrar la solicitud' }, { status: 500 })
    }

    insertedId = inserted?.id as string

    if (rawArchivo instanceof File && rawArchivo.size > 0) {
      if (!esDocumentoPoderValido(rawArchivo)) {
        await admin.from('poderes').delete().eq('id', insertedId)
        return NextResponse.json(
          { error: 'El documento debe ser PDF o Word (.doc, .docx) y máximo 2 MB.' },
          { status: 400 }
        )
      }
      const ext = extensionDocPoder(rawArchivo)
      const path = `${asambleaId}/${insertedId}/doc${ext}`
      const { error: upErr } = await admin.storage.from('poderes-docs').upload(path, rawArchivo, { upsert: true })
      if (!upErr) {
        const { data: urlData } = admin.storage.from('poderes-docs').getPublicUrl(path)
        archivoPoder = urlData.publicUrl
        await admin.from('poderes').update({ archivo_poder: archivoPoder }).eq('id', insertedId)
      }
    }

    return NextResponse.json({
      ok: true,
      id: insertedId,
      mensaje:
        'Solicitud registrada. El poder no estará activo para votar hasta que un administrador lo verifique en la tabla de poderes.',
    })
  } catch (e) {
    console.error('[api/votar/registrar-poder-pendiente]', e)
    return NextResponse.json({ error: 'Error al registrar la solicitud' }, { status: 500 })
  }
}
