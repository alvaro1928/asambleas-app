'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'selectedConjuntoId'

/**
 * Hook para leer y actualizar el conjunto seleccionado de forma reactiva.
 * Se sincroniza entre tabs del mismo navegador mediante el evento "storage".
 *
 * Uso:
 *   const { conjuntoId, setConjuntoId } = useSelectedConjunto()
 */
export function useSelectedConjunto() {
  const [conjuntoId, setConjuntoIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(STORAGE_KEY)
  })

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setConjuntoIdState(e.newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const setConjuntoId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    setConjuntoIdState(id)
  }, [])

  return { conjuntoId, setConjuntoId }
}
