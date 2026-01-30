'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Building2,
  Check,
  FileText,
  Shield,
  Users,
  Zap,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
const PLAN_PRO_URL = process.env.NEXT_PUBLIC_PLAN_PRO_URL || '#'

function buildWhatsAppUrl(nombreConjunto: string) {
  const text = `Deseo activar el plan Pro para mi conjunto: ${nombreConjunto.trim() || '[Nombre]'}`
  return `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

export default function Home() {
  const [nombreConjunto, setNombreConjunto] = useState('')

  return (
    <main className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg mb-6">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white max-w-3xl">
              Asambleas digitales para{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                propiedad horizontal
              </span>
            </h1>
            <p className="mt-4 text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl">
              Votaciones en tiempo real, actas y auditoría. Pensado para administradores y consejos de administración.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="rounded-xl">
                  Iniciar sesión
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Prueba social */}
      <section className="border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
            <Zap className="w-10 h-10 shrink-0 text-indigo-200" />
            <div>
              <p className="text-lg font-semibold">
                Sistema validado para 500+ usuarios simultáneos con latencia menor a 200 ms
              </p>
              <p className="text-indigo-100 text-sm mt-0.5">
                Pruebas de carga realizadas en entorno real
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features breves */}
      <section className="py-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Quórum en tiempo real</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Registro de asistencia y participación por coeficiente (Ley 675).
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Actas y auditoría</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Generación de actas y trazabilidad de votos para cumplimiento normativo.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Seguro y multi-conjunto</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Datos aislados por conjunto y autenticación robusta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Precios */}
      <section className="py-16 md:py-20 bg-[#f1f5f9] dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Planes para tu conjunto
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 max-w-xl mx-auto mb-12">
            Elige el plan que mejor se adapte al tamaño y necesidades de tu propiedad horizontal.
          </p>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {/* Gratis */}
            <Card className="flex flex-col border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-xl">Gratis</CardTitle>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">$0</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Para probar la plataforma</p>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    Hasta 2 preguntas por asamblea
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    Votación y quórum en tiempo real
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    Un conjunto
                  </li>
                  <li className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                    <span className="w-4 h-4 shrink-0" />
                    Sin acta ni reporte de auditoría
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/login" className="w-full">
                  <Button variant="outline" className="w-full rounded-xl">
                    Empezar gratis
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Pro */}
            <Card className="flex flex-col relative border-2 border-indigo-500 dark:border-indigo-500 bg-white dark:bg-gray-900 shadow-lg shadow-indigo-500/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-semibold">
                Recomendado
              </div>
              <CardHeader>
                <CardTitle className="text-xl text-indigo-600 dark:text-indigo-400">Pro</CardTitle>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">Consulte</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Para conjuntos que requieren actas</p>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    Preguntas ilimitadas por asamblea
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    Todo lo del plan Gratis
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    Descarga de acta
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    Reporte de auditoría
                  </li>
                </ul>
                {WHATSAPP_NUMBER && (
                  <div className="pt-2 space-y-2">
                    <Label htmlFor="nombre-conjunto-pro" className="text-xs text-gray-500">
                      Nombre de tu conjunto (opcional)
                    </Label>
                    <Input
                      id="nombre-conjunto-pro"
                      placeholder="Ej. Conjunto Los Robles"
                      value={nombreConjunto}
                      onChange={(e) => setNombreConjunto(e.target.value)}
                      className="rounded-lg text-sm"
                    />
                  </div>
                )}
              </CardContent>
              <CardFooter>
                {WHATSAPP_NUMBER ? (
                  <a
                    href={buildWhatsAppUrl(nombreConjunto)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button className="w-full rounded-xl bg-green-600 hover:bg-green-700 gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Activar Plan Pro por WhatsApp
                    </Button>
                  </a>
                ) : (
                  <a href={PLAN_PRO_URL} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button className="w-full rounded-xl">Ver Plan Pro</Button>
                  </a>
                )}
              </CardFooter>
            </Card>

            {/* Personalizado */}
            <Card className="flex flex-col border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-xl">Personalizado</CardTitle>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">A medida</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Varios conjuntos o necesidades especiales</p>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    Todo lo del plan Pro
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    Múltiples conjuntos
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    Soporte prioritario
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    Integraciones o personalización
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                {WHATSAPP_NUMBER ? (
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, me interesa un plan personalizado para mi(s) conjunto(s).')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full rounded-xl gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Contactar por WhatsApp
                    </Button>
                  </a>
                ) : (
                  <a href={PLAN_PRO_URL} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button variant="outline" className="w-full rounded-xl">Solicitar cotización</Button>
                  </a>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            ¿Ya tienes cuenta?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Accede al panel de administración para gestionar tus asambleas.
          </p>
          <Link href="/login">
            <Button size="lg" className="rounded-xl">
              Iniciar sesión
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-6 border-t border-gray-200 dark:border-gray-800 bg-[#f8fafc] dark:bg-gray-950 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Asambleas App — Para administradores de propiedad horizontal</p>
      </footer>
    </main>
  )
}
