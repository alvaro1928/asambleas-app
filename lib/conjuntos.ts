import { supabase } from './supabase'

/**
 * Obtiene el conjunto actualmente seleccionado por el usuario
 * Usa localStorage para recordar la selección del usuario
 */
export async function getSelectedConjuntoId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Intentar obtener de localStorage
    const savedId = localStorage.getItem('selectedConjuntoId')
    
    if (savedId) {
      // Verificar que el usuario tenga acceso a este conjunto
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', savedId)
        .maybeSingle()

      if (profile) {
        return savedId
      }
    }

    // Si no hay en localStorage o no tiene acceso, usar el más reciente
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (profile?.organization_id) {
      localStorage.setItem('selectedConjuntoId', profile.organization_id)
      return profile.organization_id
    }

    return null
  } catch (error) {
    console.error('Error getting selected conjunto:', error)
    return null
  }
}

/**
 * Obtiene información completa del conjunto seleccionado
 */
export async function getSelectedConjunto() {
  try {
    const conjuntoId = await getSelectedConjuntoId()
    if (!conjuntoId) return null

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', conjuntoId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error getting selected conjunto info:', error)
    return null
  }
}

/**
 * Cambia el conjunto activo
 */
export function setSelectedConjuntoId(conjuntoId: string) {
  localStorage.setItem('selectedConjuntoId', conjuntoId)
}
