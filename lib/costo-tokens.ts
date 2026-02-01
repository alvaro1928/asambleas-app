/**
 * Modelo: Billetera de Tokens por Gestor.
 * 1 Token = 1 Unidad de Vivienda.
 * Costo de una operación en un conjunto = número de unidades de ese conjunto.
 */

/** Tokens por unidad (siempre 1) */
export const TOKENS_POR_UNIDAD = 1

/**
 * Calcula el costo en tokens para una operación en el conjunto.
 * costo = unidades_del_conjunto * TOKENS_POR_UNIDAD (1 token = 1 unidad).
 * @param unidadesCount Número de unidades del conjunto
 */
export function getCostoEnTokens(unidadesCount: number): number {
  const n = Math.max(0, Math.floor(Number(unidadesCount)))
  return n * TOKENS_POR_UNIDAD
}

/**
 * Indica si el gestor puede realizar la operación (tiene suficientes tokens).
 * Se bloquean Activar Votación, Descarga de Acta con Auditoría y Registro de Voto Manual
 * si tokens_gestor < costo (unidades del conjunto).
 */
export function puedeRealizarOperacion(
  tokensGestor: number,
  unidadesDelConjunto: number
): boolean {
  const costo = getCostoEnTokens(unidadesDelConjunto)
  return tokensGestor >= costo
}
