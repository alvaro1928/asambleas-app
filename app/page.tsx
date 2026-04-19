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
  QrCode,
  Printer,
  Play,
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

function publicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) return 'https://asambleas.online'
  return raw.startsWith('http') ? raw.replace(/\/$/, '') : `https://${raw.replace(/\/$/, '')}`
}

/** Título tipo Stitch: primera parte + segunda en itálica con acento de marca (solo si hay “:”). */
function HeroTitle({ titulo, accent }: { titulo: string; accent: string }) {
  const i = titulo.indexOf(':')
  if (i === -1) {
    return <>{titulo}</>
  }
  const a = titulo.slice(0, i + 1).trim()
  const b = titulo.slice(i + 1).trim()
  return (
    <>
      {a}{' '}
      <span className="italic" style={{ color: accent }}>
        {b}
      </span>
    </>
  )
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
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            titulo?: string | null
            subtitulo?: string | null
            whatsapp_number?: string | null
            color_principal_hex?: string | null
            cta_whatsapp_text?: string | null
          } | null
        ) => {
          if (data?.titulo) setTitulo(data.titulo)
          if (data?.subtitulo) setSubtitulo(data.subtitulo)
          if (data?.whatsapp_number) setWhatsappNumber(data.whatsapp_number)
          if (data?.color_principal_hex && /^#[0-9A-Fa-f]{6}$/.test(data.color_principal_hex))
            setColorPrincipalHex(data.color_principal_hex)
          if (data?.cta_whatsapp_text) setCtaWhatsappText(data.cta_whatsapp_text)
        }
      )
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined' && colorPrincipalHex) {
      document.documentElement.style.setProperty('--color-primary', colorPrincipalHex)
    }
  }, [colorPrincipalHex])

  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338ca] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f9ff]'

  const primarySolid: CSSProperties = { backgroundColor: colorPrincipalHex, color: '#fff' }

  return (
    <main
      id="contenido-principal"
      className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] antialiased selection:bg-[#4338ca]/25 selection:text-[#0b1c30]"
    >
      <a
        href="#inicio-landing"
        className={cn(
          'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-[#0b1c30] focus:shadow-lg',
          focusRing
        )}
      >
        Saltar al contenido
      </a>

      {/* Nav — layout tipo export Stitch (fijo, vidrio) */}
      <nav
        aria-label="Principal"
        className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-none bg-white/80 px-6 py-5 shadow-[0_20px_40px_rgba(11,28,48,0.05)] backdrop-blur-md md:px-12"
      >
        <Link
          href="/"
          className="font-inter text-xl font-extrabold tracking-tighter text-indigo-700"
          style={{ fontFamily: 'inherit' }}
        >
          Asambleas Online
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#funciones"
            className="border-b-2 border-indigo-700 text-sm font-bold tracking-tight text-indigo-700 transition-colors duration-200"
          >
            Plataforma
          </a>
          <a
            href="#como-funciona"
            className="text-sm font-medium tracking-tight text-slate-600 transition-colors duration-200 hover:text-indigo-600"
          >
            Cómo funciona
          </a>
          <a
            href="#blockchain"
            className="text-sm font-medium tracking-tight text-slate-600 transition-colors duration-200 hover:text-indigo-600"
          >
            Blockchain
          </a>
          <Link
            href="/terminos"
            className="text-sm font-medium tracking-tight text-slate-600 transition-colors duration-200 hover:text-indigo-600"
          >
            Legal
          </Link>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/login"
            className="hidden px-2 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 sm:inline"
          >
            Acceso
          </Link>
          <Link href="/login">
            <button
              type="button"
              className={cn(
                'landing-primary-gradient scale-95 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-transform active:scale-90',
                focusRing
              )}
            >
              Comenzar
            </button>
          </Link>
        </div>
      </nav>

      <div className="pt-24">
        {/* Hero — rejilla Stitch; textos reales desde API / copy existente */}
        <header
          id="inicio-landing"
          className="relative flex min-h-[640px] items-center overflow-hidden bg-[#f8f9ff] px-6 md:min-h-[780px] lg:px-12"
        >
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="flex flex-col justify-center space-y-8 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#e3dfff] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#372abf]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#2a14b4]" aria-hidden />
                Certificado Ley 675
              </div>
              <div className="flex justify-center lg:justify-start">
                <div className="relative mb-2 h-20 w-20 overflow-hidden rounded-full shadow-lg ring-2 ring-indigo-100 md:h-24 md:w-24">
                  {!logoError ? (
                    <Image
                      src="/logo.png"
                      alt="VOTA TECH - Soluciones Comunitarias Digitales"
                      width={96}
                      height={96}
                      className="h-full w-full bg-white object-contain"
                      priority
                      unoptimized
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center" style={primarySolid}>
                      <Building2 className="h-10 w-10 text-white" aria-hidden />
                    </div>
                  )}
                </div>
              </div>
              <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tighter text-[#0b1c30] md:text-6xl lg:text-7xl">
                <HeroTitle titulo={titulo || 'Asambleas digitales para propiedad horizontal'} accent={colorPrincipalHex} />
              </h1>
              <p className="max-w-xl text-xl leading-relaxed text-[#464554]">
                {subtitulo ||
                  'Votaciones en tiempo real, actas y auditoría. Pensado para administradores y consejos de administración.'}
              </p>
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <Link href="/login">
                  <button
                    type="button"
                    className={cn(
                      'landing-primary-gradient rounded-xl px-8 py-4 text-lg font-bold text-white shadow-xl transition-all hover:shadow-indigo-500/20 active:scale-95',
                      focusRing
                    )}
                  >
                    Empezar ahora
                  </button>
                </Link>
                <a
                  href="#como-funciona"
                  className="group flex items-center gap-3 font-semibold text-[#0b1c30]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dce9ff] transition-all group-hover:bg-[#4338ca] group-hover:text-white">
                    <Play className="h-6 w-6 fill-current pl-0.5" aria-hidden />
                  </span>
                  Ver cómo funciona
                </a>
              </div>
            </div>

            {/* Panel decorativo (sin datos reales ni métricas inventadas) */}
            <div className="relative lg:col-span-5" aria-hidden>
              <div className="landing-dark-panel-gradient relative z-10 scale-100 rounded-[2rem] border border-white/10 p-6 shadow-2xl lg:scale-105">
                <div className="mb-8 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-white/40">Vista del panel</p>
                    <h3 className="text-lg font-bold text-white">Su asamblea en curso</h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-bold text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Tiempo real
                  </div>
                </div>
                <p className="mb-6 text-center text-[10px] text-white/45">
                  Ilustración: no muestra datos de un conjunto real.
                </p>
                <div className="mb-8 grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                    <p className="mb-1 text-[10px] uppercase text-white/40">Quórum</p>
                    <p className="text-2xl font-black text-white">—</p>
                    <p className="mt-1 text-[10px] text-white/50">Según censo y coeficientes</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                    <p className="mb-1 text-[10px] uppercase text-white/40">Participación</p>
                    <p className="text-2xl font-black text-white">—</p>
                    <p className="mt-1 text-[10px] text-white/50">Votos registrados en la sesión</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] uppercase text-white/60">
                    <span>Distribución ilustrativa</span>
                    <span className="font-bold text-white">Por pregunta</span>
                  </div>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
                    <div className="h-full w-1/3 bg-[#4338ca]" />
                    <div className="h-full w-1/3 bg-[#8f3400]" />
                    <div className="h-full w-1/3 bg-white/15" />
                  </div>
                  <div className="flex gap-4 pt-2">
                    <span className="flex items-center gap-2 text-[9px] text-white/40">
                      <span className="h-2 w-2 rounded-sm bg-[#4338ca]" /> Opción A
                    </span>
                    <span className="flex items-center gap-2 text-[9px] text-white/40">
                      <span className="h-2 w-2 rounded-sm bg-[#8f3400]" /> Opción B
                    </span>
                    <span className="flex items-center gap-2 text-[9px] text-white/40">
                      <span className="h-2 w-2 rounded-sm bg-white/20" /> Abstención
                    </span>
                  </div>
                </div>
                <div className="absolute -right-4 -top-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#4338ca]/30 backdrop-blur-md">
                  <Shield className="h-6 w-6 text-white" aria-hidden />
                </div>
              </div>
              <div className="absolute left-1/2 top-1/2 -z-10 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2a14b4]/5 blur-[100px]" />
            </div>
          </div>
        </header>

        {/* Valor (texto real ya usado en tests) */}
        <section className="px-6 py-10 lg:px-12">
          <div
            className="mx-auto max-w-7xl rounded-[2rem] px-6 py-8 text-white shadow-xl sm:px-10"
            style={primarySolid}
          >
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <Zap className="h-10 w-10 shrink-0 text-indigo-200" aria-hidden />
              <div>
                <p className="text-lg font-semibold">
                  Quórum, asistencia verificable y acta lista al cierre — con respaldo en blockchain
                </p>
                <p className="mt-1 text-sm text-indigo-100">
                  Sigue el avance del quórum en vivo, registra rondas de verificación de asistencia y genera el acta
                  con resultados auditables; sellado opcional en Bitcoin (OpenTimestamps) para quien busca máxima
                  trazabilidad.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bento — funciones reales del producto */}
        <section id="funciones" className="bg-[#eff4ff] px-6 py-24 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2a14b4]">Plataforma</p>
              <h2 className="text-4xl font-extrabold tracking-tighter text-[#0b1c30] md:text-5xl">
                Gobernanza clara para su copropiedad
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="flex min-h-[380px] flex-col justify-between rounded-[2rem] bg-white p-10 shadow-[0_20px_40px_rgba(11,28,48,0.05)] md:col-span-2">
                <div className="flex items-start justify-between">
                  <div className="rounded-2xl bg-[#e3dfff] p-4 text-[#2a14b4]">
                    <Vote className="h-8 w-8" aria-hidden />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#464554]/50">
                    Ley 675
                  </span>
                </div>
                <div className="space-y-4">
                  <h3 className="text-3xl font-bold tracking-tight">Votación conforme a la norma</h3>
                  <p className="max-w-md text-lg text-[#464554]">
                    Voto por coeficiente de copropiedad o nominal; preguntas abiertas y cerradas, umbral de aprobación
                    y resultados en tiempo real para el conjunto.
                  </p>
                </div>
              </div>

              <div
                className="flex flex-col justify-between overflow-hidden rounded-[2rem] p-10 text-white shadow-xl"
                style={primarySolid}
              >
                <div className="relative z-10">
                  <div className="mb-8 inline-block rounded-2xl bg-white/10 p-4">
                    <UserCheck className="h-8 w-8" aria-hidden />
                  </div>
                  <h3 className="mb-4 text-2xl font-bold">Quórum y asistencia</h3>
                  <p className="text-sm text-white/80">
                    Verificación de asistencia por ronda, estadísticas de quórum visibles y enlace para delegado en sala
                    cuando la mesa lo requiera.
                  </p>
                </div>
                <Users
                  className="pointer-events-none absolute -bottom-10 -right-10 h-[200px] w-[200px] opacity-10"
                  aria-hidden
                />
              </div>

              <div id="blockchain" className="space-y-6 rounded-[2rem] bg-white p-8 shadow-[0_20px_40px_rgba(11,28,48,0.05)]">
                <div className="inline-block rounded-xl bg-[#ffdbcd] p-3 text-[#692400]">
                  <Link2 className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-xl font-bold">Trazabilidad OpenTimestamps</h3>
                <p className="text-sm text-[#464554]">
                  Sello opcional del acta en la blockchain de Bitcoin mediante OpenTimestamps.{' '}
                  <span className="font-semibold text-emerald-700">Gratis · Sin costo adicional</span>
                </p>
              </div>

              <div className="flex items-center gap-10 overflow-hidden rounded-[2rem] bg-white p-8 shadow-[0_20px_40px_rgba(11,28,48,0.05)] md:col-span-2">
                <div className="flex-1 space-y-4">
                  <h3 className="text-xl font-bold">Actas y documentos</h3>
                  <p className="text-sm text-[#464554]">
                    Acta descargable, certificados de voto para el copropietario y exportación pensada para auditoría.
                    Datos segregados por conjunto y tratamiento según consentimiento (Ley 1581).
                  </p>
                </div>
                <div className="flex aspect-square w-1/3 max-w-[140px] items-center justify-center rounded-2xl bg-[#e5eeff]">
                  <FileText className="h-16 w-16 text-[#4338ca]" aria-hidden />
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: MessageCircle,
                  t: 'WhatsApp y acceso',
                  d: 'Invitaciones con enlace de votación, código de acceso y experiencia móvil clara.',
                },
                {
                  icon: QrCode,
                  t: 'QR en sala',
                  d: 'Código QR para compartir el ingreso a la votación en la asamblea presencial.',
                },
                {
                  icon: Printer,
                  t: 'Censo e impresión',
                  d: 'Importación de unidades y PDF del censo con columna para firmas cuando la mesa lo requiera.',
                },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="rounded-2xl border border-[#c7c4d7]/60 bg-[#f8f9ff] p-6">
                  <Icon className="mb-3 h-6 w-6 text-[#4338ca]" aria-hidden />
                  <h4 className="font-bold text-[#0b1c30]">{t}</h4>
                  <p className="mt-2 text-sm text-[#464554]">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="bg-[#f8f9ff] px-6 py-24 lg:px-12">
          <div className="mx-auto mb-20 max-w-7xl text-center">
            <h2 className="mb-6 text-4xl font-extrabold tracking-tighter text-[#0b1c30] md:text-5xl">¿Cómo funciona?</h2>
            <p className="mx-auto max-w-2xl text-lg text-[#464554]">
              Tres pasos para convocar, votar y cerrar con acta, con las funciones que ya tiene la plataforma.
            </p>
          </div>
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-16 md:grid-cols-3">
            {[
              {
                n: '01',
                t: 'Crea tu conjunto',
                p: 'Registra tu edificio o conjunto. Carga las unidades con coeficientes y datos de contacto.',
              },
              {
                n: '02',
                t: 'Convoca la asamblea',
                p: 'Crea la asamblea, añade las preguntas y activa la votación. Comparte enlace y código.',
              },
              {
                n: '03',
                t: 'Los copropietarios votan',
                p: 'Cada propietario entra con correo o teléfono y vota. Quórum y resultados en tiempo real (Ley 675).',
              },
            ].map((step) => (
              <div key={step.n} className="group relative">
                <div className="absolute -left-8 -top-16 -z-10 text-[120px] font-black text-[#dce9ff] transition-colors group-hover:text-[#e3dfff]">
                  {step.n}
                </div>
                <div className="space-y-6">
                  <h4 className="text-2xl font-bold">{step.t}</h4>
                  <p className="leading-relaxed text-[#464554]">{step.p}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-14 flex max-w-4xl flex-col flex-wrap items-center justify-center gap-4 text-center sm:flex-row sm:gap-8">
            <div className="flex items-center gap-2 text-[#0b1c30]">
              <FileText className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <span className="text-sm">Actas, certificados de voto y trazabilidad al cerrar</span>
            </div>
            <div className="flex items-center gap-2 text-[#0b1c30]">
              <Shield className="h-5 w-5 shrink-0 text-purple-600" aria-hidden />
              <span className="text-sm">Datos por conjunto, consentimiento Ley 1581 y acceso seguro</span>
            </div>
            <div className="flex items-center gap-2 text-[#0b1c30]">
              <Link2 className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <span className="text-sm">Sello en blockchain Bitcoin (OpenTimestamps), sin costo extra</span>
            </div>
          </div>
        </section>

        {/* Contacto */}
        <section id="contacto" className="px-6 py-20 lg:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-6 text-lg text-[#464554]">
              ¿Dudas? Escríbenos y te ayudamos a configurar tu primera asamblea.
            </p>
            {whatsappNumber && (
              <div className="mb-6">
                <Label htmlFor="nombre-conjunto-landing" className="text-xs text-[#464554]">
                  Nombre de tu conjunto (opcional)
                </Label>
                <Input
                  id="nombre-conjunto-landing"
                  placeholder="Ej. Conjunto Los Robles"
                  value={nombreConjunto}
                  onChange={(e) => setNombreConjunto(e.target.value)}
                  className="mx-auto mt-2 block max-w-xs rounded-2xl border-[#c7c4d7] bg-white"
                />
              </div>
            )}
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link href="/login">
                <Button
                  size="lg"
                  className={cn(
                    'landing-primary-gradient h-12 w-full rounded-xl border-0 px-8 text-base font-bold text-white shadow-lg sm:w-auto',
                    focusRing
                  )}
                >
                  Empezar ahora
                </Button>
              </Link>
              {whatsappNumber && (
                <a
                  href={buildWhatsAppUrl(whatsappNumber, nombreConjunto)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full justify-center sm:w-auto"
                >
                  <Button
                    size="lg"
                    className="h-12 w-full gap-2 rounded-xl border-0 bg-[#25D366] px-8 text-base font-semibold text-white hover:bg-[#20bd5a] sm:w-auto"
                  >
                    <WhatsAppGlyph className="h-5 w-5 shrink-0" />
                    {ctaWhatsappText}
                  </Button>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Créditos */}
        <section className="px-6 pb-12 lg:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-lg font-semibold text-[#0b1c30]">Créditos y condiciones de uso</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#464554]">
              Algunas funciones usan créditos digitales (tokens) de la billetera del gestor. Precios y reglas en los{' '}
              <Link href="/terminos" className={cn('font-medium text-[#4338ca] underline underline-offset-2', focusRing)}>
                Términos y documentos legales
              </Link>
              .
            </p>
          </div>
        </section>

        {/* CTA ancho — forma Stitch */}
        <section className="px-6 pb-24 lg:px-12">
          <div className="landing-primary-gradient relative mx-auto flex max-w-7xl flex-col items-center justify-between gap-12 overflow-hidden rounded-[3rem] p-12 md:flex-row md:p-16 lg:p-24">
            <div className="relative z-10 max-w-xl space-y-6">
              <h2 className="text-4xl font-black leading-tight text-white md:text-5xl">
                ¿Listo para organizar su próxima asamblea?
              </h2>
              <p className="text-lg text-white/85">
                Cree el conjunto en el panel, cargue unidades y convoque la votación con los canales que ya usa la
                plataforma (enlace, código, WhatsApp, QR).
              </p>
            </div>
            <div className="relative z-10 flex w-full flex-col gap-4 md:w-auto">
              <Link href="/login" className="w-full md:w-auto">
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-2xl bg-white px-10 py-5 text-xl font-bold text-[#4338ca] shadow-2xl transition-all hover:bg-[#eff4ff]',
                    focusRing
                  )}
                >
                  Ir al panel
                </button>
              </Link>
              <p className="text-center text-sm text-white/65">Acceso con su cuenta de administrador</p>
            </div>
            <div className="absolute -right-48 -top-48 h-96 w-96 rounded-full bg-white/10 blur-[80px]" aria-hidden />
            <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-black/10 blur-[50px]" aria-hidden />
          </div>
        </section>
      </div>

      <footer className="flex w-full flex-col items-center justify-between gap-8 border-t border-slate-200 bg-slate-50 px-6 py-12 md:flex-row md:px-12">
        <div className="space-y-2 text-center md:text-left">
          <div className="text-lg font-bold text-slate-900">Asambleas Online</div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Votaciones y actas para propiedad horizontal en Colombia (Ley 675, quórum, poderes y trazabilidad)
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          <Link
            href="/politica-privacidad"
            className="text-xs uppercase tracking-widest text-slate-500 underline-offset-4 transition-opacity hover:text-indigo-600 hover:underline"
          >
            Privacidad
          </Link>
          <Link
            href="/terminos"
            className="text-xs uppercase tracking-widest text-slate-500 underline-offset-4 transition-opacity hover:text-indigo-600 hover:underline"
          >
            Términos
          </Link>
          <a
            href="/EULA-Asambleas-App.txt"
            download
            className="text-xs uppercase tracking-widest text-slate-500 underline-offset-4 transition-opacity hover:text-indigo-600 hover:underline"
          >
            EULA
          </Link>
          <Link
            href="/epbco"
            className="text-xs uppercase tracking-widest text-slate-500 underline-offset-4 transition-opacity hover:text-indigo-600 hover:underline"
          >
            EPBCO
          </Link>
        </div>
      </footer>

      <div className="border-t border-slate-200 bg-slate-50 py-6 text-center">
        <Link href="/login" className={cn('text-sm font-medium text-[#4338ca] hover:underline', focusRing)}>
          Iniciar sesión
        </Link>
      </div>

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
    </main>
  )
}
