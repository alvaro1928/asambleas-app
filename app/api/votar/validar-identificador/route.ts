import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type UnidadRow = {
  id: string
  torre: string
  numero: string
  coeficiente: number
  nombre_propietario?: string | null
  email?: string | null
  email_propietario?: string | null
  telefono?: string | null
  telefono_propietario?: string | null
}

const norm = (v: string) => v.trim().toLowerCase()
const normPhone = (v: string) => v.replace(/\D/g, '')
const normDoc = (v: string) => v.replace(/[^a-z0-9]/gi, '').toLowerCase()

function emailCoincide(campo: string | null | undefined, email: string): boolean {
  if (!campo) return false
  return campo
    .split(/[;,]/)
    .map((x) => norm(x))
    .filter(Boolean)
    .includes(email)
}

function identificadorCoincide(rawStored: string | null | undefined, identificador: string): boolean {
  if (!rawStored) return false
  const stored = norm(rawStored)
  if (!stored) return false
  const idNorm = norm(identificador)
  if (stored === idNorm) return true
  const telA = normPhone(stored)
  const telB = normPhone(idNorm)
  if (telA && telB && telA === telB) return true
  const docA = normDoc(stored)
  const docB = normDoc(idNorm)
  return !!docA && !!docB && docA === docB
}

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
    const identNorm = norm(ident)
    const identPhone = normPhone(identNorm)
    const esEmail = identNorm.includes('@')

    const { data: unidadesRows, error: unidadesErr } = await admin
      .from('unidades')
      .select('id, torre, numero, coeficiente, nombre_propietario, email, email_propietario, telefono, telefono_propietario')
      .eq('organization_id', organizationId)
    if (unidadesErr) {
      return NextResponse.json({ error: 'Error consultando unidades' }, { status: 500 })
    }

    const unidadesPropias = (unidadesRows ?? []).filter((u: UnidadRow) => {
      if (esEmail) {
        return emailCoincide(u.email_propietario ?? u.email ?? '', identNorm)
      }
      if (identPhone) {
        return normPhone(u.telefono_propietario ?? u.telefono ?? '') === identPhone
      }
      return false
    })

    const { data: poderesRows, error: poderesErr } = await admin
      .from('poderes')
      .select('unidad_otorgante_id, email_receptor')
      .eq('asamblea_id', asambleaId)
      .eq('estado', 'activo')
    if (poderesErr) {
      return NextResponse.json({ error: 'Error consultando poderes' }, { status: 500 })
    }

    const unidadesPoderesIds = (poderesRows ?? [])
      .filter((p) => identificadorCoincide(p.email_receptor, identNorm))
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

    const byId = new Map((unidadesRows ?? []).map((u: UnidadRow) => [u.id, u]))
    const unidades = todasIds
      .map((id) => byId.get(id))
      .filter((u): u is UnidadRow => !!u)
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

