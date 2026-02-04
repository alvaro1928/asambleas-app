import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Utilidad para reconocer al SUPER_ADMIN.
 * Configura SUPER_ADMIN_EMAIL en .env con tu correo (reemplaza TU_CORREO_AQUÍ).
 */

/** Valor por defecto para documentación: reemplázalo en .env por tu correo real. */
export const SUPER_ADMIN_EMAIL_PLACEHOLDER = 'TU_CORREO_AQUÍ'

/**
 * Comprueba si el email corresponde al super administrador.
 * Usa la variable de entorno SUPER_ADMIN_EMAIL (case-insensitive).
 */
export function isSuperAdmin(email: string | undefined): boolean {
  const configured = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase()
  if (!configured || !email) return false
  return email.trim().toLowerCase() === configured
}

/**
 * Comprueba si el email corresponde al admin (NEXT_PUBLIC_ADMIN_EMAIL).
 * Usado en la página /super-admin para control de acceso.
 */
export function isAdminEmail(email: string | undefined): boolean {
  const configured = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase()
  if (!configured || !email) return false
  return email.trim().toLowerCase() === configured
}

export interface TransaccionPagoPayload {
  organization_id: string | null
  monto: number
  wompi_transaction_id: string | null
  estado: string
  user_id?: string | null
}

/**
 * Registra una transacción de pago en pagos_log (para Dinero total recaudado en Super Admin y Mis pagos).
 * Usado por el webhook de Wompi. Si se pasa user_id, "Mis pagos" mostrará esta transacción al usuario.
 */
export async function registrarTransaccionPago(
  supabase: SupabaseClient,
  payload: TransaccionPagoPayload
): Promise<{ error: Error | null }> {
  const row: Record<string, unknown> = {
    organization_id: payload.organization_id ?? null,
    monto: payload.monto,
    wompi_transaction_id: payload.wompi_transaction_id,
    estado: payload.estado,
  }
  if (payload.user_id) row.user_id = payload.user_id
  const { error } = await supabase.from('pagos_log').insert(row)
  return { error: error ? new Error(error.message) : null }
}
