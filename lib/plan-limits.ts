/**
 * Límites parametrizables por plan (desde tabla planes).
 * Los tokens son del conjunto (organization); las cuentas (admins) administran conjuntos.
 * Pro y Pilot pueden usar funciones Pro (más de 2 preguntas, acta detallada); Pro es ilimitado.
 * Free y Pilot consumen tokens del conjunto al crear o activar asambleas.
 */

export interface PlanLimits {
  max_preguntas_por_asamblea: number
  incluye_acta_detallada: boolean
}

export interface PlanFromApi {
  key: string
  nombre?: string
  precio_por_asamblea_cop?: number
  max_preguntas_por_asamblea?: number
  incluye_acta_detallada?: boolean
}

const DEFAULTS: Record<string, PlanLimits> = {
  free: { max_preguntas_por_asamblea: 2, incluye_acta_detallada: false },
  pro: { max_preguntas_por_asamblea: 999, incluye_acta_detallada: true },
  pilot: { max_preguntas_por_asamblea: 999, incluye_acta_detallada: true },
}

/**
 * Obtiene los límites de un plan por su key (sin considerar tokens).
 * Si no hay datos (API antigua o sin migración), usa valores por defecto.
 */
export function getPlanLimits(planKey: string | null | undefined, planFromApi?: PlanFromApi | null): PlanLimits {
  if (planFromApi && planFromApi.key === planKey) {
    return {
      max_preguntas_por_asamblea:
        typeof planFromApi.max_preguntas_por_asamblea === 'number' && planFromApi.max_preguntas_por_asamblea >= 0
          ? planFromApi.max_preguntas_por_asamblea
          : DEFAULTS[planKey ?? 'free']?.max_preguntas_por_asamblea ?? 2,
      incluye_acta_detallada:
        typeof planFromApi.incluye_acta_detallada === 'boolean'
          ? planFromApi.incluye_acta_detallada
          : DEFAULTS[planKey ?? 'free']?.incluye_acta_detallada ?? false,
    }
  }
  const key = (planKey ?? 'free') as keyof typeof DEFAULTS
  return DEFAULTS[key] ?? DEFAULTS.free
}

/**
 * Indica si el conjunto puede usar funciones Pro (más de 2 preguntas, acta detallada).
 * Pilot: siempre. Pro: ilimitado (siempre). Free: no.
 * Los tokens son del conjunto (organization); las cuentas (admins) administran conjuntos.
 */
export function canUseProFeatures(
  planKey: string | null | undefined,
  _tokensDisponibles: number
): boolean {
  if (planKey === 'pilot') return true
  if (planKey === 'pro') return true
  return false
}

/**
 * Límites efectivos según plan. Pro y Pilot pueden usar más de 2 preguntas y acta detallada.
 * Free no. Los tokens (del conjunto) solo se consumen en Free/Pilot al crear o activar asambleas.
 */
export function getEffectivePlanLimits(
  planKey: string | null | undefined,
  tokensDisponibles: number,
  planFromApi?: PlanFromApi | null
): PlanLimits {
  const canPro = canUseProFeatures(planKey, tokensDisponibles)
  if (canPro) return getPlanLimits(planKey, planFromApi)
  return DEFAULTS.free
}

/**
 * Encuentra un plan en la lista de planes por key.
 */
export function findPlanByKey(planes: PlanFromApi[] | null | undefined, planKey: string): PlanFromApi | null {
  if (!planes?.length) return null
  return planes.find((p) => p.key === planKey) ?? null
}
