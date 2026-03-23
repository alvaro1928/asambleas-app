import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type AsambleaDelegadoRow = {
  id: string
  organization_id: string
  is_demo: boolean
  sandbox_usar_unidades_reales: boolean
  verificacion_asistencia_activa: boolean
  estado: string
  token_delegado: string | null
}

/**
 * Valida codigo_asamblea + token delegado y devuelve cliente admin + fila asamblea.
 * Misma lógica que POST /api/delegado/validar (service role, sin depender del JWT del navegador).
 */
export async function verifyDelegadoToken(
  codigoRaw: string | null | undefined,
  tokenRaw: string | null | undefined
): Promise<
  | { ok: true; admin: SupabaseClient; asamblea: AsambleaDelegadoRow }
  | { ok: false; status: number; error: string }
> {
  const codigo = codigoRaw?.trim()
  const token = tokenRaw?.trim()
  if (!codigo || !token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return { ok: false, status: 400, error: 'Datos inválidos' }
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceRoleKey || !url) {
    return { ok: false, status: 500, error: 'Configuración del servidor incompleta' }
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: asamblea, error } = await admin
    .from('asambleas')
    .select('id, organization_id, is_demo, sandbox_usar_unidades_reales, verificacion_asistencia_activa, estado, token_delegado')
    .eq('codigo_acceso', codigo.toUpperCase())
    .single()

  if (error || !asamblea) {
    return { ok: false, status: 404, error: 'Asamblea no encontrada' }
  }

  const row = asamblea as AsambleaDelegadoRow
  if (!row.token_delegado) {
    return { ok: false, status: 403, error: 'El acceso de asistente no está activo para esta asamblea' }
  }
  if (row.token_delegado !== token) {
    return { ok: false, status: 403, error: 'Token inválido o expirado' }
  }
  if (row.estado === 'finalizada') {
    return { ok: false, status: 409, error: 'Esta asamblea ya fue finalizada' }
  }

  return { ok: true, admin, asamblea: row }
}
