/**
 * Reglas unificadas de demo/sandbox.
 *
 * Convención del producto:
 * - demo y sandbox son el mismo modo (is_demo = true)
 * - por defecto usa unidades demo
 * - opcionalmente puede usar unidades reales solo si sandbox_usar_unidades_reales = true
 */
export function isDemoSandbox(isDemo: boolean | null | undefined): boolean {
  return isDemo === true
}

/**
 * Determina si la asamblea debe operar con unidades DEMO (is_demo=true).
 */
export function shouldUseDemoUnits(
  isDemo: boolean | null | undefined,
  sandboxUsarUnidadesReales: boolean | null | undefined
): boolean {
  return isDemoSandbox(isDemo) && sandboxUsarUnidadesReales !== true
}

/**
 * Determina si la asamblea demo opera con unidades REALES (is_demo=false).
 */
export function shouldUseRealUnitsInSandbox(
  isDemo: boolean | null | undefined,
  sandboxUsarUnidadesReales: boolean | null | undefined
): boolean {
  return isDemoSandbox(isDemo) && sandboxUsarUnidadesReales === true
}
