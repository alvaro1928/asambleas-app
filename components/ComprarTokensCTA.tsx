'use client'

import Link from 'next/link'
import { Zap, ShoppingCart, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type ComprarTokensVariant = 'blocked' | 'low' | 'inline' | 'modal'

type ComprarTokensCTAProps = {
  /** ID del conjunto para la URL de pago */
  conjuntoId: string | null
  /** Precio en COP por token (por asamblea) para mostrar */
  precioCop?: number | null
  /** Plan actual: free muestra "Actualizar a Pro", pilot muestra "Pasar a Pro ilimitado" */
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
  conjuntoId,
  precioCop,
  planType = 'free',
  variant = 'blocked',
  hideComprar = false,
  className = '',
  onClose,
}: ComprarTokensCTAProps) {
  const pasarelaUrl = process.env.NEXT_PUBLIC_PASARELA_PAGOS_URL
  const planProUrl = process.env.NEXT_PUBLIC_PLAN_PRO_URL
  const hrefComprar =
    conjuntoId && pasarelaUrl
      ? `${pasarelaUrl}${pasarelaUrl.includes('?') ? '&' : '?'}conjunto_id=${encodeURIComponent(conjuntoId)}`
      : null
  const hrefPro = planProUrl && planProUrl !== '#' ? planProUrl : null
  const showComprar = !hideComprar && hrefComprar
  const showPro = planType === 'free' || planType === 'pilot'

  const isBlocked = variant === 'blocked'
  const isLow = variant === 'low'
  const isModal = variant === 'modal'

  const titulo = isBlocked
    ? 'Te quedaste sin tokens'
    : isLow
      ? 'Te quedan pocos tokens'
      : 'Más potencia para tus asambleas'

  const subtitulo = isBlocked
    ? 'Como en las apps de IA: cada asamblea nueva o con más de 2 preguntas consume 1 token. Compra más tokens o actualiza a Plan Pro y ten asambleas ilimitadas.'
    : isLow
      ? 'Compra más tokens ahora y no te quedes sin poder crear o activar asambleas. O actualiza a Pro y olvídate de los límites.'
      : 'Compra tokens bajo demanda o actualiza a Plan Pro para asambleas ilimitadas, actas detalladas y más preguntas.'

  return (
    <div
      className={
        isModal
          ? `space-y-4 ${className}`
          : isBlocked
            ? `rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 sm:p-8 ${className}`
            : isLow
              ? `rounded-2xl border border-amber-200 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/20 p-5 ${className}`
              : `rounded-xl bg-slate-100 dark:bg-slate-800/50 p-4 ${className}`
      }
    >
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
          <a
            href={hrefComprar ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Comprar más tokens
            {typeof precioCop === 'number' && precioCop > 0 && (
              <span className="ml-1 opacity-90">
                ({formatPrecio(precioCop)} / token)
              </span>
            )}
          </a>
        )}
        {showPro && (hrefPro || pasarelaUrl) && (
          <a
            href={
              hrefPro
                ? (conjuntoId ? `${hrefPro}${hrefPro.includes('?') ? '&' : '?'}conjunto_id=${encodeURIComponent(conjuntoId)}` : hrefPro)
                : conjuntoId && pasarelaUrl
                  ? `${pasarelaUrl}${pasarelaUrl.includes('?') ? '&' : '?'}conjunto_id=${encodeURIComponent(conjuntoId)}`
                  : '#'
            }
            target={hrefPro ? '_blank' : undefined}
            rel={hrefPro ? 'noopener noreferrer' : undefined}
            className="inline-flex items-center justify-center px-5 py-2.5 border-2 border-indigo-500 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-semibold rounded-xl transition-all text-sm"
          >
            <Crown className="w-4 h-4 mr-2" />
            {planType === 'free' ? 'Actualizar a Plan Pro' : 'Pasar a Pro ilimitado'}
          </a>
        )}
        {isModal && onClose && (
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </div>

      {showComprar && typeof precioCop === 'number' && precioCop > 0 && (isBlocked || isLow) && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Cada token = 1 asamblea nueva o 1 asamblea Pro (más de 2 preguntas). Al pagar recibes 1 token al instante; recarga el dashboard para ver tu saldo.
        </p>
      )}
    </div>
  )
}
