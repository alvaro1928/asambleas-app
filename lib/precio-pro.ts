/**
 * Precio de la suscripción Plan Pro (por conjunto, anual).
 * Configurable con NEXT_PUBLIC_PRECIO_PRO_ANUAL en COP (ej. 200000 = 200.000 COP/año).
 */

const RAW = process.env.NEXT_PUBLIC_PRECIO_PRO_ANUAL
const PRECIO_PRO_ANUAL_COP = RAW ? Math.max(0, Number(RAW)) : 200000

/** Precio en COP por año (para mostrar y para enviar a Wompi en centavos si aplica). */
export const PRECIO_PRO_COP_ANUAL = PRECIO_PRO_ANUAL_COP

/** Precio en centavos (Wompi usa centavos: 200000 COP = 20000000 centavos). */
export const PRECIO_PRO_CENTAVOS = PRECIO_PRO_ANUAL_COP * 100

/** Formato para mostrar en UI (ej. "$ 200.000 /año"). */
export function formatPrecioPro(): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(PRECIO_PRO_ANUAL_COP)
}
