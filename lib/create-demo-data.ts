import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Inserta datos de demostración para una asamblea de simulación (is_demo = true).
 * - 10 unidades: Apto 101..110, coeficiente 10% cada una (total 100%), is_demo = true.
 * - 2 preguntas con estado 'abierta' y opciones por defecto (A favor, En contra, Me abstengo).
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

  const opcionesDefault = [
    { texto_opcion: 'A favor', orden: 1, color: '#10b981' },
    { texto_opcion: 'En contra', orden: 2, color: '#ef4444' },
    { texto_opcion: 'Me abstengo', orden: 3, color: '#6b7280' },
  ]

  for (let i = 1; i <= 2; i++) {
    const { data: pregunta, error: errP } = await supabase
      .from('preguntas')
      .insert({
        asamblea_id: asambleaId,
        orden: i,
        texto_pregunta: `Pregunta de demostración ${i}`,
        descripcion: 'Esta es una asamblea de simulación. Los datos son solo para prueba.',
        tipo_votacion: 'coeficiente',
        estado: 'abierta',
      })
      .select('id')
      .single()
    if (errP) throw new Error(`Error creando pregunta demo: ${errP.message}`)
    if (!pregunta?.id) continue
    preguntaIds.push(pregunta.id)

    const opcionesInsert = opcionesDefault.map((o, idx) => ({
      pregunta_id: pregunta.id,
      texto_opcion: o.texto_opcion,
      orden: idx + 1,
      color: o.color,
    }))
    const { error: errO } = await supabase.from('opciones_pregunta').insert(opcionesInsert)
    if (errO) throw new Error(`Error creando opciones demo: ${errO.message}`)
  }

  return { unidadesIds, preguntaIds }
}
