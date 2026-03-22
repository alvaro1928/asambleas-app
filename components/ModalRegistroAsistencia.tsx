'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { matchesUnidadBusquedaCompleta } from '@/lib/matchUnidadSearch'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface UnidadConAsistencia {
  id: string
  torre: string
  numero: string
  nombre_propietario: string
  email_propietario: string
  coeficiente: number
  ya_verifico: boolean
}

export interface ModalRegistroAsistenciaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  asambleaId: string
  /** Se llama tras guardar asistencia correctamente (para refrescar stats en el padre). */
  onGuardado?: () => void | Promise<void>
}

export function ModalRegistroAsistencia({
  open,
  onOpenChange,
  asambleaId,
  onGuardado,
}: ModalRegistroAsistenciaProps) {
  const [unidadesParaAsistencia, setUnidadesParaAsistencia] = useState<UnidadConAsistencia[]>([])
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [busquedaAsistencia, setBusquedaAsistencia] = useState('')
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false)
  const [quitandoId, setQuitandoId] = useState<string | null>(null)
  const [cargandoUnidadesAsistencia, setCargandoUnidadesAsistencia] = useState(false)
  const [mensajeAsistencia, setMensajeAsistencia] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargarDatos = useCallback(async () => {
    setCargandoUnidadesAsistencia(true)
    setSeleccionadas(new Set())
    setBusquedaAsistencia('')
    try {
      const { data: asambleaModal } = await supabase
        .from('asambleas')
        .select('organization_id, is_demo, sandbox_usar_unidades_reales')
        .eq('id', asambleaId)
        .single()
      const orgIdModal = asambleaModal?.organization_id
      if (!orgIdModal) {
        setUnidadesParaAsistencia([])
        return
      }
      const soloDemo = asambleaModal?.is_demo === true && !(asambleaModal?.sandbox_usar_unidades_reales === true)
      let q = supabase
        .from('unidades')
        .select('id, torre, numero, nombre_propietario, email_propietario, coeficiente')
        .eq('organization_id', orgIdModal)
        .order('torre', { ascending: true })
        .order('numero', { ascending: true })
      q = soloDemo ? q.eq('is_demo', true) : q.or('is_demo.eq.false,is_demo.is.null')
      const { data: todas } = await q

      const verificadasSet = new Set<string>()
      const { data: idsSesion, error: rpcErr } = await supabase.rpc('unidad_ids_verificados_sesion_actual', {
        p_asamblea_id: asambleaId,
        p_pregunta_id: null,
      })
      if (!rpcErr && idsSesion?.length !== undefined) {
        (idsSesion as { unidad_id: string }[]).forEach((r) => {
          if (r.unidad_id) verificadasSet.add(r.unidad_id)
        })
      }

      setUnidadesParaAsistencia(
        (todas || []).map((u: Record<string, unknown>) => ({
          id: u.id as string,
          torre: (u.torre as string) || 'S/T',
          numero: (u.numero as string) || 'S/N',
          nombre_propietario: (u.nombre_propietario as string) || 'S/N',
          email_propietario: (u.email_propietario as string) || '',
          coeficiente: Number(u.coeficiente) || 0,
          ya_verifico: verificadasSet.has(u.id as string),
        }))
      )
    } finally {
      setCargandoUnidadesAsistencia(false)
    }
  }, [asambleaId])

  useEffect(() => {
    if (open && asambleaId) cargarDatos()
  }, [open, asambleaId, cargarDatos])

  const handleOpenChange = (v: boolean) => {
    if (!guardandoAsistencia) {
      onOpenChange(v)
      if (!v) setMensajeAsistencia(null)
    }
  }

  const toggleUnidad = (id: string) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSeleccionarTodas = () => {
    const filtradas = unidadesParaAsistencia.filter((u) => {
      if (u.ya_verifico) return false
      return matchesUnidadBusquedaCompleta(u, busquedaAsistencia, { displaySentinels: true })
    })
    const idsVisibles = filtradas.map((u) => u.id)
    const todasSeleccionadas = idsVisibles.every((id) => seleccionadas.has(id))
    if (todasSeleccionadas) {
      setSeleccionadas((prev) => {
        const next = new Set(prev)
        idsVisibles.forEach((id) => next.delete(id))
        return next
      })
    } else {
      if (idsVisibles.length > 0 && !window.confirm('¿Está seguro de seleccionar todas las unidades mostradas?')) return
      setSeleccionadas((prev) => {
        const next = new Set(prev)
        idsVisibles.forEach((id) => next.add(id))
        return next
      })
    }
  }

  const guardarAsistenciaManual = async () => {
    if (seleccionadas.size === 0 || guardandoAsistencia) return
    setGuardandoAsistencia(true)
    setMensajeAsistencia(null)
    try {
      const res = await fetch('/api/registrar-asistencia-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: asambleaId, unidad_ids: Array.from(seleccionadas) }),
      })
      const data = await res.json()
      if (data.ok) {
        const n = data.registradas as number
        setUnidadesParaAsistencia((prev) =>
          prev.map((u) => (seleccionadas.has(u.id) ? { ...u, ya_verifico: true } : u))
        )
        setSeleccionadas(new Set())
        setMensajeAsistencia({
          tipo: 'ok',
          texto: `✓ Asistencia registrada para ${n} unidad${n !== 1 ? 'es' : ''}.`,
        })
        await onGuardado?.()
      } else {
        setMensajeAsistencia({ tipo: 'error', texto: data.error || 'Error al guardar asistencia.' })
      }
    } catch {
      setMensajeAsistencia({ tipo: 'error', texto: 'Error de conexión. Intenta de nuevo.' })
    } finally {
      setGuardandoAsistencia(false)
    }
  }

  const quitarAsistencia = async (unidadId: string) => {
    if (quitandoId || guardandoAsistencia) return
    setQuitandoId(unidadId)
    setMensajeAsistencia(null)
    try {
      const res = await fetch('/api/quitar-asistencia-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: asambleaId, unidad_ids: [unidadId] }),
      })
      const data = await res.json()
      if (data.ok) {
        setUnidadesParaAsistencia((prev) =>
          prev.map((u) => (u.id === unidadId ? { ...u, ya_verifico: false } : u))
        )
        setMensajeAsistencia({ tipo: 'ok', texto: 'Asistencia quitada. La unidad vuelve a pendientes de verificar.' })
        await onGuardado?.()
      } else {
        setMensajeAsistencia({ tipo: 'error', texto: data.error || 'Error al quitar asistencia.' })
      }
    } catch {
      setMensajeAsistencia({ tipo: 'error', texto: 'Error de conexión. Intenta de nuevo.' })
    } finally {
      setQuitandoId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-2xl w-[95vw] h-[85vh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0 rounded-3xl border border-[rgba(255,255,255,0.15)] overflow-hidden"
        style={{ backgroundColor: '#0B0E14' }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[rgba(255,255,255,0.08)] flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="flex items-center gap-2 text-lg text-slate-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Registrar asistencia manual
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleOpenChange(false)}
              className="absolute right-4 top-4"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Selecciona las unidades cuya asistencia quieres registrar en esta sesión. Las que ya verificaron aparecen como Verificada; si registraste una por error, usa Quitar para desmarcarla (solo mientras la verificación esté activa).
          </p>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-[rgba(255,255,255,0.08)] flex-shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={busquedaAsistencia}
              onChange={(e) => setBusquedaAsistencia(e.target.value)}
              placeholder="Torre+número, solo número (sin torre), propietario o correo…"
              className="w-full pl-9 pr-4 py-2 rounded-2xl bg-white/5 border border-[rgba(255,255,255,0.1)] text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          {!cargandoUnidadesAsistencia && unidadesParaAsistencia.length > 0 && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={toggleSeleccionarTodas}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                {(() => {
                  const pendientes = unidadesParaAsistencia.filter((u) => {
                    if (u.ya_verifico) return false
                    return matchesUnidadBusquedaCompleta(u, busquedaAsistencia, { displaySentinels: true })
                  })
                  return pendientes.length > 0 && pendientes.every((u) => seleccionadas.has(u.id))
                    ? 'Deseleccionar todas'
                    : 'Seleccionar todas'
                })()}
              </button>
              <span className="text-xs text-slate-500">
                {seleccionadas.size} seleccionada{seleccionadas.size !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 min-h-0">
          {cargandoUnidadesAsistencia ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-slate-400 border-t-transparent" />
              Cargando unidades...
            </div>
          ) : unidadesParaAsistencia.length === 0 ? (
            <p className="text-center py-12 text-slate-500 text-sm">No hay unidades registradas.</p>
          ) : (
            <div className="space-y-1">
              {unidadesParaAsistencia
                .filter((u) => matchesUnidadBusquedaCompleta(u, busquedaAsistencia, { displaySentinels: true }))
                .map((u) => {
                  const checked = u.ya_verifico || seleccionadas.has(u.id)
                  const disabled = u.ya_verifico
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-colors ${
                        disabled
                          ? 'opacity-50 cursor-default'
                          : checked
                          ? 'bg-emerald-900/20 border border-emerald-700/30'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => !disabled && toggleUnidad(u.id)}
                        className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-200">
                          {u.torre !== 'S/T' ? `Torre ${u.torre} · ` : ''}Apto {u.numero}
                        </span>
                        <span className="text-xs text-slate-400 ml-2 truncate">{u.nombre_propietario}</span>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">coef. {u.coeficiente.toFixed(4)}%</span>
                      {u.ya_verifico && (
                        <span className="text-xs text-emerald-400 font-semibold shrink-0 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verificada
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
                            onClick={(e) => {
                              e.preventDefault()
                              quitarAsistencia(u.id)
                            }}
                            disabled={quitandoId === u.id || guardandoAsistencia}
                          >
                            {quitandoId === u.id ? 'Quitando...' : 'Quitar'}
                          </Button>
                        </span>
                      )}
                    </label>
                  )
                })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.08)] flex-shrink-0 space-y-2">
          {mensajeAsistencia && (
            <p
              className={`text-xs font-medium px-3 py-2 rounded-xl ${
                mensajeAsistencia.tipo === 'ok'
                  ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/30'
                  : 'bg-red-900/30 text-red-300 border border-red-700/30'
              }`}
            >
              {mensajeAsistencia.texto}
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm text-slate-400 order-2 sm:order-1">
              {seleccionadas.size > 0
                ? `${seleccionadas.size} unidad${seleccionadas.size !== 1 ? 'es' : ''} seleccionada${seleccionadas.size !== 1 ? 's' : ''}`
                : 'Ninguna unidad seleccionada'}
            </span>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={guardandoAsistencia}
                className="rounded-2xl text-slate-400 hover:text-slate-200 w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={guardarAsistenciaManual}
                disabled={seleccionadas.size === 0 || guardandoAsistencia}
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                {guardandoAsistencia ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Guardar asistencia
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
