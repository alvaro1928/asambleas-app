'use client'

import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VotarPaso = 'email' | 'unidades' | 'consentimiento' | 'votar'

const PASOS: { key: VotarPaso; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'unidades', label: 'Unidades' },
  { key: 'consentimiento', label: 'Datos' },
  { key: 'votar', label: 'Votar' },
]

export function StepIndicator({ pasoActual }: { pasoActual: VotarPaso }) {
  const idx = PASOS.findIndex((p) => p.key === pasoActual)

  return (
    <nav aria-label="Progreso de votación" className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 sm:gap-x-2 mb-6 max-w-full">
      {PASOS.map((paso, i) => {
        const completado = i < idx
        const actual = i === idx
        return (
          <div key={paso.key} className="flex items-center shrink-0">
            <div
              className={cn(
                'flex items-center gap-1 sm:gap-1.5 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap',
                completado && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
                actual && 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 ring-2 ring-indigo-500',
                !completado && !actual && 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              )}
            >
              {completado ? (
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              ) : (
                <Circle className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0', actual && 'text-indigo-600 dark:text-indigo-400')} />
              )}
              <span>{paso.label}</span>
            </div>
            {i < PASOS.length - 1 && (
              <span className="mx-0.5 sm:mx-1 text-gray-300 dark:text-gray-600 shrink-0" aria-hidden>
                →
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
