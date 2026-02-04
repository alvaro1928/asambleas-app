/**
 * Validación de coeficientes de copropiedad (Ley 675).
 * La suma debe ser 100%; se acepta una tolerancia por redondeo (Excel, decimales)
 * sin contravenir la regulación.
 */
export const TOLERANCIA_COEFICIENTE_PORCENTAJE = 0.1

/**
 * Indica si la suma de coeficientes es válida según Ley 675.
 * Acepta sumas en el rango [100 - tolerancia, 100 + tolerancia] (ej. 99.9% - 100.1%).
 */
export function sumaCoeficientesValida(suma: number): boolean {
  return Math.abs(suma - 100) <= TOLERANCIA_COEFICIENTE_PORCENTAJE
}

/** Rango aceptado para mensajes en UI (ej. "entre 99.9% y 100.1%"). */
export function rangoCoeficientesAceptado(): string {
  const min = (100 - TOLERANCIA_COEFICIENTE_PORCENTAJE).toFixed(1)
  const max = (100 + TOLERANCIA_COEFICIENTE_PORCENTAJE).toFixed(1)
  return `entre ${min}% y ${max}%`
}
