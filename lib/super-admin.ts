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
