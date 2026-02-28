'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AsambleasError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Asambleas error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Error al cargar las asambleas
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            No se pudieron cargar las asambleas. Verifica tu conexión e intenta nuevamente.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Intentar nuevamente
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Volver al dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
