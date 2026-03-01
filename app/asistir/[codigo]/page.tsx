'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, UserCheck, Vote, Search, RefreshCw, AlertTriangle, X, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface AsambleaInfo {
  asamblea_id: string
  nombre: string
  fecha: string
  estado: string
  organization_id: string
  nombre_conjunto: string
  is_demo: boolean
  sandbox_usar_unidades_reales: boolean
}

interface Unidad {
  id: string
  torre: string
  numero: string
  nombre_propietario: string
  email_propietario: string
  coeficiente: number
  ya_verifico: boolean
}

interface Opcion {
  id: string
  texto_opcion: string
  color: string
  orden: number
}

interface Pregunta {
  id: string
  texto_pregunta: string
  estado: string
  tipo_votacion: string
  umbral_aprobacion?: number | null
  opciones: Opcion[]
}

interface VotoRegistrado {
  unidad_id: string
  pregunta_id: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFecha(fecha: string) {
  try {
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return fecha }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AsistirPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const codigo = (params?.codigo as string || '').toUpperCase()
  const token = searchParams?.get('t') || ''

  const [step, setStep] = useState<'validando' | 'ok' | 'error'>('validando')
  const [asamblea, setAsamblea] = useState<AsambleaInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [tab, setTab] = useState<'asistencia' | 'votacion'>('asistencia')

  // Asistencia
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [selAsistencia, setSelAsistencia] = useState<Set<string>>(new Set())
  const [busqAsistencia, setBusqAsistencia] = useState('')
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false)
  const [msgAsistencia, setMsgAsistencia] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [cargandoUnidades, setCargandoUnidades] = useState(false)

  // Votación
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [preguntaActiva, setPreguntaActiva] = useState<string>('')
  const [opcionSeleccionada, setOpcionSeleccionada] = useState<string>('')
  const [selVotacion, setSelVotacion] = useState<Set<string>>(new Set())
  const [busqVotacion, setBusqVotacion] = useState('')
  const [votosRegistrados, setVotosRegistrados] = useState<VotoRegistrado[]>([])
  const [guardandoVoto, setGuardandoVoto] = useState(false)
  const [msgVotacion, setMsgVotacion] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [cargandoPreguntas, setCargandoPreguntas] = useState(false)

