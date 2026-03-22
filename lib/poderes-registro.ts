import type { SupabaseClient } from '@supabase/supabase-js'

/** Mensaje legible ante duplicado / constraint en poderes */
export function mensajeErrorInsertPoder(err: { message?: string; code?: string }): string {
  const m = String(err.message || '').toLowerCase()
  const code = String(err.code || '')
  if (code === '23505' || m.includes('duplicate key') || m.includes('poderes_activo') || m.includes('unique')) {
    if (m.includes('poderes_activo_otorgante_email_receptor')) {
      return 'Ya hay un poder activo desde esa unidad que delega hacia el mismo apoderado (mismo correo o identificación). Revoca el anterior o edita el registro.'
    }
    return 'Esa unidad que delega ya tiene un poder activo en esta asamblea: cada apartamento solo puede otorgar una delegación vigente a la vez. Revócalo o edítalo para cambiar de apoderado. El mismo apoderado sí puede recibir varios poderes si vienen de apartamentos distintos (hasta el límite por apoderado).'
  }
  return String(err.message || 'Error al guardar el poder')
}

export function normalizarEmailReceptor(s: string): string {
  return s.trim().toLowerCase()
}

export function emailContactoUnidad(u: {
  email_propietario?: string | null
  email?: string | null
}): string {
  return (u.email_propietario ?? u.email ?? '').trim()
}

export const MAX_DOC_PODER_BYTES = 2 * 1024 * 1024
export const DOC_MIME_PODER_PERMITIDOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export function esDocumentoPoderValido(file: File): boolean {
  const permitidos = DOC_MIME_PODER_PERMITIDOS as readonly string[]
  return file.size <= MAX_DOC_PODER_BYTES && permitidos.includes(file.type)
}

export function extensionDocPoder(file: File): string {
  if (file.name.toLowerCase().endsWith('.pdf')) return '.pdf'
  if (file.name.toLowerCase().endsWith('.doc')) return '.doc'
  return '.docx'
}

export type CamposInsertPoder = {
  unidad_otorgante_id: string
  unidad_receptor_id: string | null
  email_otorgante: string
  nombre_otorgante: string
  email_receptor: string
  nombre_receptor: string
  observaciones: string | null
}

type ResultadoLimiteRpc = {
  puede_recibir_poder?: boolean
  mensaje?: string
  poderes_actuales?: number
  limite_maximo?: number
}

/** Una fila nueva hacia el mismo receptor (validación de cupo acumulada en lote). */
export async function validarLimiteReceptoresLote(
  supabase: SupabaseClient,
  asambleaId: string,
  organizationId: string | undefined,
  filas: { email_receptor: string }[]
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  if (!organizationId || filas.length === 0) return { ok: true }

  const porEmail = new Map<string, number>()
  const ejemploEmail = new Map<string, string>()
  for (const f of filas) {
    const raw = f.email_receptor.trim()
    if (!raw) continue
    const k = normalizarEmailReceptor(raw)
    porEmail.set(k, (porEmail.get(k) || 0) + 1)
    if (!ejemploEmail.has(k)) ejemploEmail.set(k, raw)
  }

  for (const [k, addCount] of Array.from(porEmail.entries())) {
    const p_email_receptor = ejemploEmail.get(k) ?? k
    const { data: validacion, error: validacionError } = await supabase.rpc('validar_limite_poderes', {
      p_asamblea_id: asambleaId,
      p_email_receptor,
      p_organization_id: organizationId,
    })
    if (validacionError) {
      console.error('validar_limite_poderes:', validacionError)
      continue
    }
    if (validacion && validacion.length > 0) {
      const r = validacion[0] as ResultadoLimiteRpc
      const actuales = r.poderes_actuales ?? 0
      const limite = r.limite_maximo ?? 3
      if (actuales + addCount > limite) {
        return {
          ok: false,
          mensaje: `${r.mensaje ?? 'Límite de poderes'}. El apoderado (${p_email_receptor}) pasaría de ${actuales} a ${actuales + addCount} poderes activos (límite: ${limite}).`,
        }
      }
    }
  }
  return { ok: true }
}

/** Inserción en bloque + subida paralela de documentos al bucket poderes-docs. */
export async function insertarPoderesYSubirDocumentos(
  supabase: SupabaseClient,
  asambleaId: string,
  items: Array<{
    campos: CamposInsertPoder
    archivo: File | null
  }>
): Promise<void> {
  if (items.length === 0) return

  const rows = items.map((i) => ({
    asamblea_id: asambleaId,
    ...i.campos,
    estado: 'activo' as const,
  }))

  const { data: inserted, error } = await supabase.from('poderes').insert(rows).select('id')

  if (error) throw error
  if (!inserted || inserted.length !== items.length) {
    throw new Error('Respuesta incompleta al registrar poderes')
  }

  const uploads = items
    .map((item, idx) => ({ item, id: inserted[idx].id as string }))
    .filter(({ item }) => item.archivo && esDocumentoPoderValido(item.archivo))

  await Promise.all(
    uploads.map(async ({ item, id }) => {
      const file = item.archivo!
      const ext = extensionDocPoder(file)
      const path = `${asambleaId}/${id}/doc${ext}`
      const { error: uploadError } = await supabase.storage.from('poderes-docs').upload(path, file, { upsert: true })
      if (uploadError) return
      const { data: urlData } = supabase.storage.from('poderes-docs').getPublicUrl(path)
      await supabase.from('poderes').update({ archivo_poder: urlData.publicUrl }).eq('id', id)
    })
  )
}
