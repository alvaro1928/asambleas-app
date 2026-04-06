'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { FileText, Vote, ChevronRight, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RegistroPoderPublicoForm, type UnidadInfoRegistroPoder } from '@/components/RegistroPoderPublicoForm'
import { normalizeCodigoAccesoFromUrl } from '@/lib/codigoAcceso'
import { normDoc, normPhone } from '@/lib/votar-identificador'

/** Apoderado externo: al menos cédula o celular; el identificador de sesión prioriza celular (para ingreso al votar). */
function resolverIdentificadorExterno(
  cedula: string,
  celular: string
): { ok: true; value: string } | { ok: false; message: string } {
  const tel = normPhone(celular)
  const doc = normDoc(cedula)
  if (tel.length >= 7) return { ok: true, value: tel }
  if (doc.length >= 4) return { ok: true, value: doc }
  if (cedula.trim() || celular.trim()) {
    return {
      ok: false,
      message:
        'Revisa el celular (mínimo 7 dígitos) o la cédula (mínimo 4 caracteres). Debes indicar al menos uno de los dos.',
    }
  }
  return { ok: false, message: 'Indica tu número de celular y/o tu cédula. Necesitamos al menos uno para validarte cuando el poder esté activo.' }
}

type Step = 'validando' | 'error' | 'email' | 'consentimiento' | 'form'

interface AsambleaInfo {
  asamblea_id: string
  nombre: string
  fecha: string
  organization_id: string
  nombre_conjunto: string
  acceso_valido: boolean
  mensaje: string
  participacion_timer_end_at?: string | null
  participacion_timer_default_minutes?: number
  participacion_timer_enabled?: boolean | null
  session_mode?: string
  session_seq?: number
  registro_poderes_publico?: boolean
}

const STORAGE_EMAIL = (c: string) => `registrar_poder_email_${c}`
const STORAGE_SESSION = (c: string) => `registrar_poder_session_${c}`
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

type Stored = { step: 'form' | 'consentimiento'; consentOk: boolean; ts: number }

function mensajeErrorAmigable(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('desactivado') && m.includes('acceso')) return msg
  if (m.includes('código') && m.includes('inválido')) return 'El código de acceso no es válido.'
  return msg
}

