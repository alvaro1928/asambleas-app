import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  identificadorCoincide,
  unidadesPropiasParaIdentificador,
  type UnidadVotarRow,
} from '@/lib/votar-identificador'
import { shouldUseDemoUnits } from '@/lib/demo-sandbox'

/**
 * POST /api/votar/validar-identificador
 * Valida acceso de votante por email, telefono o identificacion
 * incluyendo poderes activos a terceros.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { codigo, identificador } = body as { codigo?: string; identificador?: string }

    if (!codigo || !identificador || !codigo.trim() || !identificador.trim()) {
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
    const organizationId = codigoData[0].organization_id as string
    const ident = identificador.trim()

    const { data: asambleaFlags, error: asambleaFlagsErr } = await admin
      .from('asambleas')
      .select('is_demo, sandbox_usar_unidades_reales')
      .eq('id', asambleaId)
      .maybeSingle()
    if (asambleaFlagsErr || !asambleaFlags) {
      return NextResponse.json({ error: 'Error consultando configuración de asamblea' }, { status: 500 })
    }

    const isDemo = (asambleaFlags as { is_demo?: boolean }).is_demo === true
    const sandboxUsarReales = (asambleaFlags as { sandbox_usar_unidades_reales?: boolean }).sandbox_usar_unidades_reales === true
    const unidadesDemoObjetivo = shouldUseDemoUnits(isDemo, sandboxUsarReales)

    const { data: unidadesRows, error: unidadesErr } = await admin
      .from('unidades')
      .select('id, torre, numero, coeficiente, nombre_propietario, email, email_propietario, telefono, telefono_propietario, is_demo')
      .eq('organization_id', organizationId)
      .eq('is_demo', unidadesDemoObjetivo)
    if (unidadesErr) {
      return NextResponse.json({ error: 'Error consultando unidades' }, { status: 500 })
    }

    const unidadesPropias = unidadesPropiasParaIdentificador((unidadesRows ?? []) as UnidadVotarRow[], ident)
    const unidadesElegiblesSet = new Set((unidadesRows ?? []).map((u) => String((u as { id: string }).id)))

    const { data: poderesRows, error: poderesErr } = await admin
      .from('poderes')
      .select('unidad_otorgante_id, email_receptor')
      .eq('asamblea_id', asambleaId)
      .eq('estado', 'activo')
    if (poderesErr) {
      return NextResponse.json({ error: 'Error consultando poderes' }, { status: 500 })
    }

    const unidadesPoderesIds = (poderesRows ?? [])
      .filter((p) => {
        const unidadId = String((p as { unidad_otorgante_id?: string }).unidad_otorgante_id ?? '')
        return unidadId && unidadesElegiblesSet.has(unidadId) && identificadorCoincide(p.email_receptor, ident)
      })
      .map((p) => p.unidad_otorgante_id as string)

    const propiasIds = unidadesPropias.map((u) => u.id).filter(Boolean)
    const poderesIds = unidadesPoderesIds.filter((id) => !!id)
    const todasIds = Array.from(new Set([...propiasIds, ...poderesIds]))
    const poderesIdsSet = new Set(poderesIds)
    if (todasIds.length === 0) {
      return NextResponse.json({
        puede_votar: false,
        unidades: [],
        mensaje: 'No se encontraron unidades para este email, teléfono o identificación',
      })
    }

    const byId = new Map((unidadesRows ?? []).map((u: UnidadVotarRow) => [u.id, u]))
    const unidades = todasIds
      .map((id) => byId.get(id))
      .filter((u): u is UnidadVotarRow => !!u)
      .map((u) => ({
        id: u.id,
        torre: u.torre,
        numero: u.numero,
        coeficiente: Number(u.coeficiente) || 0,
        es_poder: poderesIdsSet.has(u.id),
        nombre_otorgante: u.nombre_propietario ?? undefined,
      }))

    const totalCoeficiente = unidades.reduce((acc, u) => acc + (Number(u.coeficiente) || 0), 0)

    return NextResponse.json({
      puede_votar: true,
      unidades,
      total_unidades: unidades.length,
      total_coeficiente: totalCoeficiente,
      mensaje: 'Votante válido',
    })
  } catch (e) {
    console.error('[api/votar/validar-identificador]', e)
    return NextResponse.json({ error: 'Error al validar identificador' }, { status: 500 })
  }
}

