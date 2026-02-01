/**
 * Límites bajo modelo Billetera de Tokens por Gestor.
 * 1 Token = 1 Unidad de Vivienda. Costo operación = unidades_del_conjunto.
 * Si tokens_gestor >= unidades_conjunto: puede Activar Votación, Acta con Auditoría, Registro manual.
 * Límites de preguntas/acta: si puede pagar (tokens >= cost), permite más de 2 preguntas y acta detallada.
 */

import { getCostoEnTokens, puedeRealizarOperacion } from './costo-tokens'

export interface PlanLimits {
  max_preguntas_por_asamblea: number
  incluye_acta_detallada: boolean
}

const LIMITES_BASICOS: PlanLimits = {
  max_preguntas_por_asamblea: 2,
  incluye_acta_detallada: false,
}

const LIMITES_PRO: PlanLimits = {
  max_preguntas_por_asamblea: 999,
  incluye_acta_detallada: true,
}

/**
 * Indica si el gestor puede realizar operaciones de pago (Activar Votación, Acta, Registro manual).
 * Requiere tokens_gestor >= unidades_del_conjunto (1 token = 1 unidad).
 */
export function puedeRealizarOperacionPaga(
  tokensGestor: number,
  unidadesDelConjunto: number
): boolean {
  return puedeRealizarOperacion(tokensGestor, unidadesDelConjunto)
}

/**
 * Costo en tokens para el conjunto (unidades del conjunto * 1).
 */
export function getCostoOperacion(unidadesDelConjunto: number): number {
  return getCostoEnTokens(unidadesDelConjunto)
}

/**
 * Límites efectivos: si el gestor tiene tokens >= cost, puede usar más de 2 preguntas y acta detallada.
 */
export function getEffectivePlanLimits(
  tokensGestor: number,
  unidadesDelConjunto: number
): PlanLimits {
  if (puedeRealizarOperacionPaga(tokensGestor, unidadesDelConjunto)) {
    return LIMITES_PRO
  }
  return LIMITES_BASICOS
}

export { getCostoEnTokens, puedeRealizarOperacion } from './costo-tokens'

/** Tipo para datos de plan desde API (precio, etc.) */
export interface PlanFromApi {
  key: string
  nombre?: string
  precio_por_asamblea_cop?: number
  max_preguntas_por_asamblea?: number
  incluye_acta_detallada?: boolean
}

export function findPlanByKey(
  planes: PlanFromApi[] | null | undefined,
  planKey: string
): PlanFromApi | null {
  if (!planes?.length) return null
  return planes.find((p) => p.key === planKey) ?? null
}