  // ── Validar token al montar ──────────────────────────────────────────────
  useEffect(() => {
    if (!codigo || !token) {
      setErrorMsg('Enlace incompleto. Verifica que el enlace sea correcto.')
      setStep('error')
      return
    }
    fetch('/api/delegado/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_asamblea: codigo, token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setAsamblea(data)
          setStep('ok')
        } else {
          setErrorMsg(data.error || 'Acceso no autorizado')
          setStep('error')
        }
      })
      .catch(() => {
        setErrorMsg('Error de conexión. Intenta recargar la página.')
        setStep('error')
      })
  }, [codigo, token])

  // ── Cargar unidades ──────────────────────────────────────────────────────
  const cargarUnidades = useCallback(async () => {
    if (!asamblea) return
    setCargandoUnidades(true)
    try {
      const soloDemo = asamblea.is_demo && !asamblea.sandbox_usar_unidades_reales
      let q = supabase
        .from('unidades')
        .select('id, torre, numero, nombre_propietario, email_propietario, coeficiente')
        .eq('organization_id', asamblea.organization_id)
        .order('torre', { ascending: true })
        .order('numero', { ascending: true })
      q = soloDemo ? q.eq('is_demo', true) : q.or('is_demo.eq.false,is_demo.is.null')
      const { data: todas } = await q

      const { data: verificadas } = await supabase
        .from('quorum_asamblea')
        .select('unidad_id')
        .eq('asamblea_id', asamblea.asamblea_id)
        .eq('verifico_asistencia', true)

      const verificadasSet = new Set((verificadas || []).map((v: any) => v.unidad_id))

      setUnidades(
        (todas || []).map((u: any) => ({
          id: u.id,
          torre: u.torre || 'S/T',
          numero: u.numero || 'S/N',
          nombre_propietario: u.nombre_propietario || 'S/N',
          email_propietario: u.email_propietario || '',
          coeficiente: Number(u.coeficiente) || 0,
          ya_verifico: verificadasSet.has(u.id),
        }))
      )
    } finally {
      setCargandoUnidades(false)
    }
  }, [asamblea])

  // ── Cargar preguntas ─────────────────────────────────────────────────────
  const cargarPreguntas = useCallback(async () => {
    if (!asamblea) return
    setCargandoPreguntas(true)
    try {
      const { data: pregData } = await supabase
        .from('preguntas')
        .select('id, texto_pregunta, estado, tipo_votacion, umbral_aprobacion')
        .eq('asamblea_id', asamblea.asamblea_id)
        .eq('estado', 'abierta')
        .order('orden', { ascending: true })

      const pregIds = (pregData || []).map((p: any) => p.id)
      let opcMap: Record<string, Opcion[]> = {}
      if (pregIds.length > 0) {
        const { data: opcs } = await supabase
          .from('opciones_pregunta')
          .select('id, pregunta_id, texto_opcion, color, orden')
          .in('pregunta_id', pregIds)
          .order('orden', { ascending: true })
        ;(opcs || []).forEach((o: any) => {
          if (!opcMap[o.pregunta_id]) opcMap[o.pregunta_id] = []
          opcMap[o.pregunta_id].push(o)
        })
      }

      const nuevasPreguntas: Pregunta[] = (pregData || []).map((p: any) => ({
        id: p.id,
        texto_pregunta: p.texto_pregunta,
        estado: p.estado,
        tipo_votacion: p.tipo_votacion,
        umbral_aprobacion: p.umbral_aprobacion,
        opciones: opcMap[p.id] || [],
      }))
      setPreguntas(nuevasPreguntas)

      // Cargar votos ya registrados para esta asamblea
      if (pregIds.length > 0) {
        const { data: votosData } = await supabase
          .from('votos')
          .select('unidad_id, pregunta_id')
          .in('pregunta_id', pregIds)
        setVotosRegistrados((votosData || []).map((v: any) => ({
          unidad_id: v.unidad_id,
          pregunta_id: v.pregunta_id,
        })))
      }

      if (nuevasPreguntas.length > 0 && !preguntaActiva) {
        setPreguntaActiva(nuevasPreguntas[0].id)
      }
    } finally {
      setCargandoPreguntas(false)
    }
  }, [asamblea, preguntaActiva])

  useEffect(() => {
    if (step === 'ok' && asamblea) {
      cargarUnidades()
      cargarPreguntas()
    }
  }, [step, asamblea])

  // ── Asistencia ────────────────────────────────────────────────────────────
  const guardarAsistencia = async () => {
    if (selAsistencia.size === 0 || guardandoAsistencia || !asamblea) return
    setGuardandoAsistencia(true)
    setMsgAsistencia(null)
    try {
      const res = await fetch('/api/delegado/registrar-asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: asamblea.asamblea_id, token, unidad_ids: Array.from(selAsistencia) }),
      })
      const data = await res.json()
      if (data.ok) {
        const n = data.registradas as number
        setUnidades((prev) => prev.map((u) => (selAsistencia.has(u.id) ? { ...u, ya_verifico: true } : u)))
        setSelAsistencia(new Set())
        setMsgAsistencia({ tipo: 'ok', texto: `✓ Asistencia registrada para ${n} unidad${n !== 1 ? 'es' : ''}.` })
      } else {
        setMsgAsistencia({ tipo: 'error', texto: data.error || 'Error al registrar asistencia.' })
      }
    } catch {
      setMsgAsistencia({ tipo: 'error', texto: 'Error de conexión.' })
    } finally {
      setGuardandoAsistencia(false)
    }
  }

  const unidadesFiltradas = (busq: string, excludeVerificadas = false) =>
    unidades.filter((u) => {
      if (excludeVerificadas && u.ya_verifico) return false
      if (!busq.trim()) return true
      const q = busq.toLowerCase()
      return `${u.torre} ${u.numero}`.toLowerCase().includes(q) || u.nombre_propietario.toLowerCase().includes(q)
    })

  // ── Votación ──────────────────────────────────────────────────────────────
  const yaVoto = (unidad_id: string, pregunta_id: string) =>
    votosRegistrados.some((v) => v.unidad_id === unidad_id && v.pregunta_id === pregunta_id)

  const preguntaActualObj = preguntas.find((p) => p.id === preguntaActiva)

  const unidadesSinVotar = unidades.filter((u) => !yaVoto(u.id, preguntaActiva))
    .filter((u) => {
      if (!busqVotacion.trim()) return true
      const q = busqVotacion.toLowerCase()
      return `${u.torre} ${u.numero}`.toLowerCase().includes(q) || u.nombre_propietario.toLowerCase().includes(q)
    })

  const guardarVotos = async () => {
    if (selVotacion.size === 0 || !opcionSeleccionada || guardandoVoto || !asamblea) return
    setGuardandoVoto(true)
    setMsgVotacion(null)
    let exitos = 0
    let errores = 0
    const unidadesAVotar = Array.from(selVotacion)
    for (const unidad_id of unidadesAVotar) {
      const unidad = unidades.find((u) => u.id === unidad_id)
      const res = await fetch('/api/delegado/registrar-voto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asamblea_id: asamblea.asamblea_id,
          token,
          unidad_id,
          votante_email: unidad?.email_propietario || 'asistente.delegado@sistema',
          votante_nombre: unidad?.nombre_propietario || 'Residente',
          votos: [{ pregunta_id: preguntaActiva, opcion_id: opcionSeleccionada }],
        }),
      })
      const data = await res.json()
      if (data.success) {
        exitos++
        setVotosRegistrados((prev) => [...prev, { unidad_id, pregunta_id: preguntaActiva }])
      } else {
        errores++
      }
    }
    setSelVotacion(new Set())
    setOpcionSeleccionada('')
    if (errores === 0) {
      setMsgVotacion({ tipo: 'ok', texto: `✓ ${exitos} voto${exitos !== 1 ? 's' : ''} registrado${exitos !== 1 ? 's' : ''} correctamente.` })
    } else {
      setMsgVotacion({ tipo: 'error', texto: `${exitos} voto${exitos !== 1 ? 's' : ''} registrado${exitos !== 1 ? 's' : ''}, ${errores} con error.` })
    }
    setGuardandoVoto(false)
  }

  // ── Renders ───────────────────────────────────────────────────────────────

  if (step === 'validando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Validando acceso...</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 border border-red-200 dark:border-red-800 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Acceso no válido</h1>
          <p className="text-gray-600 dark:text-gray-400">{errorMsg}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{asamblea?.nombre_conjunto}</p>
              <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate">{asamblea?.nombre}</h1>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                Modo asistente delegado
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { cargarUnidades(); cargarPreguntas() }}
              className="shrink-0 rounded-2xl border-gray-300 dark:border-gray-600"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          {/* Tabs */}
          <div className="flex w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
            {([
              { id: 'asistencia', label: 'Registrar asistencia', icon: UserCheck },
              { id: 'votacion', label: 'Registrar votos', icon: Vote },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  tab === id
                    ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-10 space-y-4">
        {/* Aviso de modo delegado */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Los registros quedarán marcados como <strong>registrados por asistente delegado</strong> en el acta y auditoría.</span>
        </div>

        {/* ── TAB ASISTENCIA ── */}
        {tab === 'asistencia' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-indigo-600 px-5 py-4">
              <h2 className="text-white font-bold flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Registrar asistencia
              </h2>
              <p className="text-indigo-100 text-xs mt-0.5">Selecciona las unidades presentes y guarda su asistencia.</p>
            </div>

            <div className="p-4 space-y-3">
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={busqAsistencia}
                  onChange={(e) => setBusqAsistencia(e.target.value)}
                  placeholder="Buscar unidad..."
                  className="w-full pl-9 pr-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Seleccionar/deseleccionar pendientes */}
              {!cargandoUnidades && unidades.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2"
                    onClick={() => {
                      const pendientes = unidadesFiltradas(busqAsistencia, true).map((u) => u.id)
                      const todasSel = pendientes.every((id) => selAsistencia.has(id))
                      if (todasSel) {
                        setSelAsistencia((p) => { const n = new Set(p); pendientes.forEach((id) => n.delete(id)); return n })
                      } else {
                        setSelAsistencia((p) => { const n = new Set(p); pendientes.forEach((id) => n.add(id)); return n })
                      }
                    }}
                  >
                    {unidadesFiltradas(busqAsistencia, true).every((u) => selAsistencia.has(u.id)) && unidadesFiltradas(busqAsistencia, true).length > 0
                      ? 'Deseleccionar todas'
                      : 'Seleccionar todas'}
                  </button>
                  <span className="text-gray-500">{selAsistencia.size} seleccionada{selAsistencia.size !== 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Lista */}
              {cargandoUnidades ? (
                <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-indigo-500" />
                  Cargando unidades...
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {unidadesFiltradas(busqAsistencia).length === 0 ? (
                    <p className="text-center py-6 text-gray-400 text-sm">Sin resultados</p>
                  ) : (
                    unidadesFiltradas(busqAsistencia).map((u) => {
                      const disabled = u.ya_verifico
                      const checked = u.ya_verifico || selAsistencia.has(u.id)
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-colors ${
                            disabled
                              ? 'opacity-50 cursor-default'
                              : checked
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => !disabled && setSelAsistencia((p) => { const n = new Set(p); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n })}
                            className="w-4 h-4 accent-emerald-600 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {u.torre !== 'S/T' ? `T${u.torre} · ` : ''}Apto {u.numero}
                            </span>
                            <span className="text-xs text-gray-500 ml-1.5 truncate">{u.nombre_propietario}</span>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{u.coeficiente.toFixed(3)}%</span>
                          {u.ya_verifico && (
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verificada
                            </span>
                          )}
                        </label>
                      )
                    })
                  )}
                </div>
              )}

              {/* Feedback + Guardar */}
              {msgAsistencia && (
                <p className={`text-xs px-3 py-2 rounded-xl font-medium ${msgAsistencia.tipo === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'}`}>
                  {msgAsistencia.texto}
                </p>
              )}
              <Button
                onClick={guardarAsistencia}
                disabled={selAsistencia.size === 0 || guardandoAsistencia}
                className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2"
              >
                {guardandoAsistencia
                  ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  : <CheckCircle2 className="w-4 h-4" />}
                Guardar asistencia {selAsistencia.size > 0 && `(${selAsistencia.size})`}
              </Button>
            </div>
          </div>
        )}

        {/* ── TAB VOTACIÓN ── */}
        {tab === 'votacion' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Vote className="w-5 h-5" />
                Registrar votos
              </h2>
              <p className="text-indigo-100 text-xs mt-0.5">Selecciona la pregunta, la opción y las unidades a votar.</p>
            </div>

            <div className="p-4 space-y-4">
              {cargandoPreguntas ? (
                <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-indigo-500" />
                  Cargando preguntas...
                </div>
              ) : preguntas.length === 0 ? (
                <div className="text-center py-8">
                  <Vote className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No hay preguntas abiertas en este momento.</p>
                  <button type="button" onClick={cargarPreguntas} className="mt-2 text-xs text-indigo-600 underline">Actualizar</button>
                </div>
              ) : (
                <>
                  {/* Seleccionar pregunta */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Pregunta</label>
                    <div className="space-y-2">
                      {preguntas.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setPreguntaActiva(p.id); setOpcionSeleccionada(''); setSelVotacion(new Set()); setMsgVotacion(null) }}
                          className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-colors ${
                            preguntaActiva === p.id
                              ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 text-indigo-800 dark:text-indigo-200'
                              : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {p.texto_pregunta}
                        </button>
                      ))}
                    </div>
                  </div>

                  {preguntaActualObj && (
                    <>
                      {/* Opciones */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Opción a votar</label>
                        <div className="flex flex-wrap gap-2">
                          {preguntaActualObj.opciones.map((opc) => (
                            <button
                              key={opc.id}
                              type="button"
                              onClick={() => setOpcionSeleccionada(opc.id)}
                              className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all ${
                                opcionSeleccionada === opc.id
                                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-md scale-105'
                                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'
                              }`}
                            >
                              {opc.texto_opcion}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Unidades sin votar */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidades a votar</label>
                          <span className="text-xs text-gray-400">{unidadesSinVotar.length} pendientes</span>
                        </div>

                        {/* Buscador unidades */}
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={busqVotacion}
                            onChange={(e) => setBusqVotacion(e.target.value)}
                            placeholder="Buscar unidad..."
                            className="w-full pl-9 pr-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        {/* Seleccionar todas */}
                        {unidadesSinVotar.length > 0 && (
                          <div className="flex items-center justify-between text-xs mb-2">
                            <button
                              type="button"
                              className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2"
                              onClick={() => {
                                const ids = unidadesSinVotar.map((u) => u.id)
                                const todasSel = ids.every((id) => selVotacion.has(id))
                                if (todasSel) setSelVotacion(new Set())
                                else setSelVotacion(new Set(ids))
                              }}
                            >
                              {unidadesSinVotar.every((u) => selVotacion.has(u.id)) && unidadesSinVotar.length > 0
                                ? 'Deseleccionar todas'
                                : 'Seleccionar todas'}
                            </button>
                            <span className="text-gray-500">{selVotacion.size} seleccionada{selVotacion.size !== 1 ? 's' : ''}</span>
                          </div>
                        )}

                        <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                          {unidadesSinVotar.length === 0 ? (
                            <div className="text-center py-4">
                              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                              <p className="text-sm text-gray-500">Todas las unidades ya votaron en esta pregunta.</p>
                            </div>
                          ) : (
                            unidadesSinVotar.map((u) => (
                              <label
                                key={u.id}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-colors border ${
                                  selVotacion.has(u.id)
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700'
                                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selVotacion.has(u.id)}
                                  onChange={() => setSelVotacion((p) => { const n = new Set(p); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n })}
                                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {u.torre !== 'S/T' ? `T${u.torre} · ` : ''}Apto {u.numero}
                                  </span>
                                  <span className="text-xs text-gray-500 ml-1.5 truncate">{u.nombre_propietario}</span>
                                </div>
                                <span className="text-xs text-gray-400 shrink-0">{u.coeficiente.toFixed(3)}%</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Feedback + Guardar */}
                      {msgVotacion && (
                        <p className={`text-xs px-3 py-2 rounded-xl font-medium ${msgVotacion.tipo === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'}`}>
                          {msgVotacion.texto}
                        </p>
                      )}

                      {(!opcionSeleccionada || selVotacion.size === 0) && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                          {!opcionSeleccionada ? 'Selecciona una opción de voto' : 'Selecciona al menos una unidad'}
                        </p>
                      )}

                      <Button
                        onClick={guardarVotos}
                        disabled={selVotacion.size === 0 || !opcionSeleccionada || guardandoVoto}
                        className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-2"
                      >
                        {guardandoVoto
                          ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          : <Vote className="w-4 h-4" />}
                        Registrar {selVotacion.size > 0 ? `${selVotacion.size} voto${selVotacion.size !== 1 ? 's' : ''}` : 'votos'}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Resumen general */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 px-5 py-4 text-sm">
          <div className="flex items-center gap-2 mb-2 text-gray-500 font-semibold text-xs uppercase tracking-wide">
            <Users className="w-4 h-4" />
            Resumen
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3">
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {unidades.filter((u) => u.ya_verifico).length}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-300">Con asistencia</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-3">
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                {unidades.filter((u) => !u.ya_verifico).length}
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-300">Pendientes de verificar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
