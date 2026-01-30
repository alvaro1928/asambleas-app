/**
 * Plan efectivo: considera vigencia (plan_active_until).
 * Si el plan es pro/pilot pero ya venció, se trata como free.
 */

export type PlanType = 'free' | 'pro' | 'pilot'

/**
 * Devuelve el plan efectivo para la UI y restricciones.
 * Si plan_type es pro o pilot pero plan_active_until ya pasó, devuelve 'free'.
 */
export function planEfectivo(
  planType: PlanType | string | null | undefined,
  planActiveUntil: string | null | undefined
): PlanType {
  if (!planType || planType === 'free') return 'free'
  if (planType !== 'pro' && planType !== 'pilot') return 'free'
  if (!planActiveUntil) return planType as PlanType
  try {
    const until = new Date(planActiveUntil)
    if (isNaN(until.getTime()) || until <= new Date()) return 'free'
  } catch {
    return 'free'
  }
  return planType as PlanType
}
