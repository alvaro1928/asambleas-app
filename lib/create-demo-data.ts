import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Inserta datos de demostración para una asamblea de simulación (is_demo = true).
 * - 10 unidades: Apto 101..110, coeficiente 10% cada una (total 100%), is_demo = true.
 * - Sin preguntas por defecto: en sandbox se crean desde la UI (p.ej. hasta 3).
 * Debe ejecutarse con cliente con permisos de escritura (p. ej. service role).
 */
export async function createDemoData(
  supabase: SupabaseClient,
  asambleaId: string,
  organizationId: string
): Promise<{ unidadesIds: string[]; preguntaIds: string[] }> {
  const unidadesIds: string[] = []
  const preguntaIds: string[] = []

  // 10 unidades: coeficiente 10% cada una (total 100%); emails test1@asambleas.online ... test10@asambleas.online para login en simulador
  const torre = 'Demo'

  // Idempotencia para sandbox:
  // si hubo intentos anteriores fallidos, puede quedar evidencia en `unidades`.
  // Borramos solo unidades demo de esta organización y torre para evitar
  // conflictos con el unique constraint `unique_unidad_torre_numero`.
  await supabase
    .from('unidades')
    .delete()
    .eq('organization_id', organizationId)
    .eq('torre', torre)
    .eq('is_demo', true)

  for (let i = 1; i <= 10; i++) {
    const numero = String(100 + i) // 101..110
    const emailDemo = `test${i}@asambleas.online`

    const { data: u, error: errU } = await supabase
      .from('unidades')
      .insert({
        organization_id: organizationId,
        torre,
        numero,
        coeficiente: 10,
        tipo: 'apartamento',
        nombre_propietario: `Apto ${numero}`,
        email: emailDemo,
        email_propietario: emailDemo,
        is_demo: true,
      })
      .select('id')
      .single()

    if (errU) throw new Error(`Error creando unidad demo: ${errU.message}`)
    if (u?.id) unidadesIds.push(u.id)
  }

  // Nota: intencionalmente NO insertamos preguntas por defecto.
  // Así evitamos fallos puntuales al crear demo y dejamos que el admin
  // cree hasta el máximo permitido desde la UI de sandbox.

  return { unidadesIds, preguntaIds }
}
