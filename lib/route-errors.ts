const isDev = process.env.NODE_ENV !== 'production'

/**
 * Registra un error de ruta API con prefijo estable (logs del servidor).
 * No incluye PII; opcionalmente añade claves de contexto no sensibles.
 */
export function logRouteError(routeLabel: string, error: unknown, extra?: Record<string, unknown>): void {
  if (extra && Object.keys(extra).length > 0) {
    console.error(`[${routeLabel}]`, error, extra)
  } else {
    console.error(`[${routeLabel}]`, error)
  }
}

/**
 * Mensaje seguro para el cliente en respuestas 5xx desde un `catch`.
 * En desarrollo devuelve el mensaje de Error para depurar; en producción, el fallback genérico
 * (evita filtrar detalles de Postgres/Supabase/red).
 */
export function publicErrorMessage(error: unknown, fallback: string): string {
  if (isDev && error instanceof Error && error.message?.trim()) {
    return error.message.trim()
  }
  return fallback
}
