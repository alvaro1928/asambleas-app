'use client'

import { useState } from 'react'
import { Zap, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/providers/ToastProvider'

export type ComprarTokensVariant = 'blocked' | 'low' | 'inline' | 'modal'

type ComprarTokensCTAProps = {
  /** ID del conjunto (contexto; opcional para reportes) */
  conjuntoId?: string | null
  /** user_id del gestor: el backend asocia la compra a este usuario; la pasarela (Wompi) acredita los tokens vía webhook */
  userId?: string | null
  /** Precio en COP por token para mostrar */
  precioCop?: number | null
  /** Número WhatsApp para fallback cuando no hay pasarela (ej. desde configuracion_global) */
  whatsappNumber?: string | null
  /** Obsoleto: planes eliminados. No ocultar este CTA por plan_type; disponible para TODOS los usuarios activos. */
  planType?: 'free' | 'pilot' | 'pro' | null
  /** blocked = sin tokens; low = pocos tokens; inline = en línea; modal = contenido para modal */
  variant?: ComprarTokensVariant
  /** Si es true, no mostrar botón de comprar (ej. cuando no hay URL configurada) */
  hideComprar?: boolean
  /** Clase extra para el contenedor */
  className?: string
  /** Callback al cerrar (solo útil en variant modal) */
  onClose?: () => void
}

function formatPrecio(cop: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cop)
}

export function ComprarTokensCTA({
  conjuntoId = null,
  userId = null,
  precioCop,
  whatsappNumber = null,
  planType = 'free',
  variant = 'blocked',
  hideComprar = false,
  className = '',
  onClose,
}: ComprarTokensCTAProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const showComprar = !hideComprar && !!userId

  const handleComprar = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch('/api/pagos/checkout-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          conjunto_id: conjuntoId ?? undefined,
          cantidad_tokens: 20,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      } else {
        toast.error(data?.error ?? 'Error al generar enlace de pago')
      }
    } catch {
      toast.error('Error al generar enlace de pago')
    } finally {
      setLoading(false)
    }
  }

  const isBlocked = variant === 'blocked'
  const isLow = variant === 'low'
  const isModal = variant === 'modal'

  const titulo = isBlocked
    ? 'Te quedaste sin tokens'
    : isLow
      ? 'Te quedan pocos tokens'
      : 'Más potencia para tus asambleas'

  const subtitulo = isBlocked
    ? 'Los tokens son de tu billetera (gestor). Cada operación (Activar votación, Acta con auditoría, Registro manual) consume tantos tokens como unidades tiene el conjunto (1 token = 1 unidad). Compra más para seguir operando.'
    : isLow
      ? 'Compra más tokens ahora y no te quedes sin poder activar votaciones, descargar actas o registrar votos manuales.'
      : 'Compra tokens para tu billetera; cada operación consume 1 token por unidad del conjunto.'

  return (
    <div
      className={
        isModal
          ? `space-y-4 ${className}`
          : isBlocked
            ? `rounded-3xl border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 sm:p-8 ${className}`
            : isLow
              ? `rounded-3xl border border-amber-200 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/20 p-5 ${className}`
              : `rounded-3xl bg-slate-100 dark:bg-slate-800/50 p-4 ${className}`
      }
    >
      {(isModal && (isBlocked || isLow)) && (
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">
          Saldo insuficiente para esta operación.
        </p>
      )}
      <div className="flex items-start gap-3">
        <div
          className={
            isBlocked
              ? 'flex-shrink-0 w-12 h-12 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center'
              : isLow
                ? 'flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center'
                : 'flex-shrink-0 w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center'
          }
        >
          <Zap
            className={
              isBlocked
                ? 'w-6 h-6 text-amber-700 dark:text-amber-300'
                : isLow
                  ? 'w-5 h-5 text-amber-600 dark:text-amber-400'
                  : 'w-5 h-5 text-indigo-600 dark:text-indigo-400'
            }
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {titulo}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {subtitulo}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {showComprar && (
          <Button
            type="button"
            onClick={handleComprar}
            disabled={loading}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-3xl shadow-md hover:shadow-lg transition-all text-sm"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {loading ? 'Generando enlace...' : 'Comprar más tokens'}
            {typeof precioCop === 'number' && precioCop > 0 && !loading && (
              <span className="ml-1 opacity-90">
                ({formatPrecio(precioCop)} / token)
              </span>
            )}
          </Button>
        )}
        {isModal && onClose && (
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </div>

      {showComprar && typeof precioCop === 'number' && precioCop > 0 && (isBlocked || isLow) && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Los tokens se acreditan en tu billetera (gestor). 1 token = 1 unidad por operación. Recarga el dashboard para ver tu saldo.
        </p>
      )}
    </div>
  )
}
