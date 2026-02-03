'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, ArrowRight } from 'lucide-react'

/**
 * Página de retorno tras el pago en Wompi.
 * Wompi puede redirigir aquí con redirect_url; si no redirige (p. ej. PSE muestra solo comprobante),
 * el usuario puede abrir manualmente esta URL o /dashboard para ver sus tokens.
 */
export default function PagoOkPage() {
  const [countdown, setCountdown] = useState(8)

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t)
          window.location.href = '/dashboard?pago=ok'
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#0B0E14' }}>
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20">
          <CheckCircle className="w-12 h-12 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          Pago recibido
        </h1>
        <p className="text-slate-400">
          Tus tokens se están acreditando. Puedes volver al dashboard para ver tu saldo.
        </p>
        <p className="text-sm text-slate-500">
          Redirigiendo en {countdown} segundos…
        </p>
        <Link
          href="/dashboard?pago=ok"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
        >
          Ir al dashboard
          <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="text-xs text-slate-500 pt-4">
          Si acabas de pagar en Wompi y no te redirigió, usa el botón de arriba. Los tokens se acreditan por nuestro sistema en unos segundos.
        </p>
      </div>
    </main>
  )
}
