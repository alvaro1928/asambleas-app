'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { ChevronDown, Building2, Copy } from 'lucide-react'
import { useToast } from '@/components/providers/ToastProvider'

interface Conjunto {
  id: string
  name: string
  nit?: string
  city?: string
}

interface ConjuntoSelectorProps {
  onConjuntoChange?: (conjuntoId: string) => void
}

export default function ConjuntoSelector({ onConjuntoChange }: ConjuntoSelectorProps) {
  const toast = useToast()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([])
  const [selectedConjunto, setSelectedConjunto] = useState<Conjunto | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })

  useEffect(() => {
    loadConjuntos()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  const loadConjuntos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Obtener todos los conjuntos del usuario
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('organization_id, organizations(id, name, nit, city)')
        .eq('user_id', user.id)
        .not('organization_id', 'is', null)
        .order('created_at', { ascending: false })
      
      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
        return
      }

      if (profiles && profiles.length > 0) {
        const conjuntosData = profiles
          .filter(p => p.organizations && (Array.isArray(p.organizations) ? p.organizations.length > 0 : !!p.organizations))
          .map(p => {
            // Supabase puede devolver organizations como array o como objeto
            const org = Array.isArray(p.organizations) ? p.organizations[0] : p.organizations
            return org ? {
              id: org.id,
              name: org.name,
              nit: org.nit,
              city: org.city,
            } : null
          })
          .filter((c): c is { id: string; name: string; nit: string; city: string } => c !== null)

        setConjuntos(conjuntosData)

        // Cargar conjunto seleccionado desde localStorage o usar el primero
        const savedConjuntoId = localStorage.getItem('selectedConjuntoId')
        const selected = savedConjuntoId
          ? conjuntosData.find(c => c.id === savedConjuntoId) || conjuntosData[0]
          : conjuntosData[0]

        setSelectedConjunto(selected)
        localStorage.setItem('selectedConjuntoId', selected.id)
        
        if (onConjuntoChange) {
          onConjuntoChange(selected.id)
        }
      }
    } catch (error) {
      console.error('Error loading conjuntos:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleDropdown = () => {
    if (!showDropdown && buttonRef.current && typeof document !== 'undefined') {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + 8,
        right: document.documentElement.clientWidth - rect.right,
      })
    }
    setShowDropdown((v) => !v)
  }

  const handleSelectConjunto = (conjunto: Conjunto) => {
    setSelectedConjunto(conjunto)
    localStorage.setItem('selectedConjuntoId', conjunto.id)
    setShowDropdown(false)
    
    if (onConjuntoChange) {
      onConjuntoChange(conjunto.id)
    }

    // Recargar la página para actualizar datos del conjunto
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="animate-pulse flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
        <div className="w-32 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    )
  }

  if (!selectedConjunto || conjuntos.length === 0) {
    return (
      <div className="flex items-center space-x-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-2">
        <Building2 className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
        <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
          Sin conjuntos
        </span>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="flex items-center space-x-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl px-4 py-2.5 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all shadow-sm hover:shadow-md"
      >
        <div className="flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <div className="text-left">
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
              Administrando
            </p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {selectedConjunto.name}
            </p>
            {selectedConjunto.city && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedConjunto.city}
              </p>
            )}
          </div>
        </div>
        
        {conjuntos.length > 1 && (
          <ChevronDown className={`w-4 h-4 text-indigo-600 dark:text-indigo-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown: renderizado en portal para evitar recorte por overflow del header */}
      {showDropdown && conjuntos.length > 1 && typeof document !== 'undefined' && createPortal(
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Menu: fixed para evitar clipping por overflow en padres */}
          <div 
            className="fixed w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[101]"
            style={{ top: menuPosition.top, right: menuPosition.right }}
          >
            <div className="p-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 px-3 py-1">
                Mis Conjuntos ({conjuntos.length})
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {conjuntos.map((conjunto) => (
                <button
                  key={conjunto.id}
                  onClick={() => handleSelectConjunto(conjunto)}
                  className={`w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors ${
                    selectedConjunto.id === conjunto.id
                      ? 'bg-indigo-100 dark:bg-indigo-900/30'
                      : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {conjunto.name}
                      </p>
                      <div className="flex items-center space-x-2 mt-1 flex-wrap gap-x-2">
                        {conjunto.nit && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            NIT: {conjunto.nit}
                          </span>
                        )}
                        {conjunto.city && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            • {conjunto.city}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate mt-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(conjunto.id)
                          toast.success('ID copiado')
                        }}
                        title={`ID: ${conjunto.id} (clic para copiar)`}
                      >
                        <Copy className="w-3 h-3 inline mr-0.5 align-middle" />
                        {conjunto.id}
                      </p>
                    </div>
                    {selectedConjunto.id === conjunto.id && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
