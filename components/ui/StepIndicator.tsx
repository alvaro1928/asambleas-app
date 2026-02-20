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
    <nav aria-label="Progreso de votación" className="flex items-center justify-center gap-1 sm:gap-2 mb-6">
      {PASOS.map((paso, i) => {
        const completado = i < idx
        const actual = i === idx
        return (
          <div key={paso.key} className="flex items-center">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
                completado && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
                actual && 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 ring-2 ring-indigo-500',
                !completado && !actual && 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              )}
            >
              {completado ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <Circle className={cn('w-4 h-4 shrink-0', actual && 'text-indigo-600 dark:text-indigo-400')} />
              )}
              <span>{paso.label}</span>
            </div>
            {i < PASOS.length - 1 && (
              <span className="mx-1 sm:mx-2 text-gray-300 dark:text-gray-600" aria-hidden>
                →
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
