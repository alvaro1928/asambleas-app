'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'

/**
 * Página de retorno tras el proceso de pago en Wompi.
 * Wompi redirige aquí al finalizar (aprobado, rechazado o error). No asumimos éxito:
 * el resultado se ve en Mis pagos y en el saldo del dashboard.
 */
export default function PagoOkPage() {
  const [countdown, setCountdown] = useState(8)

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t)
          window.location.href = '/dashboard'
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
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-500/20">
          <Info className="w-12 h-12 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          Proceso de pago finalizado
        </h1>
        <p className="text-lg text-slate-300">
          Gracias por completar tu compra. Valoramos tu confianza.
        </p>
        <p className="text-slate-400">
          Si tu pago fue <strong className="text-slate-300">aprobado</strong>, los tokens (créditos) se acreditarán en unos segundos. Revisa tu saldo en el dashboard o en Configuración → Mis pagos.
        </p>
        <p className="text-slate-400">
          Si el pago fue <strong className="text-slate-300">rechazado o falló</strong>, no se acreditarán tokens (créditos). Puedes intentar de nuevo desde el dashboard.
        </p>
        <p className="text-sm text-slate-500">
          Redirigiendo al dashboard en {countdown} segundos…
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
        >
          Ir al dashboard
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </main>
  )
}