export default function RegistrarPoderPublicoPage() {
  const params = useParams()
  const rawCodigo = typeof params?.codigo === 'string' ? params.codigo : ''
  const codigo = normalizeCodigoAccesoFromUrl(rawCodigo)

  const [step, setStep] = useState<Step>('validando')
  const [error, setError] = useState('')
  const [asamblea, setAsamblea] = useState<AsambleaInfo | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [unidades, setUnidades] = useState<UnidadInfoRegistroPoder[]>([])
  const [consentimientoAceptado, setConsentimientoAceptado] = useState(false)
  const [guardandoConsentimiento, setGuardandoConsentimiento] = useState(false)
  const [clientIp, setClientIp] = useState<string | null>(null)
  /** Apoderado que no figura en el censo: LOPD + solicitud pendiente con nombre propio */
  const [modoRegistroExterno, setModoRegistroExterno] = useState(false)
  /** Solo modo externo: contacto obligatorio (al menos uno) para trazabilidad y acceso al activar el poder */
  const [cedulaExterna, setCedulaExterna] = useState('')
  const [celularExterna, setCelularExterna] = useState('')

  const formatFecha = (fecha: string) => {
    const date = new Date(fecha + 'T00:00:00')
    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const interpretarFila = (row: Record<string, unknown>): AsambleaInfo => ({
    asamblea_id: String(row.asamblea_id ?? ''),
    nombre: String(row.nombre ?? ''),
    fecha: String(row.fecha ?? ''),
    organization_id: String(row.organization_id ?? ''),
    nombre_conjunto: String(row.nombre_conjunto ?? ''),
    acceso_valido: !!row.acceso_valido,
    mensaje: String(row.mensaje ?? ''),
    participacion_timer_end_at: (row.participacion_timer_end_at as string | null | undefined) ?? null,
    participacion_timer_default_minutes: Number(row.participacion_timer_default_minutes ?? 5) || 5,
    participacion_timer_enabled: row.participacion_timer_enabled as boolean | null | undefined,
    session_mode: String(row.session_mode ?? 'inactive'),
    session_seq: Number(row.session_seq ?? 1) || 1,
    registro_poderes_publico: !!row.registro_poderes_publico,
  })

  const validarCodigo = useCallback(async () => {
    if (!codigo) {
      setStep('error')
      setError('Código no válido en la URL.')
      return
    }
    try {
      const res = await fetch('/api/registrar-poder/validar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
        cache: 'no-store',
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        asamblea?: Record<string, unknown>
        mensaje?: string
        error?: string
      }
      if (!res.ok || !json.ok || !json.asamblea) {
        setError(mensajeErrorAmigable(json.mensaje || json.error || 'Acceso denegado'))
        setStep('error')
        return
      }
      const info = interpretarFila(json.asamblea)
      setAsamblea(info)
      setStep('email')
      try {
        const guardado = typeof window !== 'undefined' && localStorage.getItem(STORAGE_EMAIL(codigo))
        if (guardado) setEmail(guardado)
      } catch {
        /* ignore */
      }
    } catch {
      setError('Error al validar el código.')
      setStep('error')
    }
  }, [codigo])

  useEffect(() => {
    void validarCodigo()
  }, [validarCodigo])

  const refrescarUnidades = async (identificadorOverride?: string): Promise<UnidadInfoRegistroPoder[]> => {
    const identificador = (identificadorOverride ?? email).trim().toLowerCase()
    const res = await fetch('/api/votar/validar-identificador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ codigo, identificador }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || 'No se pudo validar el identificador')
    }
    if (!(data as { puede_votar?: boolean }).puede_votar || !Array.isArray((data as { unidades?: unknown }).unidades)) {
      return []
    }
    const list = (data as { unidades: UnidadInfoRegistroPoder[] }).unidades
    setUnidades(list)
    return list
  }

  const readStoredSession = (): Stored | null => {
    try {
      const raw = localStorage.getItem(STORAGE_SESSION(codigo))
      if (!raw) return null
      const p = JSON.parse(raw) as Stored
      if (!p.ts || Date.now() - p.ts > SESSION_TTL_MS) return null
      return p
    } catch {
      return null
    }
  }

  const saveStoredSession = (s: Stored) => {
    try {
      localStorage.setItem(STORAGE_SESSION(codigo), JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }

  const handleValidarEmail = async () => {
    setLoading(true)
    setError('')
    let ident = ''
    if (modoRegistroExterno) {
      const res = resolverIdentificadorExterno(cedulaExterna, celularExterna)
      if (!res.ok) {
        setError(res.message)
        setLoading(false)
        return
      }
      ident = res.value
      setEmail(ident)
    } else {
      if (!email.trim()) {
        setError('Por favor ingresa tu email o número de teléfono')
        setLoading(false)
        return
      }
      ident = email.trim().toLowerCase()
    }
    try {
      let unidadesConInfo: UnidadInfoRegistroPoder[] = []
      if (modoRegistroExterno) {
        setUnidades([])
        unidadesConInfo = []
      } else {
        unidadesConInfo = await refrescarUnidades(ident)
        if (unidadesConInfo.length === 0) {
          setError(
            'No se encontraron unidades para este email o teléfono. Si eres apoderado pero no figuras en el censo, usa la opción de abajo.'
          )
          setLoading(false)
          return
        }
      }
      try {
        if (typeof window !== 'undefined') localStorage.setItem(STORAGE_EMAIL(codigo), ident)
      } catch {
        /* ignore */
      }
      try {
        const res = await fetch('/api/client-info', { credentials: 'include' })
        const info = await res.json()
        if (info?.ip) setClientIp(info.ip)
      } catch {
        /* ignore */
      }

      const identificador = ident
      const consentRes = await fetch(
        `/api/votar/consentimiento?codigo=${encodeURIComponent(codigo)}&identificador=${encodeURIComponent(identificador)}`,
        { credentials: 'include' }
      )
      const consentData = consentRes.ok ? await consentRes.json().catch(() => ({})) : {}
      if ((consentData as { accepted?: boolean }).accepted) {
        saveStoredSession({ step: 'form', consentOk: true, ts: Date.now() })
        setStep('form')
      } else {
        saveStoredSession({ step: 'consentimiento', consentOk: false, ts: Date.now() })
        setConsentimientoAceptado(false)
        setStep('consentimiento')
      }
    } catch (e: unknown) {
      setError(mensajeErrorAmigable(e instanceof Error ? e.message : 'Error al validar'))
    } finally {
      setLoading(false)
    }
  }

  const handleAceptarConsentimiento = async () => {
    if (!consentimientoAceptado || !email.trim()) return
    setGuardandoConsentimiento(true)
    setError('')
    try {
      const identificador = modoRegistroExterno ? email.trim() : email.trim().toLowerCase()
      const res = await fetch('/api/votar/consentimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          codigo,
          identificador,
          ip: clientIp ?? undefined,
          contexto: 'registro_poderes',
          registro_externo: modoRegistroExterno,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(typeof data.error === 'string' ? data.error : 'Error al registrar la aceptación')
        return
      }
      saveStoredSession({ step: 'form', consentOk: true, ts: Date.now() })
      setStep('form')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al continuar')
    } finally {
      setGuardandoConsentimiento(false)
    }
  }

  if (step === 'validando') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Validando código…</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">No se pudo continuar</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">{error}</p>
        </div>
      </div>
    )
  }

  if (step === 'email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 overflow-x-hidden">
        <div className="max-w-md w-full min-w-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-6 sm:mb-8 min-w-0">
            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Registro de poderes</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Código: <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{codigo}</span>
            </p>
          </div>

          {asamblea && (
            <div className="bg-amber-50/90 dark:bg-amber-950/30 rounded-xl p-4 mb-6 border border-amber-200 dark:border-amber-800">
              <h2 className="font-bold text-gray-900 dark:text-white mb-2">{asamblea.nombre}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">🏢 {asamblea.nombre_conjunto}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">📅 {formatFecha(asamblea.fecha)}</p>
            </div>
          )}

          <div className="space-y-4">
            <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-amber-200/80 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 p-3">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-amber-400 text-amber-700"
                checked={modoRegistroExterno}
                onChange={(e) => {
                  const on = e.target.checked
                  setModoRegistroExterno(on)
                  setError('')
                  if (on) {
                    setEmail('')
                  } else {
                    setCedulaExterna('')
                    setCelularExterna('')
                  }
                }}
              />
              <span className="text-xs text-amber-900 dark:text-amber-100 leading-snug">
                <strong>No figuro en el censo</strong> — soy apoderado externo y quiero declarar un poder recibido (el administrador deberá aprobarlo).
              </span>
            </label>

            {modoRegistroExterno ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Cédula o celular <span className="text-red-500">*</span>
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Indica al menos uno. Con ese dato podrás identificarte cuando el poder esté activo (priorizamos el celular si
                  indicas ambos).
                </p>
                <div>
                  <label
                    htmlFor="registro-poder-celular-ext"
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Celular
                  </label>
                  <Input
                    id="registro-poder-celular-ext"
                    name="registro-poder-celular-ext"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={celularExterna}
                    onChange={(e) => setCelularExterna(e.target.value)}
                    placeholder="Ej. 300 123 4567"
                    className="w-full text-lg"
                    onKeyDown={(e) => e.key === 'Enter' && void handleValidarEmail()}
                  />
                </div>
                <div>
                  <label
                    htmlFor="registro-poder-cedula-ext"
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Cédula de ciudadanía
                  </label>
                  <Input
                    id="registro-poder-cedula-ext"
                    name="registro-poder-cedula-ext"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={cedulaExterna}
                    onChange={(e) => setCedulaExterna(e.target.value)}
                    placeholder="Ej. 12.345.678"
                    className="w-full text-lg"
                    onKeyDown={(e) => e.key === 'Enter' && void handleValidarEmail()}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Email, teléfono o identificación registrada
                </label>
                <Input
                  id="registro-poder-identificador"
                  name="registro-poder-identificador"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com, 3001234567…"
                  className="w-full text-lg"
                  onKeyDown={(e) => e.key === 'Enter' && void handleValidarEmail()}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Si figuras en el censo o ya tienes un poder activo, debe coincidir. Si no figuras, activa la opción de
                  arriba.
                </p>
              </div>
            )}

            {error && (
              <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={() => void handleValidarEmail()}
              disabled={
                loading ||
                (modoRegistroExterno
                  ? !cedulaExterna.trim() && !celularExterna.trim()
                  : !email.trim())
              }
              className="w-full min-w-0 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-sm sm:text-lg py-4 sm:py-6"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Verificando…
                </>
              ) : (
                <>
                  Continuar
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'consentimiento') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 overflow-x-hidden">
        <div className="max-w-md w-full min-w-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-4 sm:mb-6">
            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <Vote className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">Tratamiento de datos personales</h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Para registrar tu solicitud de poder debe aceptar el tratamiento de sus datos según la ley.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200 dark:border-gray-700 text-left text-xs sm:text-sm text-gray-700 dark:text-gray-300 max-h-40 sm:max-h-48 overflow-y-auto min-w-0">
            <p className="font-semibold mb-2">Ley 1581 de 2012 (Colombia) — Protección de datos personales</p>
            <p className="mb-2">
              Al continuar, usted acepta que sus datos personales (correo electrónico o teléfono y actividad en la plataforma)
              sean tratados para gestionar la delegación de voto y la auditoría de la asamblea.
            </p>
            <ul className="list-disc list-inside space-y-1 mb-2">
              <li>Registrar y verificar las solicitudes de poder</li>
              <li>Generar el acta cuando corresponda</li>
              <li>Cumplir con las obligaciones legales aplicables</li>
            </ul>
          </div>

          <label className="flex items-start gap-3 cursor-pointer mb-4 sm:mb-6 min-w-0">
            <input
              type="checkbox"
              checked={consentimientoAceptado}
              onChange={(e) => setConsentimientoAceptado(e.target.checked)}
              className="mt-1 shrink-0 rounded border-gray-300 dark:border-gray-600 text-amber-600 focus:ring-amber-600"
            />
            <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 min-w-0 break-words">
              Acepto el tratamiento de mis datos personales conforme a lo indicado y según la Ley 1581 de 2012.
            </span>
          </label>

          {error && (
            <Alert className="mb-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 min-w-0">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-800 dark:text-red-200 break-words">{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={() => void handleAceptarConsentimiento()}
            disabled={!consentimientoAceptado || guardandoConsentimiento}
            className="w-full min-w-0 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-sm sm:text-lg py-4 sm:py-6 px-4"
          >
            {guardandoConsentimiento ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 shrink-0" />
                Guardando…
              </>
            ) : (
              <>
                Aceptar y continuar
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 shrink-0" />
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 py-6 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Registro de poderes</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">{codigo}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
            Tu correo o teléfono no se muestra en esta pantalla; solo se usa de forma segura para validar tu sesión.
          </p>
        </div>
        <RegistroPoderPublicoForm
          codigo={codigo}
          email={email.trim()}
          unidades={unidades}
          modoRegistroExterno={modoRegistroExterno}
          datosContactoExterno={
            modoRegistroExterno
              ? { cedula: cedulaExterna.trim(), celular: celularExterna.trim() }
              : undefined
          }
        />
      </div>
    </div>
  )
}
