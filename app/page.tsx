'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import {
  Building2,
  FileText,
  Shield,
  Users,
  Zap,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Si Supabase/Google redirige a /?code=..., llevar al callback para completar login y entrar al dashboard. */
function useRedirectOAuthCode() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      const next = params.get('next') || '/dashboard'
      const callback = `/auth/callback/oauth?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`
      window.location.replace(callback)
    }
  }, [])
}

function buildWhatsAppUrl(whatsappNumber: string, nombreConjunto: string) {
  const text = nombreConjunto.trim() ? `Hola, contacto desde la web (${nombreConjunto}).` : 'Hola, tengo una consulta.'
  return `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

export default function Home() {
  useRedirectOAuthCode()
  const [nombreConjunto, setNombreConjunto] = useState('')
  const [titulo, setTitulo] = useState('Asambleas digitales para propiedad horizontal')
  const [subtitulo, setSubtitulo] = useState('Votaciones en tiempo real, actas y auditoría. Pensado para administradores y consejos de administración.')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [colorPrincipalHex, setColorPrincipalHex] = useState<string>('#4f46e5')
  const [ctaWhatsappText, setCtaWhatsappText] = useState<string>('Contactanos')
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    fetch('/api/config/public', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data: {
        titulo?: string | null
        subtitulo?: string | null
        whatsapp_number?: string | null
        color_principal_hex?: string | null
        cta_whatsapp_text?: string | null
      } | null) => {
        if (data?.titulo) setTitulo(data.titulo)
        if (data?.subtitulo) setSubtitulo(data.subtitulo)
        if (data?.whatsapp_number) setWhatsappNumber(data.whatsapp_number)
        if (data?.color_principal_hex && /^#[0-9A-Fa-f]{6}$/.test(data.color_principal_hex)) setColorPrincipalHex(data.color_principal_hex)
        if (data?.cta_whatsapp_text) setCtaWhatsappText(data.cta_whatsapp_text)
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
            <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden shadow-lg mb-6 ring-2 ring-white/20">
              {!logoError ? (
                <Image
                  src="/logo.png"
                  alt="VOTA TECH - Soluciones Comunitarias Digitales"
                  width={96}
                  height={96}
                  className="object-contain w-full h-full bg-white"
                  priority
                  unoptimized
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: colorPrincipalHex }}>
                  <Building2 className="w-10 h-10 text-white" />
                </div>
              )}
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
                  Empezar ahora
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-400 max-w-xl">
              Crea tu conjunto, carga las unidades, convoca la asamblea y comparte el enlace. Los copropietarios votan en línea y obtienes el acta al instante.
            </p>
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

      {/* Cómo funciona (información funcional) */}
      <section className="py-14 border-b border-slate-800" style={{ backgroundColor: '#0B0E14' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Cómo funciona</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center rounded-3xl bg-slate-800/50 border p-6 shadow-lg" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 opacity-80" style={{ backgroundColor: `${colorPrincipalHex}30` }}>
                <Building2 className="w-6 h-6" style={{ color: colorPrincipalHex }} />
              </div>
              <h3 className="font-semibold text-white">1. Crea tu conjunto</h3>
              <p className="text-sm text-slate-400 mt-1">
                Registra tu edificio o conjunto. Luego carga las unidades (apartamentos, locales) con coeficientes y datos de contacto.
              </p>
            </div>
            <div className="flex flex-col items-center text-center rounded-3xl bg-slate-800/50 border p-6 shadow-lg" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 opacity-80" style={{ backgroundColor: `${colorPrincipalHex}30` }}>
                <FileText className="w-6 h-6" style={{ color: colorPrincipalHex }} />
              </div>
              <h3 className="font-semibold text-white">2. Convoca la asamblea</h3>
              <p className="text-sm text-slate-400 mt-1">
                Crea la asamblea, añade las preguntas a votar y activa la votación. Obtendrás un enlace y un código para compartir.
              </p>
            </div>
            <div className="flex flex-col items-center text-center rounded-3xl bg-slate-800/50 border p-6 shadow-lg" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 opacity-80" style={{ backgroundColor: `${colorPrincipalHex}30` }}>
                <Users className="w-6 h-6" style={{ color: colorPrincipalHex }} />
              </div>
              <h3 className="font-semibold text-white">3. Los copropietarios votan</h3>
              <p className="text-sm text-slate-400 mt-1">
                Cada propietario entra con su correo o teléfono, elige sus opciones y vota. Quórum y resultados en tiempo real (Ley 675).
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            <div className="flex items-center gap-2 text-slate-300">
              <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm">Actas y trazabilidad lista al cerrar la votación</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Shield className="w-5 h-5 text-purple-400 shrink-0" />
              <span className="text-sm">Datos aislados por conjunto y acceso seguro</span>
            </div>
          </div>
        </div>
      </section>

      {/* Contacto / CTA */}
      <section className="py-14 border-b border-slate-800" style={{ backgroundColor: '#0B0E14' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-400 mb-6">
            ¿Dudas? Escríbenos y te ayudamos a configurar tu primera asamblea.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login">
              <Button size="lg" className="rounded-3xl shadow-lg w-full sm:w-auto" style={{ backgroundColor: colorPrincipalHex }}>
                Empezar ahora
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
                  {ctaWhatsappText}
                </Button>
              </a>
            )}
          </div>
          {whatsappNumber && (
            <div className="pt-6">
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
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/politica-privacidad" className="text-slate-400 hover:text-white transition-colors underline underline-offset-2">
            Política de Privacidad
          </Link>
          <Link href="/epbco" className="text-slate-400 hover:text-white transition-colors underline underline-offset-2">
            EPBCO Solutions
          </Link>
        </p>
      </footer>
    </main>
  )
}
