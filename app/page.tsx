'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
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

const PLAN_PRO_URL = process.env.NEXT_PUBLIC_PLAN_PRO_URL || '#'

function formatPrecioCop(cop: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cop)
}

function buildWhatsAppUrl(whatsappNumber: string, nombreConjunto: string) {
  const text = `Quiero comprar créditos (tokens) para mi conjunto: ${nombreConjunto.trim() || '[Nombre]'}`
  return `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

export default function Home() {
  const [nombreConjunto, setNombreConjunto] = useState('')
  const [titulo, setTitulo] = useState('Asambleas digitales para propiedad horizontal')
  const [subtitulo, setSubtitulo] = useState('Votaciones en tiempo real, actas y auditoría. Pensado para administradores y consejos de administración.')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [colorPrincipalHex, setColorPrincipalHex] = useState<string>('#4f46e5')
  const [precioPorTokenCop, setPrecioPorTokenCop] = useState<number | null>(null)
  const [bonoBienvenidaTokens, setBonoBienvenidaTokens] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/configuracion-global')
      .then((res) => res.ok ? res.json() : null)
      .then((data: {
        titulo?: string | null
        subtitulo?: string | null
        whatsapp_number?: string | null
        color_principal_hex?: string | null
        precio_por_token_cop?: number | null
        bono_bienvenida_tokens?: number | null
      } | null) => {
        if (data?.titulo) setTitulo(data.titulo)
        if (data?.subtitulo) setSubtitulo(data.subtitulo)
        if (data?.whatsapp_number) setWhatsappNumber(data.whatsapp_number)
        if (data?.color_principal_hex && /^#[0-9A-Fa-f]{6}$/.test(data.color_principal_hex)) setColorPrincipalHex(data.color_principal_hex)
        if (data?.precio_por_token_cop != null) setPrecioPorTokenCop(Number(data.precio_por_token_cop))
        if (data?.bono_bienvenida_tokens != null) setBonoBienvenidaTokens(Number(data.bono_bienvenida_tokens))
        if (data?.precio_por_token_cop == null) {
          fetch('/api/planes')
            .then((r) => (r.ok ? r.json() : null))
            .then((planesData: { planes?: Array<{ key: string; precio_por_asamblea_cop?: number }> } | null) => {
              const pro = planesData?.planes?.find((p) => p.key === 'pro')
              if (pro?.precio_por_asamblea_cop != null) setPrecioPorTokenCop(pro.precio_por_asamblea_cop)
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined' && colorPrincipalHex) {
      document.documentElement.style.setProperty('--color-primary', colorPrincipalHex)
    }
  }, [colorPrincipalHex])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-slate-800 bg-slate-900/50">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg mb-6" style={{ backgroundColor: colorPrincipalHex }}>
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-3xl">
              {titulo || 'Asambleas digitales para propiedad horizontal'}
            </h1>
            <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-2xl">
              {subtitulo || 'Votaciones en tiempo real, actas y auditoría. Pensado para administradores y consejos de administración.'}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="rounded-2xl shadow-lg" style={{ backgroundColor: colorPrincipalHex }}>
                  Iniciar sesión
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Prueba social */}
      <section className="border-b border-slate-800 bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
          <div className="rounded-2xl text-white shadow-lg py-6 px-6" style={{ backgroundColor: colorPrincipalHex }}>
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
        </div>
      </section>

      {/* Features breves */}
      <section className="py-14 border-b border-slate-800 bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6 shadow-lg">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 opacity-80" style={{ backgroundColor: `${colorPrincipalHex}30` }}>
                <Users className="w-6 h-6" style={{ color: colorPrincipalHex }} />
              </div>
              <h3 className="font-semibold text-white">Quórum en tiempo real</h3>
              <p className="text-sm text-slate-400 mt-1">
                Registro de asistencia y participación por coeficiente (Ley 675).
              </p>
            </div>
            <div className="flex flex-col items-center text-center rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6 shadow-lg shadow-indigo-500/10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-white">Actas y auditoría</h3>
              <p className="text-sm text-slate-400 mt-1">
                Generación de actas y trazabilidad de votos para cumplimiento normativo.
              </p>
            </div>
            <div className="flex flex-col items-center text-center rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6 shadow-lg shadow-indigo-500/10">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-semibold text-white">Seguro y multi-conjunto</h3>
              <p className="text-sm text-slate-400 mt-1">
                Datos aislados por conjunto y autenticación robusta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Precios y créditos */}
      <section className="py-16 md:py-20 bg-slate-950 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-2">
            Créditos y acceso por asamblea
          </h2>
          <p className="text-center text-slate-400 max-w-xl mx-auto mb-12">
            Billetera de tokens por gestor. Cada operación (activar votación, acta con auditoría) consume 1 token por unidad del conjunto. Nuevos gestores reciben {bonoBienvenidaTokens ?? 50} tokens de bienvenida.
          </p>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {/* Acceso gratuito */}
            <Card className="flex flex-col rounded-2xl border-slate-700/50 bg-slate-800/50 shadow-lg shadow-indigo-500/10">
              <CardHeader>
                <CardTitle className="text-xl text-white">Acceso gratuito</CardTitle>
                <p className="text-2xl font-bold mt-2 text-white">$0</p>
                <p className="text-sm text-slate-400">Para probar la plataforma</p>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    {bonoBienvenidaTokens ?? 50} tokens de bienvenida
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    Hasta 2 preguntas por asamblea
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    Votación y quórum en tiempo real
                  </li>
                  <li className="flex items-center gap-2 text-slate-500">
                    <span className="w-4 h-4 shrink-0" />
                    Sin acta ni reporte de auditoría
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/login" className="w-full">
                  <Button variant="outline" className="w-full rounded-2xl border-slate-600 text-slate-200 hover:bg-slate-700">
                    Empezar gratis
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Comprar créditos (tokens) */}
            <Card className="flex flex-col relative rounded-2xl border-2 bg-slate-800/50 shadow-lg" style={{ borderColor: `${colorPrincipalHex}99` }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white text-xs font-semibold" style={{ backgroundColor: colorPrincipalHex }}>
                Recomendado
              </div>
              <CardHeader>
                <CardTitle className="text-xl" style={{ color: colorPrincipalHex }}>Créditos (tokens)</CardTitle>
                <p className="text-2xl font-bold mt-2 text-white">
                  {precioPorTokenCop != null ? `${formatPrecioCop(precioPorTokenCop)} / token` : '—'}
                </p>
                <p className="text-sm text-slate-400">1 token = 1 unidad por operación</p>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    Preguntas ilimitadas por asamblea
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    Descarga de acta con auditoría
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    Registro de voto manual
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    Usa tu billetera en varios conjuntos
                  </li>
                </ul>
                {whatsappNumber && (
                  <div className="pt-2 space-y-2">
                    <Label htmlFor="nombre-conjunto-pro" className="text-xs text-slate-400">
                      Nombre de tu conjunto (opcional)
                    </Label>
                    <Input
                      id="nombre-conjunto-pro"
                      placeholder="Ej. Conjunto Los Robles"
                      value={nombreConjunto}
                      onChange={(e) => setNombreConjunto(e.target.value)}
                      className="rounded-xl text-sm bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                    />
                  </div>
                )}
              </CardContent>
              <CardFooter>
                {whatsappNumber ? (
                  <a
                    href={buildWhatsAppUrl(whatsappNumber, nombreConjunto)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button className="w-full rounded-2xl bg-green-600 hover:bg-green-700 gap-2 shadow-lg">
                      <MessageCircle className="w-4 h-4" />
                      Comprar créditos por WhatsApp
                    </Button>
                  </a>
                ) : (
                  <a href={PLAN_PRO_URL} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button className="w-full rounded-2xl shadow-lg" style={{ backgroundColor: colorPrincipalHex }}>Comprar créditos</Button>
                  </a>
                )}
              </CardFooter>
            </Card>

            {/* Personalizado */}
            <Card className="flex flex-col rounded-2xl border-slate-700/50 bg-slate-800/50 shadow-lg shadow-indigo-500/10">
              <CardHeader>
                <CardTitle className="text-xl text-white">Personalizado</CardTitle>
                <p className="text-2xl font-bold mt-2 text-white">A medida</p>
                <p className="text-sm text-slate-400">Varios conjuntos o necesidades especiales</p>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    Todo lo de créditos por token
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    Múltiples conjuntos
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    Soporte prioritario
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    Integraciones o personalización
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                {whatsappNumber ? (
                  <a
                    href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, me interesa un paquete personalizado de créditos para mi(s) conjunto(s).')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full rounded-2xl border-slate-600 text-slate-200 hover:bg-slate-700 gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Contactar por WhatsApp
                    </Button>
                  </a>
                ) : (
                  <a href={PLAN_PRO_URL} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button variant="outline" className="w-full rounded-2xl border-slate-600 text-slate-200 hover:bg-slate-700">Solicitar cotización</Button>
                  </a>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 border-t border-slate-800 bg-slate-900/30">
        <div className="max-w-3xl mx-auto px-4 text-center rounded-2xl bg-slate-800/50 border border-slate-700/50 p-8 shadow-lg">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            ¿Ya tienes cuenta?
          </h2>
          <p className="text-slate-400 mb-6">
            Accede al panel de administración para gestionar tus asambleas.
          </p>
          <Link href="/login">
            <Button size="lg" className="rounded-2xl shadow-lg" style={{ backgroundColor: colorPrincipalHex }}>
              Iniciar sesión
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-6 border-t border-slate-800 bg-slate-950 text-center text-sm text-slate-500">
        <p>Asambleas App — Para administradores de propiedad horizontal</p>
      </footer>
    </main>
  )
}
