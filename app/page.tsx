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
            <p className="mt-6 text-sm text-slate-400 max-w-2xl leading-relaxed">
              Censo con coeficientes, votación nominal o por coeficiente, control de quórum, poderes con auditoría,
              invitación masiva y acta descargable con opción de sellado en blockchain. Todo en un solo flujo pensado para Ley 675 y transparencia ante la copropiedad.
            </p>
          </div>
        </div>
      </header>

      {/* Valor: acta, quórum, blockchain */}
      <section className="border-b border-slate-800" style={{ backgroundColor: '#0B0E14' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
          <div className="rounded-3xl text-white shadow-lg py-6 px-6" style={{ backgroundColor: colorPrincipalHex }}>
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
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-center flex-wrap">
            <div className="flex items-center gap-2 text-slate-300">
              <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm">Actas, certificados de voto y trazabilidad al cerrar</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Shield className="w-5 h-5 text-purple-400 shrink-0" />
              <span className="text-sm">Datos por conjunto, consentimiento Ley 1581 y acceso seguro</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Link2 className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-sm">Sello en blockchain Bitcoin (OpenTimestamps), sin costo extra</span>
            </div>
          </div>
        </div>
      </section>

      {/* Funciones destacadas (SEO + conversión): prioridad intención de búsqueda */}
      <section
        className="py-14 border-b border-slate-800"
        style={{ backgroundColor: '#0B0E14' }}
        aria-labelledby="landing-funciones-heading"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="landing-funciones-heading" className="text-2xl md:text-3xl font-bold text-white text-center mb-3">
            Plataforma completa para asambleas de copropiedad
          </h2>
          <p className="text-center text-slate-400 text-sm md:text-base max-w-3xl mx-auto mb-10">
            Lo esencial para cumplir con la Ley 675 de propiedad horizontal y ganar confianza de los copropietarios:
            desde la convocatoria hasta el acta y los poderes, con transparencia en cada paso.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <article className="rounded-3xl bg-slate-800/50 border p-6 shadow-lg flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <Vote className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="font-semibold text-white text-lg">Votación Ley 675</h3>
              <p className="text-sm text-slate-400 mt-2 flex-1 leading-relaxed">
                Voto por <strong className="text-slate-300">coeficiente de copropiedad</strong> o nominal; preguntas abiertas y cerradas,
                umbral de aprobación y resultados en tiempo real para el conjunto.
              </p>
            </article>
            <article className="rounded-3xl bg-slate-800/50 border p-6 shadow-lg flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <UserCheck className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="font-semibold text-white text-lg">Quórum y asistencia</h3>
              <p className="text-sm text-slate-400 mt-2 flex-1 leading-relaxed">
                <strong className="text-slate-300">Verificación de asistencia</strong> por ronda, estadísticas de quórum visibles
                y enlace para delegado en sala para registrar presencia cuando la mesa lo requiera.
              </p>
            </article>
            <article className="rounded-3xl bg-slate-800/50 border p-6 shadow-lg flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <ScrollText className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="font-semibold text-white text-lg">Poderes y apoderados</h3>
              <p className="text-sm text-slate-400 mt-2 flex-1 leading-relaxed">
                Registro de <strong className="text-slate-300">poderes de representación</strong>, límites configurables,
                documento adjunto y flujo donde el votante puede declarar un poder recibido para revisión del administrador.
              </p>
            </article>
            <article className="rounded-3xl bg-slate-800/50 border p-6 shadow-lg flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <MessageCircle className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="font-semibold text-white text-lg">WhatsApp y acceso rápido</h3>
              <p className="text-sm text-slate-400 mt-2 flex-1 leading-relaxed">
                Invitaciones masivas con enlace de votación, <strong className="text-slate-300">código de acceso</strong> y
                experiencia móvil clara para copropietarios que votan desde el celular.
              </p>
            </article>
            <article className="rounded-3xl bg-slate-800/50 border p-6 shadow-lg flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <QrCode className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="font-semibold text-white text-lg">QR en la sala</h3>
              <p className="text-sm text-slate-400 mt-2 flex-1 leading-relaxed">
                <strong className="text-slate-300">Código QR</strong> para compartir el ingreso a la votación en la asamblea presencial,
                sin fricción para quien aún no tiene el enlace a mano.
              </p>
            </article>
            <article className="rounded-3xl bg-slate-800/50 border p-6 shadow-lg flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colorPrincipalHex}28` }}>
                <Printer className="w-5 h-5" style={{ color: colorPrincipalHex }} aria-hidden />
              </div>
              <h3 className="font-semibold text-white text-lg">Censo y respaldo en papel</h3>
              <p className="text-sm text-slate-400 mt-2 flex-1 leading-relaxed">
                Importación de unidades y <strong className="text-slate-300">PDF del censo</strong> con columna para firmas,
                útil si la mesa requiere constancia física de asistencia junto al registro digital.
              </p>
            </article>
          </div>
          <p className="mt-10 text-center text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Además: acta descargable, certificado de votos para el copropietario, sellado opcional del acta en blockchain (OpenTimestamps)
            y segregación de datos por conjunto para privacidad y cumplimiento del tratamiento de datos personales.
          </p>
        </div>
      </section>

      {/* Blockchain */}
      <section className="py-14 border-b border-slate-800" style={{ backgroundColor: '#0B0E14' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border p-8 flex flex-col md:flex-row items-center gap-8" style={{ borderColor: '#10b981', background: 'rgba(16,185,129,0.06)' }}>
            <div className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <Link2 className="w-8 h-8" style={{ color: '#10b981' }} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start mb-2">
                <h3 className="text-lg font-bold text-white">Acta certificada en blockchain de Bitcoin</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>Gratis · Sin costo adicional</span>
              </div>
              <p className="text-sm text-slate-400 max-w-2xl">
                Al cerrar la asamblea, el acta se sella automáticamente en la blockchain de Bitcoin mediante{' '}
                <a href="https://opentimestamps.org" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#34d399' }}>OpenTimestamps</a>
                {' '}(tecnología abierta y gratuita). Esto garantiza que el contenido del acta no pueda ser alterado después de la votación: cualquier persona puede verificar la autenticidad de forma independiente.
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Descarga el certificado <strong className="text-slate-400">.ots</strong> desde la página del acta y verifica en opentimestamps.org junto con el PDF.
              </p>
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
          {whatsappNumber && (
            <div className="mb-5">
              <Label htmlFor="nombre-conjunto-landing" className="text-xs text-slate-400">
                Nombre de tu conjunto (opcional, se incluye en el mensaje)
              </Label>
              <Input
                id="nombre-conjunto-landing"
                placeholder="Ej. Conjunto Los Robles"
                value={nombreConjunto}
                onChange={(e) => setNombreConjunto(e.target.value)}
                className="mt-1 rounded-3xl text-sm bg-slate-800/80 border-white/20 text-white placeholder:text-slate-500 max-w-xs mx-auto block"
              />
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
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
      <section className="py-12 border-b border-slate-800" style={{ backgroundColor: '#0B0E14' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-lg font-semibold text-white">Créditos y condiciones de uso</h2>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">
            Algunas funciones usan créditos digitales (tokens) de la billetera del gestor; el consumo principal por votación pública se relaciona con la aceptación del tratamiento de datos (LOPD) por sesión, con franquicia por unidades según las reglas de la plataforma. Precios, consumos y vigencia del saldo están en los{' '}
            <Link href="/terminos" className="text-indigo-300 hover:text-white underline underline-offset-2">
              Términos y documentos legales
            </Link>
            .
          </p>
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

      <footer className="py-6 border-t border-slate-800 text-center text-sm text-slate-500" style={{ backgroundColor: '#0B0E14' }}>
        <p>
          Asambleas Online — Votaciones y actas para propiedad horizontal en Colombia (Ley 675, quórum, poderes y trazabilidad)
        </p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/terminos" className="text-slate-400 hover:text-white transition-colors underline underline-offset-2">
            Términos y políticas
          </Link>
          <Link href="/politica-privacidad" className="text-slate-400 hover:text-white transition-colors underline underline-offset-2">
            Política de Privacidad
          </Link>
          <a
            href="/EULA-Asambleas-App.txt"
            download
            className="text-slate-400 hover:text-white transition-colors underline underline-offset-2"
          >
            Descargar EULA
          </a>
          <Link href="/epbco" className="text-slate-400 hover:text-white transition-colors underline underline-offset-2">
            EPBCO Solutions
          </Link>
        </p>
      </footer>
    </main>
  )
}
