'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Upload, Loader2, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/providers/ToastProvider'

export interface UnidadInfoRegistroPoder {
  id: string
  torre: string
  numero: string
  coeficiente: number
  es_poder: boolean
}

interface Props {
  codigo: string
  email: string
  unidades: UnidadInfoRegistroPoder[]
  /** No está en censo: envía registro_externo al API y exige nombre completo */
  modoRegistroExterno?: boolean
  /** Datos declarados en el paso anterior (se añaden a observaciones para el administrador) */
  datosContactoExterno?: { cedula: string; celular: string }
}

export function RegistroPoderPublicoForm({
  codigo,
  email,
  unidades,
  modoRegistroExterno = false,
  datosContactoExterno,
}: Props) {
  const toast = useToast()
  const [unidadesDelegacionOpciones, setUnidadesDelegacionOpciones] = useState<
    Array<{ id: string; torre: string; numero: string; nombre_propietario: string | null }>
  >([])
  const [cargandoDelegacion, setCargandoDelegacion] = useState(false)
  const [poderOtorganteId, setPoderOtorganteId] = useState('')
  const [nombreReceptorPoder, setNombreReceptorPoder] = useState('')
  const [observacionesPoder, setObservacionesPoder] = useState('')
  const [archivoPoderVotante, setArchivoPoderVotante] = useState<File | null>(null)
  const [enviandoPoderPendiente, setEnviandoPoderPendiente] = useState(false)
  const [misPoderesPendientes, setMisPoderesPendientes] = useState<
    Array<{
      id: string
      unidad_otorgante_torre: string
      unidad_otorgante_numero: string
      created_at: string
      archivo_poder: string | null
      observaciones: string | null
      coeficiente_delegado: number
    }>
  >([])
  const [cargandoMisPendientes, setCargandoMisPendientes] = useState(false)
  const [cancelandoPoderId, setCancelandoPoderId] = useState<string | null>(null)

  const idsYaRepresentados = useMemo(() => new Set(unidades.map((u) => u.id)), [unidades])
  const opcionesOtorgantesPoder = useMemo(
    () => unidadesDelegacionOpciones.filter((u) => !idsYaRepresentados.has(u.id)),
    [unidadesDelegacionOpciones, idsYaRepresentados]
  )

  const cargarDatos = useCallback(async () => {
    if (!codigo || !email.trim()) return
    setCargandoDelegacion(true)
    setCargandoMisPendientes(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/votar/unidades-delegacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo, ocultar_datos_propietario: true }),
        }),
        fetch('/api/votar/mis-poderes-pendientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo, identificador: email.trim(), ocultar_datos_personales: true }),
        }),
      ])
      const j1 = (await r1.json().catch(() => ({}))) as {
        unidades?: Array<{ id: string; torre: string; numero: string; nombre_propietario: string | null }>
      }
      const j2 = (await r2.json().catch(() => ({}))) as {
        poderes?: Array<{
          id: string
          unidad_otorgante_torre: string
          unidad_otorgante_numero: string
          created_at: string
          archivo_poder: string | null
          observaciones: string | null
          coeficiente_delegado: number
        }>
      }
      if (r1.ok && Array.isArray(j1.unidades)) setUnidadesDelegacionOpciones(j1.unidades)
      if (r2.ok && Array.isArray(j2.poderes)) setMisPoderesPendientes(j2.poderes)
    } finally {
      setCargandoDelegacion(false)
      setCargandoMisPendientes(false)
    }
  }, [codigo, email])

  useEffect(() => {
    void cargarDatos()
  }, [cargarDatos])

  const enviarDeclaracionPoder = async () => {
    if (!poderOtorganteId || !codigo || !email.trim()) {
      toast.error('Elige el apartamento que te otorgó el poder.')
      return
    }
    if (modoRegistroExterno && !nombreReceptorPoder.trim()) {
      toast.error('Indica tu nombre completo como receptor del poder.')
      return
    }
    if (archivoPoderVotante && archivoPoderVotante.size > 2 * 1024 * 1024) {
      toast.error('El documento no puede superar 2 MB.')
      return
    }
    setEnviandoPoderPendiente(true)
    try {
      let obsFinal = observacionesPoder.trim()
      if (modoRegistroExterno && datosContactoExterno) {
        const partes: string[] = []
        if (datosContactoExterno.cedula) partes.push(`Cédula declarada: ${datosContactoExterno.cedula}`)
        if (datosContactoExterno.celular) partes.push(`Celular declarado: ${datosContactoExterno.celular}`)
        if (partes.length) {
          obsFinal = [partes.join(' · '), obsFinal].filter(Boolean).join('\n')
        }
      }
      const fd = new FormData()
      fd.append('codigo', codigo)
      fd.append('identificador', email.trim())
      fd.append('unidad_otorgante_id', poderOtorganteId)
      if (modoRegistroExterno) fd.append('registro_externo', 'true')
      if (nombreReceptorPoder.trim()) fd.append('nombre_receptor', nombreReceptorPoder.trim())
      if (obsFinal) fd.append('observaciones', obsFinal)
      if (archivoPoderVotante) fd.append('archivo', archivoPoderVotante)
      const res = await fetch('/api/votar/registrar-poder-pendiente', { method: 'POST', body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string; mensaje?: string }
      if (!res.ok) {
        toast.error(data?.error || 'No se pudo enviar la solicitud')
        return
      }
      toast.success(data?.mensaje || 'Solicitud registrada')
      setPoderOtorganteId('')
      setObservacionesPoder('')
      setArchivoPoderVotante(null)
      await cargarDatos()
    } finally {
      setEnviandoPoderPendiente(false)
    }
  }

  const cancelarPoderPendiente = async (poderId: string) => {
    if (!codigo || !email.trim()) return
    if (
      !window.confirm(
        '¿Cancelar esta solicitud? Podrás enviar una nueva más adelante si la necesitas. El administrador dejará de verla como pendiente.'
      )
    ) {
      return
    }
    setCancelandoPoderId(poderId)
    try {
      const res = await fetch('/api/votar/cancelar-poder-pendiente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          identificador: email.trim(),
          poder_id: poderId,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; mensaje?: string }
      if (!res.ok) {
        toast.error(data.error || 'No se pudo cancelar la solicitud')
        return
      }
      toast.success(data.mensaje || 'Solicitud cancelada')
      await cargarDatos()
    } finally {
      setCancelandoPoderId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          Registrar poder
        </h2>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
          Indica si otro apartamento te delegó el voto. La solicitud queda{' '}
          <strong>pendiente de aprobación</strong> por el administrador antes de poder usarse para votar.
        </p>
      </div>

      {(unidades.length > 0 || modoRegistroExterno) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 p-4 shadow-sm space-y-3">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            Declarar poder recibido
          </h3>
          {modoRegistroExterno && (
            <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-2 py-1.5 border border-amber-200/80 dark:border-amber-800/80">
              Modo <strong>apoderado externo</strong>: ya indicaste cédula y/o celular en el paso anterior; elige la unidad
              que te delegó y tu nombre completo. Con ese contacto podrás ingresar cuando el poder esté activo. El administrador
              validará la solicitud.
            </p>
          )}
          <p className="text-xs text-gray-600 dark:text-gray-400">
            La solicitud <strong>no activa el poder para votar</strong> hasta que un administrador lo verifique en la tabla de
            poderes.
          </p>
          {cargandoDelegacion ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando unidades…
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor="poder-otorgante-rp" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Unidad que otorga el poder <span className="text-red-500">*</span>
                </label>
                <select
                  id="poder-otorgante-rp"
                  value={poderOtorganteId}
                  onChange={(e) => setPoderOtorganteId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm px-3 py-2"
                >
                  <option value="">— Elige torre y apartamento —</option>
                          {opcionesOtorgantesPoder.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.torre || 'S/T'} — {u.numero || 'S/N'}
                            </option>
                          ))}
                </select>
                {opcionesOtorgantesPoder.length === 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    No hay más unidades en el censo distintas a las tuyas, o aún se cargan los datos.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="poder-nombre-receptor-rp" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Tu nombre (apoderado){modoRegistroExterno ? ' — obligatorio' : ' — opcional'}
                </label>
                <input
                  id="poder-nombre-receptor-rp"
                  type="text"
                  value={nombreReceptorPoder}
                  onChange={(e) => setNombreReceptorPoder(e.target.value)}
                  placeholder="Como figura en el poder o documento"
                  required={modoRegistroExterno}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm px-3 py-2"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="poder-obs-rp" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Notas — opcional
                </label>
                <textarea
                  id="poder-obs-rp"
                  value={observacionesPoder}
                  onChange={(e) => setObservacionesPoder(e.target.value)}
                  rows={2}
                  placeholder="Ej. referencia del documento"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Documento escaneado — opcional</span>
                <div className="rounded-xl border-2 border-dashed border-amber-400/90 dark:border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 px-3 py-3 sm:px-4 sm:py-4 hover:border-amber-600 dark:hover:border-amber-400 transition-colors">
                  <input
                    id="poder-archivo-publico-rp"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    onChange={(e) => setArchivoPoderVotante(e.target.files?.[0] ?? null)}
                  />
                  <label
                    htmlFor="poder-archivo-publico-rp"
                    className="flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-md ring-2 ring-amber-500/30">
                      <Upload className="w-6 h-6" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold text-amber-950 dark:text-amber-50">
                        {archivoPoderVotante ? 'Archivo listo para enviar' : 'Toca para subir el documento'}
                      </span>
                      <span className="block text-xs text-gray-700 dark:text-gray-300 mt-1 break-words">
                        {archivoPoderVotante
                          ? archivoPoderVotante.name
                          : 'PDF o Word · máximo 2 MB'}
                      </span>
                    </span>
                  </label>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => void enviarDeclaracionPoder()}
                disabled={enviandoPoderPendiente || !poderOtorganteId}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm"
              >
                {enviandoPoderPendiente ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando…
                  </span>
                ) : (
                  'Enviar solicitud'
                )}
              </Button>
            </>
          )}
        </div>
      )}

      {unidades.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Tus solicitudes pendientes</h3>
            {cargandoMisPendientes && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          {misPoderesPendientes.length === 0 && !cargandoMisPendientes ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">No tienes solicitudes en verificación.</p>
          ) : (
            <ul className="space-y-2">
              {misPoderesPendientes.map((p) => (
                <li
                  key={p.id}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-gray-800/80 p-2.5"
                >
                          <div className="font-medium text-gray-900 dark:text-white">
                            Unidad que otorga: {p.unidad_otorgante_torre} — {p.unidad_otorgante_numero}
                          </div>
                          <div className="text-gray-500 dark:text-gray-500 mt-1">
                    Coef. delegado: {Number(p.coeficiente_delegado || 0).toFixed(4)}% ·{' '}
                    {p.created_at
                      ? new Date(p.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
                      : ''}
                  </div>
                  {p.archivo_poder && (
                    <a
                      href={p.archivo_poder}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 mt-1 hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Ver documento cargado
                    </a>
                  )}
                  <p className="text-amber-700 dark:text-amber-300 mt-1.5 font-medium">En espera de verificación del administrador</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full sm:w-auto border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs"
                    disabled={cancelandoPoderId === p.id}
                    onClick={() => void cancelarPoderPendiente(p.id)}
                  >
                    {cancelandoPoderId === p.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Ban className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Cancelar solicitud
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {unidades.length === 0 && !modoRegistroExterno && (
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-6">
          Tu identificador no está asociado a una unidad ni a un poder activo en este conjunto; no puedes declarar poderes
          recibidos desde aquí. Si necesitas ayuda, contacta al administrador.
        </p>
      )}
    </div>
  )
}
