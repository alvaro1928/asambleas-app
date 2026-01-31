'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TooltipProps {
  /** Mensaje que se muestra al pasar el mouse */
  content: React.ReactNode
  /** Posición del tooltip respecto al elemento */
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Contenido (botón, enlace, icono, etc.) que al pasar el mouse muestra la ayuda */
  children: React.ReactElement
  /** Clases adicionales para el contenedor */
  className?: string
}

/**
 * Muestra un mensaje de ayuda al pasar el mouse sobre el elemento.
 * Mejora la usabilidad indicando qué hace cada botón o enlace.
 */
export function Tooltip({ content, side = 'top', children, className }: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <span
      className={cn('relative inline-flex group/tooltip', className)}
      title={typeof content === 'string' ? content : undefined}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          'absolute z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg whitespace-nowrap',
          'opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-150 pointer-events-none',
          positionClasses[side]
        )}
      >
        {content}
        {/* Flecha del tooltip */}
        <span
          className={cn(
            'absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45',
            side === 'top' && 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
            side === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
            side === 'left' && 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
            side === 'right' && 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2'
          )}
        />
      </span>
    </span>
  )
}
