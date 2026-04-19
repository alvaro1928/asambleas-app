'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, type CSSProperties } from 'react'
import {
  Building2,
  FileText,
  Shield,
  Users,
  Zap,
  MessageCircle,
  Link2,
  Vote,
  UserCheck,
  ScrollText,
  QrCode,
  Printer,
} from 'lucide-react'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WhatsAppGlyph } from '@/components/icons/WhatsAppGlyph'
import { cn } from '@/lib/utils'

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

/** URL pública del sitio (JSON-LD / SEO); mismo criterio que layout metadataBase */
function publicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) return 'https://asambleas.online'
  return raw.startsWith('http') ? raw.replace(/\/$/, '') : `https://${raw.replace(/\/$/, '')}`
}

/**
 * Estilo alineado al design system Stitch del proyecto (pantalla "Landing Page - High-Tech & Accessible",
 * tokens "Sovereign Monolith"): #0B0E14 base, #10131A superficie, tarjetas #1D2026 → hover #272A31, texto #E1E2EB / #C7C4D8.
 */

/** CTA primario Stitch: gradiente 135° entre primario y tinte (designMd). */
function primaryGradientStyle(hex: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 58%, #c3c0ff))`,
    color: '#ffffff',
  }
}

export default function Home() {
  useRedirectOAuthCode()
  const [nombreConjunto, setNombreConjunto] = useState('')
  const [titulo, setTitulo] = useState(
    'Asambleas Online: votación Ley 675, quórum en vivo y acta digital'
  )
  const [subtitulo, setSubtitulo] = useState(
    'Poderes de representación, WhatsApp y QR, verificación de asistencia y acta con trazabilidad. Para administradores y consejos de propiedad horizontal en Colombia.'
  )
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [colorPrincipalHex, setColorPrincipalHex] = useState<string>('#4f46e5')
  const [ctaWhatsappText, setCtaWhatsappText] = useState<string>('Escribir por WhatsApp')
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

  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818cf8]/90 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E14]'

  return (
    <main id="contenido-principal" className="min-h-screen bg-[#0B0E14] antialiased text-[#E1E2EB]">
      <a
        href="#inicio-landing"
        className={cn(
          'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-slate-900 focus:shadow-lg',
          focusRing
        )}
      >
        Saltar al contenido
      </a>

      <nav
        aria-label="Principal"
        className="sticky top-0 z-40 border-b border-[#464555]/25 bg-[#10131A]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#10131A]/85"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className={cn(
              'text-sm font-semibold tracking-tight text-[#E1E2EB] transition-colors duration-200 hover:text-white rounded-md px-1 py-0.5',
              focusRing
            )}
          >
            Asambleas Online
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium text-[#C7C4D8] transition-colors duration-200 hover:text-[#E1E2EB]',
                focusRing
              )}
            >
              Iniciar sesión
            </Link>
            <Link href="/login">
              <Button
                size="sm"
                className={cn('rounded-xl min-h-[2.75rem] border-0 shadow-lg shadow-black/30', focusRing)}
                style={primaryGradientStyle(colorPrincipalHex)}
              >
                Empezar
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — estilo high-tech + accesible (contraste, foco, jerarquía) */}
      <header id="inicio-landing" className="relative overflow-hidden bg-[#10131A]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_50%_-25%,rgba(99,102,241,0.28),transparent_55%)] motion-reduce:opacity-80"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-500/5 motion-reduce:from-indigo-500/5" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 md:py-24 lg:py-28">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <p className="mb-5 inline-flex items-center rounded-full bg-[#1D2026] px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#C7C4D8] sm:text-xs">
              Ley 675 · Colombia
            </p>
            <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden shadow-lg mb-6 ring-2 ring-white/25">
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
            <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-[-0.02em] text-[#E1E2EB] md:text-5xl lg:text-6xl">
              {titulo || 'Asambleas digitales para propiedad horizontal'}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#C7C4D8] md:text-xl">
              {subtitulo || 'Votaciones en tiempo real, actas y auditoría. Pensado para administradores y consejos de administración.'}
            </p>
            <div className="mt-8 flex w-full flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Link href="/login">
                <Button
                  size="lg"
                  className={cn('min-h-[3rem] rounded-3xl border-0 shadow-xl shadow-black/40 transition-colors duration-200', focusRing)}
                  style={primaryGradientStyle(colorPrincipalHex)}
                >
                  Empezar ahora
                </Button>
              </Link>
            </div>
            <p className="mt-6 max-w-2xl text-sm leading-[1.6] text-[#C7C4D8]">
              Censo con coeficientes, votación nominal o por coeficiente, control de quórum, poderes con auditoría,
              invitación masiva y acta descargable con opción de sellado en blockchain. Todo en un solo flujo pensado para Ley 675 y transparencia ante la copropiedad.
            </p>
          </div>
        </div>
      </header>

      {/* Valor: acta, quórum, blockchain */}
      <section className="bg-[#191C22] py-2">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <div
            className="rounded-3xl px-6 py-6 text-white shadow-[0_24px_48px_rgba(0,0,0,0.4)] sm:px-8"
            style={primaryGradientStyle(colorPrincipalHex)}
          >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
            <Zap className="w-10 h-10 shrink-0 text-indigo-200" />
            <div>
              <p className="text-lg font-semibold">
                Quórum, asistencia verificable y acta lista al cierre — con respaldo en blockchain
              </p>
              <p className="text-indigo-100 text-sm mt-0.5">
                Sigue el avance del quórum en vivo, registra rondas de verificación de asistencia y genera el acta
                con resultados auditables; sellado opcional en Bitcoin (OpenTimestamps) para quien busca máxima trazabilidad.
              </p>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Cómo funciona (información funcional) */}
      <section className="bg-[#0B0E14] py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#C7C4D8]">Flujo</p>
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-[#E1E2EB] md:text-3xl">Cómo funciona</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center rounded-3xl bg-[#1D2026] p-6 text-center shadow-[0_24px_48px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-[#272A31]">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 opacity-90" style={{ backgroundColor: `${colorPrincipalHex}30` }}>
                <Building2 className="w-6 h-6" style={{ color: colorPrincipalHex }} />
              </div>
              <h3 className="text-lg font-semibold text-[#E1E2EB]">1. Crea tu conjunto</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#C7C4D8]">
                Registra tu edificio o conjunto. Luego carga las unidades (apartamentos, locales) con coeficientes y datos de contacto.
              </p>
            </div>
            <div className="flex flex-col items-center rounded-3xl bg-[#1D2026] p-6 text-center shadow-[0_24px_48px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-[#272A31]">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 opacity-90" style={{ backgroundColor: `${colorPrincipalHex}30` }}>
                <FileText className="w-6 h-6" style={{ color: colorPrincipalHex }} />
              </div>
              <h3 className="text-lg font-semibold text-[#E1E2EB]">2. Convoca la asamblea</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#C7C4D8]">
                Crea la asamblea, añade las preguntas a votar y activa la votación. Obtendrás un enlace y un código para compartir.
              </p>
            </div>
            <div className="flex flex-col items-center rounded-3xl bg-[#1D2026] p-6 text-center shadow-[0_24px_48px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-[#272A31]">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 opacity-90" style={{ backgroundColor: `${colorPrincipalHex}30` }}>
                <Users className="w-6 h-6" style={{ color: colorPrincipalHex }} />
              </div>
              <h3 className="text-lg font-semibold text-[#E1E2EB]">3. Los copropietarios votan</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#C7C4D8]">
                Cada propietario entra con su correo o teléfono, elige sus opciones y vota. Quórum y resultados en tiempo real (Ley 675).
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-center flex-wrap">
            <div className="flex items-center gap-2 text-[#C7C4D8]">
              <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm">Actas, certificados de voto y trazabilidad al cerrar</span>
            </div>
            <div className="flex items-center gap-2 text-[#C7C4D8]">
              <Shield className="w-5 h-5 text-purple-400 shrink-0" />
              <span className="text-sm">Datos por conjunto, consentimiento Ley 1581 y acceso seguro</span>
            </div>
            <div className="flex items-center gap-2 text-[#C7C4D8]">
              <Link2 className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-sm">Sello en blockchain Bitcoin (OpenTimestamps), sin costo extra</span>
            </div>
          </div>
        </div>
      </section>

      {/* Funciones destacadas (SEO + conversión): prioridad intención de búsqueda */}
      <section className="bg-[#191C22] py-14" aria-labelledby="landing-funciones-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#C7C4D8]">Capacidades</p>
          <h2
            id="landing-funciones-heading"
            className="mb-3 text-balance text-center text-2xl font-bold tracking-tight text-[#E1E2EB] md:text-3xl"
          >
            Plataforma completa para asambleas de copropiedad
          </h2>
          <p className="mx-auto mb-10 max-w-3xl text-center text-sm leading-relaxed text-[#C7C4D8] md:text-base">
            Lo esencial para cumplir con la Ley 675 de propiedad horizontal y ganar confianza de los copropietarios:
            desde la convocatoria hasta el acta y los poderes, con transparencia en cada paso.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <article className="flex flex-col rounded-3xl bg-[#1D2026] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-[#272A31]">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <Vote className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-[#E1E2EB]">Votación Ley 675</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[#C7C4D8]">
                Voto por <strong className="font-medium text-[#E1E2EB]">coeficiente de copropiedad</strong> o nominal; preguntas abiertas y cerradas,
                umbral de aprobación y resultados en tiempo real para el conjunto.
              </p>
            </article>
            <article className="flex flex-col rounded-3xl bg-[#1D2026] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-[#272A31]">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <UserCheck className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-[#E1E2EB]">Quórum y asistencia</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[#C7C4D8]">
                <strong className="font-medium text-[#E1E2EB]">Verificación de asistencia</strong> por ronda, estadísticas de quórum visibles
                y enlace para delegado en sala para registrar presencia cuando la mesa lo requiera.
              </p>
            </article>
            <article className="flex flex-col rounded-3xl bg-[#1D2026] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-[#272A31]">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <ScrollText className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-[#E1E2EB]">Poderes y apoderados</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[#C7C4D8]">
                Registro de <strong className="font-medium text-[#E1E2EB]">poderes de representación</strong>, límites configurables,
                documento adjunto y flujo donde el votante puede declarar un poder recibido para revisión del administrador.
              </p>
            </article>
            <article className="flex flex-col rounded-3xl bg-[#1D2026] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-[#272A31]">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <MessageCircle className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-[#E1E2EB]">WhatsApp y acceso rápido</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[#C7C4D8]">
                Invitaciones masivas con enlace de votación, <strong className="font-medium text-[#E1E2EB]">código de acceso</strong> y
                experiencia móvil clara para copropietarios que votan desde el celular.
              </p>
            </article>
            <article className="flex flex-col rounded-3xl bg-[#1D2026] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-[#272A31]">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <QrCode className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-[#E1E2EB]">QR en la sala</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[#C7C4D8]">
                <strong className="font-medium text-[#E1E2EB]">Código QR</strong> para compartir el ingreso a la votación en la asamblea presencial,
                sin fricción para quien aún no tiene el enlace a mano.
              </p>
            </article>
            <article className="flex flex-col rounded-3xl bg-[#1D2026] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-[#272A31]">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <Printer className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-[#E1E2EB]">Censo y respaldo en papel</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[#C7C4D8]">
                Importación de unidades y <strong className="font-medium text-[#E1E2EB]">PDF del censo</strong> con columna para firmas,
                útil si la mesa requiere constancia física de asistencia junto al registro digital.
              </p>
            </article>
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-[#C7C4D8]">
            Además: acta descargable, certificado de votos para el copropietario, sellado opcional del acta en blockchain (OpenTimestamps)
            y segregación de datos por conjunto para privacidad y cumplimiento del tratamiento de datos personales.
          </p>
        </div>
      </section>

      {/* Blockchain */}
      <section className="bg-[#0B0E14] py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8 rounded-3xl bg-[#1D2026] p-8 shadow-[0_24px_48px_rgba(0,0,0,0.35)] md:flex-row ring-1 ring-[#34d399]/20">
            <div className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <Link2 className="w-8 h-8" style={{ color: '#10b981' }} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start mb-2">
                <h3 className="text-lg font-bold text-[#E1E2EB]">Acta certificada en blockchain de Bitcoin</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>Gratis · Sin costo adicional</span>
              </div>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Al cerrar la asamblea, el acta se sella automáticamente en la blockchain de Bitcoin mediante{' '}
                <a
                  href="https://opentimestamps.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('underline rounded-sm', focusRing)}
                  style={{ color: '#34d399' }}
                >
                  OpenTimestamps
                </a>
                {' '}(tecnología abierta y gratuita). Esto garantiza que el contenido del acta no pueda ser alterado después de la votación: cualquier persona puede verificar la autenticidad de forma independiente.
              </p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Descarga el certificado <strong className="text-slate-300">.ots</strong> desde la página del acta y verifica en opentimestamps.org junto con el PDF.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contacto / CTA */}
      <section className="bg-[#191C22] py-14">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-6 leading-relaxed text-[#C7C4D8]">
            ¿Dudas? Escríbenos y te ayudamos a configurar tu primera asamblea.
          </p>
          {whatsappNumber && (
            <div className="mb-5">
              <Label htmlFor="nombre-conjunto-landing" className="text-xs text-[#C7C4D8]">
                Nombre de tu conjunto (opcional, se incluye en el mensaje)
              </Label>
              <Input
                id="nombre-conjunto-landing"
                placeholder="Ej. Conjunto Los Robles"
                value={nombreConjunto}
                onChange={(e) => setNombreConjunto(e.target.value)}
                className="mx-auto mt-1 block max-w-xs rounded-3xl border border-[#464555]/40 bg-[#32353C] text-sm text-[#E1E2EB] placeholder:text-[#918fa1] focus-visible:border-[#818cf8]/50 focus-visible:ring-2 focus-visible:ring-[#818cf8]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E14]"
              />
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
            <Link href="/login">
              <Button
                size="lg"
                className={cn('min-h-[3rem] w-full rounded-3xl border-0 shadow-xl shadow-black/40 transition-colors duration-200 sm:w-auto', focusRing)}
                style={primaryGradientStyle(colorPrincipalHex)}
              >
                Empezar ahora
              </Button>
            </Link>
            {whatsappNumber && (
              <a
                href={buildWhatsAppUrl(whatsappNumber, nombreConjunto)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex justify-center sm:justify-start"
                title="Abre WhatsApp con un mensaje de consulta listo para enviar"
              >
                <Button
                  size="lg"
                  className="rounded-3xl gap-2.5 w-full sm:w-auto min-h-[3rem] border-0 bg-[#25D366] text-white shadow-lg shadow-emerald-950/35 hover:bg-[#20bd5a] hover:text-white focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E14]"
                >
                  <WhatsAppGlyph className="w-5 h-5 shrink-0" />
                  <span className="font-semibold">{ctaWhatsappText}</span>
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Transparencia comercial y legal */}
      <section className="bg-[#0B0E14] py-12">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-[#E1E2EB]">Créditos y condiciones de uso</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#C7C4D8]">
            Algunas funciones usan créditos digitales (tokens) de la billetera del gestor; el consumo principal por votación pública se relaciona con la aceptación del tratamiento de datos (LOPD) por sesión, con franquicia por unidades según las reglas de la plataforma. Precios, consumos y vigencia del saldo están en los{' '}
            <Link
              href="/terminos"
              className={cn('rounded-sm text-[#a5b4fc] underline underline-offset-2 hover:text-[#E1E2EB]', focusRing)}
            >
              Términos y documentos legales
            </Link>
            .
          </p>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-[#191C22] py-16">
        <div className="mx-auto max-w-3xl rounded-3xl bg-[#1D2026] p-8 text-center shadow-[0_24px_48px_rgba(0,0,0,0.4)] px-4">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[#E1E2EB] md:text-3xl">¿Ya tienes cuenta?</h2>
          <p className="mb-6 leading-relaxed text-[#C7C4D8]">
            Accede al panel de administración para gestionar tus asambleas.
          </p>
          <Link href="/login">
            <Button
              size="lg"
              className={cn('min-h-[3rem] rounded-3xl border-0 shadow-xl shadow-black/40 transition-colors duration-200', focusRing)}
              style={primaryGradientStyle(colorPrincipalHex)}
            >
              Iniciar sesión
            </Button>
          </Link>
        </div>
      </section>

      <Script
        id="json-ld-software-asambleas"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Asambleas Online',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
              'Software para asambleas de copropiedad en Colombia: votación Ley 675, quórum, poderes, WhatsApp, acta digital y sellado blockchain.',
            offers: {
              '@type': 'Offer',
              availability: 'https://schema.org/InStock',
              url: publicSiteUrl(),
            },
            featureList: [
              'Votación por coeficiente o nominal según Ley 675',
              'Verificación de asistencia y quórum en tiempo real',
              'Poderes de representación y auditoría',
              'Invitaciones por WhatsApp y acceso con QR',
              'Acta digital y certificados de voto',
              'Sello de acta en blockchain OpenTimestamps',
            ],
          }),
        }}
      />

      <footer className="border-t border-[#464555]/25 bg-[#10131A] py-8 text-center text-sm text-[#C7C4D8]">
        <p className="mx-auto max-w-3xl px-4 leading-relaxed">
          Asambleas Online — Votaciones y actas para propiedad horizontal en Colombia (Ley 675, quórum, poderes y trazabilidad)
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link
            href="/terminos"
            className={cn('text-[#C7C4D8] underline underline-offset-2 transition-colors duration-200 hover:text-[#E1E2EB]', focusRing)}
          >
            Términos y políticas
          </Link>
          <Link
            href="/politica-privacidad"
            className={cn('text-[#C7C4D8] underline underline-offset-2 transition-colors duration-200 hover:text-[#E1E2EB]', focusRing)}
          >
            Política de Privacidad
          </Link>
          <a
            href="/EULA-Asambleas-App.txt"
            download
            className={cn('text-[#C7C4D8] underline underline-offset-2 transition-colors duration-200 hover:text-[#E1E2EB]', focusRing)}
          >
            Descargar EULA
          </a>
          <Link
            href="/epbco"
            className={cn('text-[#C7C4D8] underline underline-offset-2 transition-colors duration-200 hover:text-[#E1E2EB]', focusRing)}
          >
            EPBCO Solutions
          </Link>
        </p>
      </footer>
    </main>
  )
}
