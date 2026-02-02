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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'


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
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined' && colorPrincipalHex) {
      document.documentElement.style.setProperty('--color-primary', colorPrincipalHex)
    }
  }, [colorPrincipalHex])

  return (
    <main className="min-h-screen text-slate-100" style={{ backgroundColor: '#0B0E14' }}>
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-slate-800" style={{ backgroundColor: '#0B0E14' }}>
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
                <Button size="lg" className="rounded-3xl shadow-lg" style={{ backgroundColor: colorPrincipalHex }}>
                  Empezar ahora ({bonoBienvenidaTokens ?? 50} tokens gratis)
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Prueba social */}
      <section className="border-b border-slate-800" style={{ backgroundColor: '#0B0E14' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
          <div className="rounded-3xl text-white shadow-lg py-6 px-6" style={{ backgroundColor: colorPrincipalHex }}>
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
      <section className="py-14 border-b border-slate-800" style={{ backgroundColor: '#0B0E14' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center rounded-3xl bg-slate-800/50 border p-6 shadow-lg" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 opacity-80" style={{ backgroundColor: `${colorPrincipalHex}30` }}>
                <Users className="w-6 h-6" style={{ color: colorPrincipalHex }} />
              </div>
              <h3 className="font-semibold text-white">Quórum en tiempo real</h3>
              <p className="text-sm text-slate-400 mt-1">
                Registro de asistencia y participación por coeficiente (Ley 675).
              </p>
            </div>
            <div className="flex flex-col items-center text-center rounded-3xl bg-slate-800/50 border p-6 shadow-lg" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-white">Actas y auditoría</h3>
              <p className="text-sm text-slate-400 mt-1">
                Generación de actas y trazabilidad de votos para cumplimiento normativo.
              </p>
            </div>
            <div className="flex flex-col items-center text-center rounded-3xl bg-slate-800/50 border p-6 shadow-lg" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
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

      {/* Precios: simplificado — precio desde configuracion_global.precio_por_token_cop, bono desde bono_bienvenida_tokens */}
      <section className="py-16 md:py-20 border-b border-slate-800" style={{ backgroundColor: '#0B0E14' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xl md:text-2xl font-bold text-white mb-2">
            Paga solo por lo que usas: 1 Token = 1 Unidad de vivienda
          </p>
          <p className="text-center text-slate-400 text-sm mb-8">
            Precio por token (desde configuración)
          </p>

          <div className="rounded-3xl border p-8 space-y-6" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,23,42,0.5)' }}>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white">
                {precioPorTokenCop != null ? formatPrecioCop(precioPorTokenCop) : '—'}
              </p>
              <p className="text-slate-400 mt-1">por token</p>
            </div>

            <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${colorPrincipalHex}20`, border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-slate-200 font-semibold">
                Regístrate hoy y recibe {bonoBienvenidaTokens ?? 50} tokens gratis para tu primera asamblea
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link href="/login" className="inline-flex justify-center">
                <Button size="lg" className="rounded-3xl shadow-lg w-full sm:w-auto" style={{ backgroundColor: colorPrincipalHex }}>
                  Empezar ahora ({bonoBienvenidaTokens ?? 50} tokens gratis)
                </Button>
              </Link>
              {whatsappNumber && (
                <a
                  href={buildWhatsAppUrl(whatsappNumber, nombreConjunto)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex justify-center"
                >
                  <Button variant="outline" size="lg" className="rounded-3xl border-white/20 text-slate-200 hover:bg-white/10 gap-2 w-full sm:w-auto">
                    <MessageCircle className="w-5 h-5" />
                    Comprar créditos por WhatsApp
                  </Button>
                </a>
              )}
            </div>
            {whatsappNumber && (
              <div className="pt-2 text-center">
                <Label htmlFor="nombre-conjunto-landing" className="text-xs text-slate-400">Nombre de tu conjunto (opcional)</Label>
                <Input
                  id="nombre-conjunto-landing"
                  placeholder="Ej. Conjunto Los Robles"
                  value={nombreConjunto}
                  onChange={(e) => setNombreConjunto(e.target.value)}
                  className="mt-1 rounded-3xl text-sm bg-slate-800/80 border-white/20 text-white placeholder:text-slate-500 max-w-xs mx-auto block"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 border-t border-slate-800" style={{ backgroundColor: '#0B0E14' }}>
        <div className="max-w-3xl mx-auto px-4 text-center rounded-3xl bg-slate-800/50 border p-8 shadow-lg" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            ¿Ya tienes cuenta?
          </h2>
          <p className="text-slate-400 mb-6">
            Accede al panel de administración para gestionar tus asambleas.
          </p>
          <Link href="/login">
            <Button size="lg" className="rounded-3xl shadow-lg" style={{ backgroundColor: colorPrincipalHex }}>
              Iniciar sesión
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-6 border-t border-slate-800 text-center text-sm text-slate-500" style={{ backgroundColor: '#0B0E14' }}>
        <p>Asambleas App — Para administradores de propiedad horizontal</p>
      </footer>
    </main>
  )
}
