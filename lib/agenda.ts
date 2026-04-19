import type { SupabaseClient } from '@supabase/supabase-js'

/** Punto del orden del día expuesto en APIs públicas (solo lectura). */
export interface PuntoOrdenDiaPublico {
  id: string
  orden: number
  titulo: string
  descripcion: string | null
}

export interface OrdenDiaPublico {
  puntos: PuntoOrdenDiaPublico[]
  punto_actual: PuntoOrdenDiaPublico | null
}

/**
 * Lista ordenada de puntos y resolución del punto actual de sesión (mesa/admin).
 * Usa service role en rutas API; no aplica RLS del JWT del navegador.
 */
export async function fetchOrdenDiaPublico(
  admin: SupabaseClient,
  asambleaId: string,
  puntoActualId: string | null | undefined
): Promise<OrdenDiaPublico> {
  const { data: puntosRows, error } = await admin
    .from('puntos_orden_dia')
    .select('id, orden, titulo, descripcion')
    .eq('asamblea_id', asambleaId)
    .order('orden', { ascending: true })

  if (error) {
    console.error('[fetchOrdenDiaPublico] puntos_orden_dia:', error.message)
    return { puntos: [], punto_actual: null }
  }

  const puntos: PuntoOrdenDiaPublico[] = (puntosRows || []).map((r) => ({
    id: r.id as string,
    orden: Number(r.orden) || 0,
    titulo: String(r.titulo ?? ''),
    descripcion: r.descripcion != null ? String(r.descripcion) : null,
  }))

  let punto_actual: PuntoOrdenDiaPublico | null = null
  if (puntoActualId) {
    const found = puntos.find((p) => p.id === puntoActualId)
    if (found) {
      punto_actual = found
    } else {
      const { data: one } = await admin
        .from('puntos_orden_dia')
        .select('id, orden, titulo, descripcion')
        .eq('id', puntoActualId)
        .eq('asamblea_id', asambleaId)
        .maybeSingle()
      if (one) {
        punto_actual = {
          id: one.id as string,
          orden: Number(one.orden) || 0,
          titulo: String(one.titulo ?? ''),
          descripcion: one.descripcion != null ? String(one.descripcion) : null,
        }
      }
    }
  }

  return { puntos, punto_actual }
}
