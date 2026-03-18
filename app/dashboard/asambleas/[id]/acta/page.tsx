'use client'

import { useEffect, useRef, useState } from 'react'
import JSZip from 'jszip'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Download, FileText, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/providers/ToastProvider'

interface Asamblea {
  id: string
  nombre: string
  fecha: string
  estado: string
  organization_id: string
  is_demo?: boolean
  sandbox_usar_unidades_reales?: boolean
  acta_ots_proof_base64?: string | null
}

interface Conjunto {
  name: string
}

interface Pregunta {
  id: string
  texto_pregunta: string
  descripcion?: string
  tipo_votacion: string
  estado: string
  orden: number
  umbral_aprobacion?: number | null
}

interface Opcion {
  id: string
  texto_opcion: string
  color: string
  orden: number
}

interface StatsPregunta {
  total_votos: number
  total_coeficiente: number
  coeficiente_total_conjunto?: number
  porcentaje_participacion?: number
  resultados: Array<{
    opcion_id: string
    opcion_texto: string
    color: string
    votos_cantidad?: number
    votos_coeficiente?: number
    porcentaje_coeficiente_total?: number
    porcentaje_coeficiente?: number
  }>
}

interface Quorum {
  total_unidades: number
  unidades_votantes: number
  coeficiente_votante: number
  porcentaje_participacion_coeficiente: number
  quorum_alcanzado: boolean
}

interface AuditRow {
  votante_email: string
  votante_nombre: string | null
  unidad_torre: string
  unidad_numero: string
  opcion_seleccionada: string
  es_poder: boolean
  accion: string
  opcion_anterior: string | null
  fecha_accion: string
  ip_address: string | null
  user_agent?: string | null
}

interface UnidadNoParticipo {
  id: string
  torre: string
  numero: string
  nombre_propietario: string | null
  email_propietario: string | null
  telefono_propietario: string | null
  coeficiente: number
}

/** Una entrada del resumen al final del acta: sesión de verificación y unidades que no validaron asistencia */
interface ResumenNoValidacion {
  titulo: string
  cierreAt: string
  unidades: UnidadNoParticipo[]
}

/** Voto final de una unidad en una pregunta (para cuadro de auditoría de votaciones finales) */
interface VotoFinalUnidad {
  torre: string
  numero: string
  nombre_propietario: string | null
  opcion_texto: string
  coeficiente: number
  es_poder?: boolean
}

/** Poder con documento cargado (para anexos en descarga del acta) */
interface PoderConDocumento {
  id: string
  archivo_poder: string
  torre: string
  numero: string
}

export default function ActaPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [conjunto, setConjunto] = useState<Conjunto | null>(null)
  const [preguntas, setPreguntas] = useState<(Pregunta & { opciones: Opcion[] })[]>([])
  const [estadisticas, setEstadisticas] = useState<Record<string, StatsPregunta>>({})
  const [quorum, setQuorum] = useState<Quorum | null>(null)
  interface VerifStatsActa { total_verificados: number; coeficiente_verificado: number; porcentaje_verificado: number; quorum_alcanzado: boolean; hora_verificacion?: string; hora_ultima_verificacion?: string }
  interface VerifPorPregunta { total_verificados: number; coeficiente_verificado: number; porcentaje_verificado: number; quorum_alcanzado: boolean; corte_timestamp?: string }
  /** Sesiones de verificación (cada vez que se abrió/cerró). pregunta_id null = asamblea en general; no null = asociada a esa pregunta. */
  interface SesionVerificacion { apertura_at: string; cierre_at: string | null; total_verificados: number | null; coeficiente_verificado: number | null; porcentaje_verificado: number | null; quorum_alcanzado: boolean | null; pregunta_id?: string | null }
  const [sesionesVerificacion, setSesionesVerificacion] = useState<SesionVerificacion[]>([])
  const [verificacion, setVerificacion] = useState<VerifStatsActa | null>(null)
  const [verificacionPorPregunta, setVerificacionPorPregunta] = useState<Record<string, VerifPorPregunta>>({})
  const [totalPoderes, setTotalPoderes] = useState(0)
  const [coefPoderes, setCoefPoderes] = useState(0)
  const [auditoria, setAuditoria] = useState<Record<string, AuditRow[]>>({})
  const [incluyeActaDetallada, setIncluyeActaDetallada] = useState(false)
  const [tokensDisponibles, setTokensDisponibles] = useState(0)
  const [costoOperacion, setCostoOperacion] = useState(0)
  /** Por pregunta: unidades que no participaron (no votaron) en esa pregunta */
  const [unidadesNoParticipationPorPregunta, setUnidadesNoParticipationPorPregunta] = useState<Record<string, UnidadNoParticipo[]>>({})
  /** Resumen al final del acta: por cada sesión de verificación (general o por pregunta), unidades que no validaron asistencia */
  const [resumenNoValidacionPorSesion, setResumenNoValidacionPorSesion] = useState<ResumenNoValidacion[]>([])
  /** Por pregunta: lista de votos finales (una fila por unidad con su opción elegida) para el cuadro de auditoría */
  const [votacionesFinalesPorPregunta, setVotacionesFinalesPorPregunta] = useState<Record<string, VotoFinalUnidad[]>>({})
  /** Poderes con documento cargado (para opción "incluir como anexos" en descarga) */
  const [poderesConDocumento, setPoderesConDocumento] = useState<PoderConDocumento[]>([])
  const [incluirAnexosPoderes, setIncluirAnexosPoderes] = useState(false)
  const descargarSoporteConAnexosRef = useRef(false)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when id changes
  }, [params.id])

  const loadData = async () => {
    try {
      const selectedConjuntoId = localStorage.getItem('selectedConjuntoId')
      if (!selectedConjuntoId) {
        router.push('/dashboard')
        return
      }

      const { data: asambleaData, error: asambleaError } = await supabase
        .from('asambleas')
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()

      if (asambleaError || !asambleaData) {
        router.push('/dashboard/asambleas')
        return
      }
      setAsamblea(asambleaData)
      setActaOtsBase64((asambleaData as { acta_ots_proof_base64?: string | null }).acta_ots_proof_base64 ?? null)
      // Unidades a considerar en sandbox: demo o reales según sandbox_usar_unidades_reales (solo aplica si is_demo)
      const esDemoUnidades = (asambleaData as { is_demo?: boolean }).is_demo === true && !((asambleaData as { sandbox_usar_unidades_reales?: boolean }).sandbox_usar_unidades_reales === true)
      // Acceso gratuito al acta: si ya se pagó al activar, es demo, o la asamblea está activa/finalizada
      const esDemo = (asambleaData as { is_demo?: boolean }).is_demo === true
      const yaPagada = (asambleaData as { pago_realizado?: boolean }).pago_realizado === true
      const estado = (asambleaData as { estado?: string }).estado
      const actaGratis = yaPagada || esDemo || estado === 'activa' || estado === 'finalizada'
      if (typeof window !== 'undefined' && actaGratis) {
        sessionStorage.setItem('acta_generada_' + params.id, '1')
        setActaGenerada(true)
      }

      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', asambleaData.organization_id)
        .single()
      const org = orgData as { name?: string } | null
      setConjunto(org && typeof org.name === 'string' ? { name: org.name } : null)

      // Billetera por gestor: acceso si tiene tokens, asamblea ya pagada, o asamblea activa/finalizada (acta gratuita)
      const orgId = asambleaData.organization_id
      const statusRes = await fetch(`/api/dashboard/organization-status?organization_id=${encodeURIComponent(orgId ?? '')}`)
      const statusData = statusRes.ok ? await statusRes.json() : null
      setIncluyeActaDetallada(!!statusData?.puede_operar || yaPagada || estado === 'activa' || estado === 'finalizada')
      setTokensDisponibles(Math.max(0, Number(statusData?.tokens_disponibles ?? 0)))
      setCostoOperacion(Math.max(0, Number(statusData?.costo_operacion ?? 0)))

      const configRes = await fetch('/api/configuracion-global', { cache: 'no-store' })
      const configData = configRes.ok ? await configRes.json() : null
      setBlockchainCertEnabled(configData?.acta_blockchain_ots_enabled === true)

      const { data: preguntasData } = await supabase
        .from('preguntas')
        .select('id, texto_pregunta, descripcion, tipo_votacion, estado, orden, umbral_aprobacion, is_archived')
        .eq('asamblea_id', params.id)
        .order('orden', { ascending: true })

      const preguntasParaActa = (preguntasData || []).filter((p: { is_archived?: boolean }) => !p.is_archived)
      const preguntasConOpciones: (Pregunta & { opciones: Opcion[] })[] = []
      const statsMap: Record<string, StatsPregunta> = {}

      for (const p of preguntasParaActa) {
        const { data: opcionesData } = await supabase
          .from('opciones_pregunta')
          .select('id, texto_opcion, color, orden')
          .eq('pregunta_id', p.id)
          .order('orden', { ascending: true })

        preguntasConOpciones.push({
          ...p,
          opciones: opcionesData || [],
        })

        const { data: statsData } = await supabase.rpc('calcular_estadisticas_pregunta', {
          p_pregunta_id: p.id,
        })
        if (statsData && statsData[0]) {
          const s = statsData[0] as any
          let resultados = []
          if (typeof s.resultados === 'string') {
            try {
              resultados = JSON.parse(s.resultados)
            } catch {
              resultados = []
            }
          } else if (Array.isArray(s.resultados)) {
            resultados = s.resultados
          } else {
            resultados = s.resultados || []
          }
          statsMap[p.id] = {
            total_votos: parseInt(s.total_votos) || 0,
            total_coeficiente: parseFloat(s.total_coeficiente) || 0,
            coeficiente_total_conjunto: parseFloat(s.coeficiente_total_conjunto) || 100,
            porcentaje_participacion: parseFloat(s.porcentaje_participacion) || 0,
            resultados,
          }
        }
      }
      setPreguntas(preguntasConOpciones)
      setEstadisticas({ ...statsMap })

      const auditMap: Record<string, AuditRow[]> = {}
      for (const p of preguntasConOpciones) {
        try {
          const { data: auditData } = await supabase.rpc('reporte_auditoria_pregunta', {
            p_pregunta_id: p.id,
          })
          if (auditData && Array.isArray(auditData)) {
            auditMap[p.id] = auditData.map((r: any) => ({
              votante_email: r.votante_email ?? '',
              votante_nombre: r.votante_nombre ?? null,
              unidad_torre: r.unidad_torre ?? '',
              unidad_numero: r.unidad_numero ?? '',
              opcion_seleccionada: r.opcion_seleccionada ?? '',
              es_poder: !!r.es_poder,
              accion: r.accion ?? '',
              opcion_anterior: r.opcion_anterior ?? null,
              fecha_accion: r.fecha_accion ?? '',
              ip_address: r.ip_address ?? null,
              user_agent: r.user_agent ?? null,
            }))
          }
        } catch {
          auditMap[p.id] = []
        }
      }
      setAuditoria(auditMap)

      // Votaciones finales por pregunta: una fila por unidad con su opción elegida (último voto por unidad) y es_poder
      const votacionesFinalesMap: Record<string, VotoFinalUnidad[]> = {}
      for (const p of preguntasConOpciones) {
        const { data: votosPregunta } = await supabase
          .from('votos')
          .select('unidad_id, opcion_id, created_at, es_poder')
          .eq('pregunta_id', p.id)
          .order('created_at', { ascending: false })
        // Quedarse con el último voto por unidad (created_at desc → primera aparición por unidad_id)
        const porUnidad = new Map<string, { opcion_id: string; es_poder: boolean }>()
        for (const v of votosPregunta || []) {
          const uid = (v as { unidad_id?: string }).unidad_id
          const oid = (v as { opcion_id?: string }).opcion_id
          const ep = !!(v as { es_poder?: boolean }).es_poder
          if (uid && oid && !porUnidad.has(uid)) porUnidad.set(uid, { opcion_id: oid, es_poder: ep })
        }
        const unidadIds = Array.from(porUnidad.keys())
        if (unidadIds.length === 0) {
          votacionesFinalesMap[p.id] = []
          continue
        }
        const { data: unidadesVotantes } = await supabase
          .from('unidades')
          .select('id, torre, numero, nombre_propietario, coeficiente')
          .in('id', unidadIds)
          .eq('is_demo', esDemoUnidades)
        const opcionesById = new Map(p.opciones.map((o) => [o.id, o.texto_opcion]))
        const lista: VotoFinalUnidad[] = (unidadesVotantes || []).map((u: any) => {
          const entry = porUnidad.get(u.id)
          const opcionId = entry?.opcion_id
          return {
            torre: u.torre ?? '',
            numero: u.numero ?? '',
            nombre_propietario: u.nombre_propietario ?? null,
            opcion_texto: opcionId ? (opcionesById.get(opcionId) ?? opcionId) : '—',
            coeficiente: Number(u.coeficiente) || 0,
            es_poder: entry?.es_poder ?? false,
          }
        })
        lista.sort((a, b) => `${a.torre}-${a.numero}`.localeCompare(`${b.torre}-${b.numero}`))
        votacionesFinalesMap[p.id] = lista
      }
      setVotacionesFinalesPorPregunta(votacionesFinalesMap)

      const { data: quorumData } = await supabase.rpc('calcular_quorum_asamblea', {
        p_asamblea_id: params.id,
      })
      if (quorumData && quorumData[0]) {
        setQuorum(quorumData[0] as Quorum)
      }

      // Cargar sesiones de verificación (con pregunta_id: null = general, no null = por pregunta)
      let sesionesData: Array<{ apertura_at?: string; cierre_at?: string; total_verificados?: number; coeficiente_verificado?: number; porcentaje_verificado?: number; quorum_alcanzado?: boolean; pregunta_id?: string | null }> = []
      try {
        const { data: sesionesFetch } = await supabase
          .from('verificacion_asamblea_sesiones')
          .select('apertura_at, cierre_at, total_verificados, coeficiente_verificado, porcentaje_verificado, quorum_alcanzado, pregunta_id')
          .eq('asamblea_id', params.id)
          .not('cierre_at', 'is', null)
          .order('cierre_at', { ascending: false })
        sesionesData = sesionesFetch || []
        const porApertura = [...sesionesData].sort((a, b) => (a.apertura_at || '').localeCompare(b.apertura_at || ''))
        if (porApertura.length > 0) {
          setSesionesVerificacion(porApertura as SesionVerificacion[])
        } else {
          setSesionesVerificacion([])
        }
      } catch {
        setSesionesVerificacion([])
      }

      const { data: verPorPregData } = await supabase.rpc('calcular_verificacion_por_preguntas', { p_asamblea_id: params.id })
      const ultimaGeneral = sesionesData.filter((s) => s.pregunta_id == null)[0]
      if (ultimaGeneral) {
        setVerificacion({
          total_verificados: Number(ultimaGeneral.total_verificados) ?? 0,
          coeficiente_verificado: Number(ultimaGeneral.coeficiente_verificado) ?? 0,
          porcentaje_verificado: Number(ultimaGeneral.porcentaje_verificado) ?? 0,
          quorum_alcanzado: !!ultimaGeneral.quorum_alcanzado,
          hora_verificacion: ultimaGeneral.apertura_at ?? undefined,
          hora_ultima_verificacion: ultimaGeneral.cierre_at ?? undefined,
        } as VerifStatsActa)
      }
      // Cargar snapshot por pregunta
      if (verPorPregData && verPorPregData.length > 0) {
        const map: Record<string, VerifPorPregunta> = {}
        ;(verPorPregData as any[]).forEach((row) => {
          map[row.pregunta_id] = {
            total_verificados: Number(row.total_verificados) || 0,
            coeficiente_verificado: Number(row.coeficiente_verificado) || 0,
            porcentaje_verificado: Number(row.porcentaje_verificado) || 0,
            quorum_alcanzado: !!row.quorum_alcanzado,
            corte_timestamp: row.corte_timestamp ?? undefined,
          }
        })
        setVerificacionPorPregunta(map)
      }

      const { data: poderesData } = await supabase
        .from('poderes')
        .select('id, unidad_otorgante_id')
        .eq('asamblea_id', params.id)
        .eq('estado', 'activo')

      // Poderes con documento (para anexos en descarga del acta)
      const { data: poderesConDoc } = await supabase
        .from('vista_poderes_completa')
        .select('id, archivo_poder, unidad_otorgante_torre, unidad_otorgante_numero')
        .eq('asamblea_id', params.id)
        .eq('estado', 'activo')
        .not('archivo_poder', 'is', null)
      const listadoPoderesConDoc: PoderConDocumento[] = (poderesConDoc || [])
        .filter((p: any) => p.archivo_poder)
        .map((p: any) => ({
          id: p.id,
          archivo_poder: p.archivo_poder,
          torre: String(p.unidad_otorgante_torre ?? ''),
          numero: String(p.unidad_otorgante_numero ?? ''),
        }))
      setPoderesConDocumento(listadoPoderesConDoc)

      const unidadIdsPoderes = (poderesData || []).map((p: any) => p.unidad_otorgante_id)
      let coef = 0
      if (unidadIdsPoderes.length > 0) {
        const { data: unids } = await supabase
          .from('unidades')
          .select('coeficiente')
          .in('id', unidadIdsPoderes)
          .eq('is_demo', esDemoUnidades)
        const unidsList = unids || []
        coef = unidsList.reduce((sum: number, u: any) => sum + (u.coeficiente || 0), 0)
        setTotalPoderes(unidsList.length)
      } else {
        setTotalPoderes(0)
      }
      setCoefPoderes(Math.min(100, coef))

      // Por cada pregunta: unidades que no participaron (no votaron) en esa pregunta
      const { data: todasUnidades } = await supabase
        .from('unidades')
        .select('id, torre, numero, nombre_propietario, email_propietario, telefono_propietario, email, telefono, coeficiente, is_demo')
        .eq('organization_id', asambleaData.organization_id)
        .eq('is_demo', esDemoUnidades)
      const filtrarDemoEnNombre = !esDemoUnidades
      const unidadesFiltradas = (todasUnidades || []).filter((u: any) => {
        if (!filtrarDemoEnNombre) return true
        const torre = (u.torre || '').toString()
        const nombre = (u.nombre_propietario || '').toString()
        return !torre.toLowerCase().includes('demo') && !nombre.toLowerCase().includes('demo')
      })
      const baseUnidad = (u: any) => ({
        id: u.id,
        torre: u.torre ?? '',
        numero: u.numero ?? '',
        nombre_propietario: u.nombre_propietario ?? null,
        email_propietario: (u.email_propietario ?? u.email ?? '').trim() || null,
        telefono_propietario: (u.telefono_propietario ?? u.telefono ?? '').trim() || null,
        coeficiente: Number(u.coeficiente) || 0,
      })
      const noParticiparonPorPregunta: Record<string, UnidadNoParticipo[]> = {}
      for (const pregunta of preguntasConOpciones || []) {
        const { data: votosPregunta } = await supabase
          .from('votos')
          .select('unidad_id')
          .eq('pregunta_id', pregunta.id)
        const unidadIdsVotaronPregunta = Array.from(new Set((votosPregunta || []).map((v: any) => v.unidad_id).filter(Boolean)))
        const setVotaron = new Set(unidadIdsVotaronPregunta)
        noParticiparonPorPregunta[pregunta.id] = unidadesFiltradas
          .filter((u: any) => !setVotaron.has(u.id))
          .map((u: any) => baseUnidad(u))
      }
      setUnidadesNoParticipationPorPregunta(noParticiparonPorPregunta)

      // Resumen de no validación: por cada sesión cerrada (general o por pregunta), unidades que no validaron asistencia
      const { data: registrosVerif } = await supabase
        .from('verificacion_asistencia_registro')
        .select('creado_en, pregunta_id, quorum_asamblea_id, quorum_asamblea(unidad_id)')
        .eq('asamblea_id', params.id)
      const registrosConUnidad = (registrosVerif || []).map((r: any) => {
        const qa = r.quorum_asamblea
        const unidad_id = (qa && (Array.isArray(qa) ? qa[0]?.unidad_id : qa.unidad_id)) ?? null
        return { creado_en: r.creado_en, pregunta_id: r.pregunta_id ?? null, unidad_id }
      }).filter((r: { unidad_id: string | null }) => r.unidad_id)
      const mapaPreguntaTexto = new Map((preguntasConOpciones || []).map((p, i) => [p.id, `P${i + 1}: ${(p.texto_pregunta || '').trim() || 'Pregunta'}`]))
      const resumenNoValidacion: ResumenNoValidacion[] = []
      const sesionesCerradas = [...(sesionesData || [])]
        .filter((s) => s.cierre_at != null)
        .sort((a, b) => (new Date(a.cierre_at!).getTime() - new Date(b.cierre_at!).getTime()))
      for (const sesion of sesionesCerradas) {
        const apertura = sesion.apertura_at ? new Date(sesion.apertura_at).getTime() : 0
        const cierre = sesion.cierre_at ? new Date(sesion.cierre_at).getTime() : 0
        const preguntaIdSesion = sesion.pregunta_id ?? null
        const verificaronEnSesion = new Set(
          registrosConUnidad
            .filter((r: { creado_en: string; pregunta_id: string | null }) => {
              const t = new Date(r.creado_en).getTime()
              const matchPregunta = (r.pregunta_id == null && preguntaIdSesion == null) || (r.pregunta_id === preguntaIdSesion)
              return t >= apertura && t <= cierre && matchPregunta
            })
            .map((r: { unidad_id: string }) => r.unidad_id)
        )
        const noValidaron = unidadesFiltradas
          .filter((u: any) => !verificaronEnSesion.has(u.id))
          .map((u: any) => baseUnidad(u))
        const titulo = preguntaIdSesion == null
          ? 'Verificación general'
          : (mapaPreguntaTexto.get(preguntaIdSesion) ?? `Pregunta ${preguntaIdSesion}`)
        const cierreAt = sesion.cierre_at ?? ''
        resumenNoValidacion.push({ titulo, cierreAt, unidades: noValidaron })
      }
      setResumenNoValidacionPorSesion(resumenNoValidacion)
    } catch (e) {
      console.error(e)
      router.push('/dashboard/asambleas')
    } finally {
      setLoading(false)
    }
  }

  const [printError, setPrintError] = useState<string | null>(null)
  /** True cuando el usuario ya confirmó y se descontaron tokens por generar el acta (misma sesión no vuelve a cobrar) */
  const [actaGenerada, setActaGenerada] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [generarError, setGenerarError] = useState<string | null>(null)
  const [actaOtsBase64, setActaOtsBase64] = useState<string | null>(null)
  const [descargandoPdf, setDescargandoPdf] = useState(false)
  const [showVerificacionModal, setShowVerificacionModal] = useState(false)
  const [showModalTipoActa, setShowModalTipoActa] = useState(false)
  /** true = renderizar acta sin auditoría (para PDF soporte general); al descargar se restaura a false */
  const [actaModoSoporte, setActaModoSoporte] = useState(false)
  const [descargarSoportePendiente, setDescargarSoportePendiente] = useState(false)
  const [certificando, setCertificando] = useState(false)
  const [blockchainCertEnabled, setBlockchainCertEnabled] = useState(false)
  const actaContentRef = useRef<HTMLElement>(null)
  const toast = useToast()

  useEffect(() => {
    if (params.id && typeof window !== 'undefined') {
      setActaGenerada(sessionStorage.getItem('acta_generada_' + params.id) === '1')
    }
  }, [params.id])

  /** Tras elegir "versión pública", el DOM debe re-renderizar sin auditoría; delay y layout aplican igual para asambleas reales y sandbox/demo. */
  useEffect(() => {
    if (!actaModoSoporte || !descargarSoportePendiente) return
    const conAnexos = descargarSoporteConAnexosRef.current
    const t = setTimeout(() => {
      // Esperar a que React pinte el DOM sin bloques de auditoría; delay generoso para que la primera descarga ya sea la versión pública
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          handleDescargarPdf(true, conAnexos)
          setDescargarSoportePendiente(false)
          setActaModoSoporte(false)
        })
      })
    }, 1400)
    return () => clearTimeout(t)
  }, [actaModoSoporte, descargarSoportePendiente])

  /** Descontar tokens y marcar acta como generada; luego se puede descargar PDF sin volver a cobrar. */
  const handleGenerarActa = async () => {
    if (!asamblea?.id) return
    setGenerarError(null)
    setGenerando(true)
    try {
      const res = await fetch('/api/dashboard/descontar-token-acta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          asamblea_id: asamblea.id,
          finalizar_asamblea: asamblea.is_demo !== true && asamblea.estado === 'activa',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 402) {
        setGenerarError(data.error ?? `Saldo insuficiente: Necesitas ${costoOperacion} tokens (créditos) y tienes ${tokensDisponibles}.`)
        setGenerando(false)
        return
      }
      if (!res.ok) {
        setGenerarError(data.error ?? 'Error al descontar tokens (créditos)')
        setGenerando(false)
        return
      }
      if (data.tokens_restantes != null) setTokensDisponibles(Math.max(0, Number(data.tokens_restantes)))
      sessionStorage.setItem('acta_generada_' + params.id, '1')
      setActaGenerada(true)
      if (asamblea.estado === 'activa' && asamblea.is_demo !== true) {
        setAsamblea((prev) => (prev ? { ...prev, estado: 'finalizada' } : null))
      }
      // Certificación blockchain (OpenTimestamps) si está activada en Super Admin
      try {
        const certRes = await fetch('/api/dashboard/acta-certificar-blockchain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ asamblea_id: asamblea.id }),
        })
        const certData = await certRes.json().catch(() => ({}))
        if (certData.ok && certData.ots_base64) {
          setActaOtsBase64(certData.ots_base64)
          setAsamblea((prev) => (prev ? { ...prev, acta_ots_proof_base64: certData.ots_base64 } : null))
        }
      } catch {
        // No bloquear si falla la certificación
      }
    } catch (e) {
      setGenerarError('Error al procesar. Intenta de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  /** Reintentar certificación blockchain (desde el modal cuando no hay .ots). */
  const handleReintentarCertificacion = async () => {
    if (!asamblea?.id || certificando) return
    setCertificando(true)
    try {
      const certRes = await fetch('/api/dashboard/acta-certificar-blockchain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ asamblea_id: asamblea.id }),
      })
      const certData = await certRes.json().catch(() => ({}))
      if (!certRes.ok) {
        toast.error(certData?.error ?? 'Error al certificar.')
      } else if (certData.ots_base64) {
        setActaOtsBase64(certData.ots_base64)
        setAsamblea((prev) => (prev ? { ...prev, acta_ots_proof_base64: certData.ots_base64 } : null))
        toast.success('Certificado .ots generado. Ya puedes descargarlo.')
      }
    } catch {
      toast.error('No se pudo conectar con el servidor de certificación.')
    } finally {
      setCertificando(false)
    }
  }

  /** Descarga el acta como PDF. soporteGeneral = true → acta para anexo público. Si incluirAnexos y hay poderes con documento, descarga ZIP con acta + anexos. */
  const handleDescargarPdf = async (soporteGeneral = false, incluirAnexos = false) => {
    const mainEl = actaContentRef.current
    if (!mainEl) return
    setDescargandoPdf(true)

    // 1. Forzar modo claro para que el texto sea legible en el PDF
    const htmlEl = document.documentElement
    const hadDarkClass = htmlEl.classList.contains('dark')
    const prevColorScheme = htmlEl.style.colorScheme
    if (hadDarkClass) htmlEl.classList.remove('dark')
    htmlEl.style.colorScheme = 'light'

    // 2. Quitar overflow en contenedores de tabla para que html2canvas capture el ancho completo
    const overflowEls: { el: HTMLElement; prev: string }[] = []
    mainEl.querySelectorAll<HTMLElement>('[class*="overflow"]').forEach((el) => {
      overflowEls.push({ el, prev: el.style.overflow })
      el.style.overflow = 'visible'
    })
    // Forzar ancho completo en tablas
    const tableEls: { el: HTMLElement; prev: string }[] = []
    mainEl.querySelectorAll<HTMLElement>('table').forEach((el) => {
      tableEls.push({ el, prev: el.style.width })
      el.style.width = '100%'
    })

    // Versión pública: quitar del DOM los bloques de auditoría (quién votó qué, detalle por unidad) para que no quede espacio en blanco; se restauran después
    const auditoriaOnlyEls: { el: HTMLElement; parent: HTMLElement; nextSibling: ChildNode | null }[] = []
    if (soporteGeneral) {
      mainEl.querySelectorAll<HTMLElement>('[data-solo-auditoria="true"]').forEach((el) => {
        const parent = el.parentElement
        if (parent) {
          auditoriaOnlyEls.push({ el, parent, nextSibling: el.nextSibling })
          parent.removeChild(el)
        }
      })
    }

    try {
      const html2pdf = (await import('html2pdf.js')).default
      const nombreSeguro = (asamblea?.nombre ?? 'asamblea').replace(/[^a-zA-Z0-9\u00C0-\u024F\s.-]/g, '').trim().slice(0, 80) || 'acta'
      const filenamePdf = soporteGeneral
        ? `acta-soporte-${nombreSeguro}-${params.id}.pdf`.replace(/\s+/g, '_')
        : `acta-${nombreSeguro}-${params.id}.pdf`.replace(/\s+/g, '_')
      const opts = {
        margin: [12, 10, 12, 10] as [number, number, number, number],
        filename: filenamePdf,
        image: { type: 'jpeg' as const, quality: 0.82 },
        html2canvas: {
          scale: 1.25,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: mainEl.scrollWidth + 40,
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const, compress: true },
      }
      // Generar PDF como blob para calcular su hash y que el .ots corresponda al archivo que descarga el usuario
      const blob = await html2pdf().set(opts).from(mainEl).toPdf().output('blob') as Blob
      const pdfBytes = await blob.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', pdfBytes)
      const pdfSha256Hex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      const anexosActivos = incluirAnexos && poderesConDocumento.length > 0

      if (anexosActivos) {
        const zip = new JSZip()
        zip.file(filenamePdf, blob)
        const anexosDir = zip.folder('anexos-documentos-poder')
        if (anexosDir) {
          const proxyUrl = '/api/dashboard/acta-proxy-documento-poder'
          for (let i = 0; i < poderesConDocumento.length; i++) {
            const p = poderesConDocumento[i]
            try {
              const res = await fetch(`${proxyUrl}?url=${encodeURIComponent(p.archivo_poder)}`, { credentials: 'include' })
              if (res.ok) {
                const anexoBlob = await res.blob()
                const ext = p.archivo_poder.toLowerCase().includes('.docx') ? '.docx' : p.archivo_poder.toLowerCase().includes('.doc') ? '.doc' : '.pdf'
                const nombreAnexo = `poder-T${p.torre}-Apt${p.numero}${ext}`.replace(/\s+/g, '_')
                anexosDir.file(nombreAnexo, anexoBlob)
              }
            } catch {
              // Si falla un anexo, no bloqueamos el resto
            }
          }
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const zipUrl = URL.createObjectURL(zipBlob)
        const zipFilename = `acta-y-anexos-${nombreSeguro}-${params.id}.zip`.replace(/\s+/g, '_')
        const a = document.createElement('a')
        a.href = zipUrl
        a.download = zipFilename
        a.click()
        URL.revokeObjectURL(zipUrl)
        toast.success(`Descargado ${zipFilename} con acta y ${poderesConDocumento.length} documento(s) de poder.`)
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filenamePdf
        a.click()
        URL.revokeObjectURL(url)
      }

      // Certificar en blockchain solo la acta con auditoría (no la versión pública), y solo si se descargó PDF sin ZIP
      if (!anexosActivos && !soporteGeneral) {
        try {
          const certRes = await fetch('/api/dashboard/acta-certificar-blockchain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ asamblea_id: asamblea?.id, pdf_sha256_hex: pdfSha256Hex }),
          })
          const certData = await certRes.json().catch(() => ({}))
          if (certRes.ok && certData.ots_base64) {
            setActaOtsBase64(certData.ots_base64)
            setAsamblea((prev) => (prev ? { ...prev, acta_ots_proof_base64: certData.ots_base64 } : null))
            toast.success('Certificado .ots generado para este PDF. Descárgalo y verifica en opentimestamps.org con el mismo archivo.')
          }
        } catch {
          // No bloquear la descarga si falla la certificación
        }
      }
    } catch (e) {
      console.error('Error al generar PDF:', e)
      setPrintError('No se pudo generar el PDF. Intenta de nuevo o recarga la página.')
    } finally {
      auditoriaOnlyEls.forEach(({ el, parent, nextSibling }) => {
        if (nextSibling) parent.insertBefore(el, nextSibling)
        else parent.appendChild(el)
      })
      overflowEls.forEach(({ el, prev }) => { el.style.overflow = prev })
      tableEls.forEach(({ el, prev }) => { el.style.width = prev })
      if (hadDarkClass) htmlEl.classList.add('dark')
      htmlEl.style.colorScheme = prevColorScheme
      setDescargandoPdf(false)
    }
  }

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 print:hidden">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!incluyeActaDetallada) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 text-center">
          <FileText className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Tokens insuficientes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Saldo insuficiente para esta operación. La descarga del acta con auditoría requiere tener en tu billetera al menos tantos tokens como unidades tiene el conjunto (1 token = 1 unidad). Recarga tokens o compra más para acceder.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Tu billetera: <strong>{tokensDisponibles} tokens (créditos)</strong>
            {costoOperacion > 0 && <> • Costo al activar asamblea: {costoOperacion} tokens (créditos)</>}
          </p>
          <Link href={`/dashboard/asambleas/${params.id}`}>
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a la asamblea
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Puerta: generar acta consume tokens; confirmar antes de mostrar el acta (luego pueden descargar PDF sin volver a cobrar)
  if (!actaGenerada) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6 print:hidden">
        <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 text-center">
          <FileText className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Generar acta
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            El cobro es <strong>solo al activar la asamblea</strong> (una vez). Si ya activaste, puedes generar el acta sin nuevo cobro. Una vez generada, podrás descargar el PDF (con auditoría o versión pública) cuando lo necesites.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Tu saldo: <strong>{tokensDisponibles} tokens (créditos)</strong>
          </p>
          {generarError && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">{generarError}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/dashboard/asambleas/${params.id}`}>
              <Button variant="outline">Cancelar</Button>
            </Link>
            <Button
              onClick={handleGenerarActa}
              disabled={generando}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {generando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sí, generar acta
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const isDemo = asamblea?.is_demo === true

  return (
    <div className="min-h-screen bg-white text-gray-900 relative">
      {/* Watermark para asamblea de demostración (visible en pantalla y al imprimir/PDF) */}
      {isDemo && (
        <div
          className="pointer-events-none fixed inset-0 z-[5] flex items-center justify-center print:flex"
          aria-hidden
        >
          <div
            className="text-[clamp(1.5rem,4vw,3rem)] font-bold text-red-400/40 dark:text-red-500/40 select-none whitespace-nowrap"
            style={{
              transform: 'rotate(-35deg)',
              transformOrigin: 'center',
              letterSpacing: '0.05em',
            }}
          >
            DEMO - SIN VALIDEZ LEGAL
          </div>
        </div>
      )}
      {/* Barra de acciones: oculta al imprimir */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/asambleas/${params.id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
          <div className="flex items-center gap-2 rounded-3xl bg-slate-100 px-3 py-2 border border-slate-200">
            <span className="text-xs font-medium text-slate-600">Billetera:</span>
            <span className="text-sm font-bold text-indigo-600">{tokensDisponibles} tokens (créditos)</span>
          </div>
          <p className="text-xs text-slate-500">
            Acta generada. Descarga el PDF cuando lo necesites (no consume más tokens).
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {printError && (
            <p className="text-sm text-amber-600 dark:text-amber-400">{printError}</p>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            {blockchainCertEnabled && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowVerificacionModal(true)}
                className={(asamblea?.acta_ots_proof_base64 || actaOtsBase64) ? 'border-emerald-600 text-emerald-700 hover:bg-emerald-50' : 'border-slate-400 text-slate-600 hover:bg-slate-100'}
              >
                <FileText className="w-4 h-4 mr-2" />
                Certificado y cómo verificar
              </Button>
            )}
            <Button
              onClick={() => setShowModalTipoActa(true)}
              disabled={descargandoPdf}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {descargandoPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Descargar acta (PDF)
            </Button>
          </div>
        </div>
      </div>

      <main ref={actaContentRef} className="max-w-4xl mx-auto px-8 py-10 print:py-6 bg-white text-gray-900 print:[&_section]:break-inside-avoid print:[&_table]:break-inside-avoid shadow-sm print:shadow-none rounded-lg print:rounded-none">

        {/* ── ENCABEZADO ── */}
        <header className="mb-5 break-inside-avoid">
          <div className="flex items-start justify-between border-b-4 border-gray-900 pb-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Votaciones de Asambleas Online</p>
              <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900 leading-tight">Acta de votación</h1>
              {actaModoSoporte && (
                <p className="text-sm font-semibold text-gray-600 mt-2">Versión pública</p>
              )}
            </div>
            <div className="text-right text-xs text-gray-500 mt-1 shrink-0 ml-4">
              <p className="font-medium text-gray-600">Generada: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              {isDemo && <p className="mt-1 text-red-600 font-semibold uppercase">Demo — sin validez legal</p>}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            <div>
              <span className="font-semibold text-gray-600">Asamblea:</span>{' '}
              <span className="text-gray-900 font-medium">{asamblea?.nombre}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Conjunto:</span>{' '}
              <span className="text-gray-900">{conjunto?.name}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Fecha:</span>{' '}
              <span className="text-gray-900">{asamblea?.fecha && formatFecha(asamblea.fecha)}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Estado:</span>{' '}
              <span className="text-gray-900">{asamblea?.estado === 'finalizada' ? 'Finalizada' : asamblea?.estado}</span>
            </div>
          </div>
        </header>

        {/* Dentro del acta (PDF): solo una línea de sellado cuando hay certificado */}
        {(asamblea?.acta_ots_proof_base64 || actaOtsBase64) && (
          <p className="mb-6 text-sm text-gray-700 border-l-4 border-gray-400 pl-3 py-1">
            El acta con auditoría completa (quién votó qué) queda sellada en la blockchain de Bitcoin (OpenTimestamps). Verificación:{' '}
            <a href="https://opentimestamps.org" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-800 underline">
              https://opentimestamps.org
            </a>
          </p>
        )}

        {/* ── REGISTRO DE VERIFICACIÓN DE QUÓRUM — ASAMBLEA EN GENERAL (solo sesiones cerradas con pregunta_id null; no mostrar abiertas) ── */}
        {(() => {
          const sesionesGenerales = sesionesVerificacion.filter((s) => s.pregunta_id == null && s.cierre_at != null)
          return (sesionesGenerales.length > 0 || (verificacion && verificacion.total_verificados > 0)) && !quorum
        })() && (
          <section className="mb-4 break-inside-avoid">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-1 pb-1 border-b border-gray-200">Registros de verificación de quórum</h2>
            <p className="text-xs text-gray-500 mb-3">Verificación de asistencia asociada a la asamblea en general (inicial o sin preguntas abiertas). Cada vez que se abrió y cerró la verificación se registra una sesión con fecha y hora.</p>
            <h3 className="text-xs font-semibold text-gray-600 mb-2">Asamblea en general</h3>

            {(() => {
              const sesionesGenerales = sesionesVerificacion.filter((s) => s.pregunta_id == null && s.cierre_at != null)
              return sesionesGenerales.length > 0 ? (
              <div className="space-y-4">
                {sesionesGenerales.map((sesion, idx) => (
                  <table key={idx} className="w-full border-collapse text-sm mb-4">
                    <tbody>
                      <tr className="bg-gray-50">
                        <td colSpan={2} className="border border-gray-200 px-3 py-2 font-bold text-gray-800">
                          Sesión {idx + 1}: apertura {new Date(sesion.apertura_at).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                          {sesion.cierre_at && <> — cierre {new Date(sesion.cierre_at).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</>}
                        </td>
                      </tr>
                      {sesion.cierre_at != null && (
                        <>
                          <tr>
                            <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700 w-1/2">Unidades que verificaron asistencia</td>
                            <td className="border border-gray-200 px-3 py-2 text-gray-900">{sesion.total_verificados ?? '—'}</td>
                          </tr>
                          <tr className="bg-gray-50">
                            <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Coeficiente verificado</td>
                            <td className="border border-gray-200 px-3 py-2 text-gray-900">{sesion.porcentaje_verificado != null ? `${Number(sesion.porcentaje_verificado).toFixed(2)}%` : '—'}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                ))}
              </div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700 bg-gray-50 w-1/2">Unidades que verificaron asistencia</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-900 bg-gray-50">{verificacion!.total_verificados}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Coeficiente verificado</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-900">{Math.min(100, verificacion!.coeficiente_verificado).toFixed(4)}%</td>
                  </tr>
                  {verificacion!.hora_verificacion && (
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Primera verificación</td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-900">
                        {new Date(verificacion!.hora_verificacion).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                    </tr>
                  )}
                  {verificacion!.hora_ultima_verificacion && verificacion!.hora_ultima_verificacion !== verificacion!.hora_verificacion && (
                    <tr>
                      <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700 bg-gray-50">Última verificación</td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-900 bg-gray-50">
                        {new Date(verificacion!.hora_ultima_verificacion).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ); })()}
          </section>
        )}

        {/* ── QUÓRUM Y PARTICIPACIÓN (resumen general: solo total unidades, cantidad de preguntas, verificaciones; sin votación por pregunta) ── */}
        {(quorum || preguntas.length > 0) && (
          <section className="mb-4 break-inside-avoid">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2 pb-1 border-b border-gray-200">Quórum y participación</h2>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {quorum && (
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700 w-1/2">Total de unidades del conjunto</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-900">{quorum.total_unidades}</td>
                  </tr>
                )}
                <tr className={quorum ? '' : 'bg-gray-50'}>
                  <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Cantidad de preguntas</td>
                  <td className="border border-gray-200 px-3 py-2 text-gray-900">{preguntas.length}</td>
                </tr>
                {totalPoderes > 0 && (
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Poderes registrados</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-900">{totalPoderes} unidades — coef. delegado {Math.min(100, coefPoderes).toFixed(2)}%</td>
                  </tr>
                )}
                {/* Registro de verificación de asistencia — asamblea en general (solo sesiones cerradas; no mostrar abiertas) */}
                {(() => {
                  const sesionesGeneralesResumen = sesionesVerificacion.filter((s) => s.pregunta_id == null && s.cierre_at != null)
                  return (sesionesGeneralesResumen.length > 0 || (verificacion && verificacion.total_verificados > 0))
                })() && (
                  <>
                    <tr>
                      <td colSpan={2} className="border border-gray-200 px-3 py-2 text-xs font-bold uppercase text-gray-700 bg-gray-100">Verificación de asistencia (asamblea en general)</td>
                    </tr>
                    {sesionesVerificacion.filter((s) => s.pregunta_id == null && s.cierre_at != null).length > 0 ? (
                      sesionesVerificacion.filter((s) => s.pregunta_id == null && s.cierre_at != null).map((sesion, idx) => (
                        <tr key={idx}>
                          <td colSpan={2} className="border border-gray-200 px-3 py-2 text-xs bg-gray-50">
                            <strong>Sesión {idx + 1}:</strong> apertura {new Date(sesion.apertura_at).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                            {sesion.cierre_at && (
                              <> — cierre {new Date(sesion.cierre_at).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                {sesion.total_verificados != null && <> · {sesion.total_verificados} un. · {sesion.porcentaje_verificado != null ? `${Number(sesion.porcentaje_verificado).toFixed(2)}%` : ''}</>}
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <>
                        <tr>
<td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700 bg-gray-50">Unidades que verificaron asistencia</td>
                            <td className="border border-gray-200 px-3 py-2 text-gray-900 bg-gray-50">{verificacion!.total_verificados}</td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Coeficiente verificado</td>
                          <td className="border border-gray-200 px-3 py-2 text-gray-900">{Math.min(100, verificacion!.coeficiente_verificado).toFixed(4)}%</td>
                        </tr>
                        {verificacion!.hora_verificacion && (
                          <tr className="bg-gray-50">
                            <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Primera verificación de asistencia</td>
                            <td className="border border-gray-200 px-3 py-2 text-gray-900">
                              {new Date(verificacion!.hora_verificacion).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                          </tr>
                        )}
                        {verificacion!.hora_ultima_verificacion && verificacion!.hora_ultima_verificacion !== verificacion!.hora_verificacion && (
                          <tr>
                            <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700 bg-gray-50">Última verificación de asistencia</td>
                            <td className="border border-gray-200 px-3 py-2 text-gray-900 bg-gray-50">
                              {new Date(verificacion!.hora_ultima_verificacion).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* ── RESULTADOS POR PREGUNTA ── */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2 pb-1 border-b border-gray-200">Resultados por pregunta</h2>
          <p className="text-xs text-gray-500 mb-3">
            Para cada pregunta se indican los resultados de votación y el registro de verificación de quórum al momento de esa votación. Las verificaciones de la asamblea en general figuran en la sección anterior.
          </p>
          <div className="space-y-3">
            {preguntas.map((pregunta, idx) => {
              const stats = estadisticas[pregunta.id]
              const votosFinales = votacionesFinalesPorPregunta[pregunta.id] || []
              const totalCoefVotantes = votosFinales.reduce((s, r) => s + r.coeficiente, 0)
              const resumenDesdeTabla = totalCoefVotantes > 0
                ? votosFinales.reduce((acc, r) => {
                    const key = r.opcion_texto
                    if (!acc[key]) acc[key] = { coef: 0, count: 0 }
                    acc[key].coef += r.coeficiente
                    acc[key].count += 1
                    return acc
                  }, {} as Record<string, { coef: number; count: number }>)
                : null
              const pctDeResultado = (r: any) =>
                pregunta.tipo_votacion === 'nominal'
                  ? Number(r.porcentaje_nominal_total ?? r.porcentaje_votos_emitidos ?? 0)
                  : Number(r.porcentaje_coeficiente_total ?? r.porcentaje_coeficiente ?? 0)
              // Para votación por coeficiente, el % se calcula sobre el coeficiente total del conjunto (100%), no sobre los participantes
              const coefTotalConjunto = stats?.coeficiente_total_conjunto ?? 100
              let items: { opcion_texto: string; pct: number; count: number }[] = stats
                ? (resumenDesdeTabla && pregunta.tipo_votacion === 'coeficiente'
                    ? Object.entries(resumenDesdeTabla).map(([opcion, { coef, count }]) => ({
                        opcion_texto: opcion,
                        pct: coefTotalConjunto > 0 ? Math.min(100, (coef / coefTotalConjunto) * 100) : 0,
                        count,
                      }))
                    : (stats.resultados || []).map((r: any) => ({
                        opcion_texto: r.opcion_texto,
                        pct: Math.min(100, pctDeResultado(r)),
                        count: r.votos_cantidad ?? 0,
                      })))
                : []
              if (items.length === 0 && pregunta.opciones?.length) {
                items = pregunta.opciones.map((o) => ({ opcion_texto: o.texto_opcion, pct: 0, count: 0 }))
              }
              // Opción que cuenta para el umbral: la que tenga "a favor" en el texto o, si no hay, la primera (p. ej. "Sí")
              const opcionAfavor = items.find((i) => i.opcion_texto?.trim().toLowerCase().includes('a favor')) ?? items[0]
              const pctAfavor = opcionAfavor?.pct ?? 0
              const aprobado = pregunta.umbral_aprobacion != null && pctAfavor >= pregunta.umbral_aprobacion

              return (
                <div key={pregunta.id} className="break-inside-avoid">
                  {/* Título de pregunta */}
                  <div className="flex items-start gap-2 mb-2">
                    <span className="flex-shrink-0 text-sm font-semibold text-gray-800">{idx + 1}.</span>
                    <div>
                      <h3 className="font-bold text-base text-gray-900 leading-snug">{pregunta.texto_pregunta}</h3>
                      {pregunta.descripcion && <p className="text-xs text-gray-500 mt-0.5">{pregunta.descripcion}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        Tipo de votación: <span className="capitalize">{pregunta.tipo_votacion}</span>
                        {stats && <> · {stats.total_votos} voto{stats.total_votos !== 1 ? 's' : ''} · Coef. participante: {Math.min(100, Number(stats.total_coeficiente)).toFixed(2)}%</>}
                      </p>
                    </div>
                  </div>

                  {/* Resultados resumen (siempre visible para auditoría) */}
                  <div className="ml-5 mb-2">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Resultados de la pregunta</p>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-3 py-1.5 text-left font-semibold text-gray-800">Opción</th>
                          <th className="border border-gray-300 px-3 py-1.5 text-right font-semibold text-gray-800 w-24">Votos</th>
                          <th className="border border-gray-300 px-3 py-1.5 text-right font-semibold text-gray-800 w-24">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length > 0 ? items.map((item, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-200 px-3 py-1.5 text-gray-900">{item.opcion_texto}</td>
                            <td className="border border-gray-200 px-3 py-1.5 text-right text-gray-700">{item.count}</td>
                            <td className="border border-gray-200 px-3 py-1.5 text-right font-semibold text-gray-900">{item.pct.toFixed(2)}%</td>
                          </tr>
                        )) : (
                          <tr><td colSpan={3} className="border border-gray-200 px-3 py-2 text-gray-500 text-center">Sin opciones o sin votos registrados</td></tr>
                        )}
                      </tbody>
                    </table>
                    {pregunta.umbral_aprobacion != null && (
                      <p className="text-sm font-semibold mt-1.5 px-3 py-1.5 border border-gray-300 bg-gray-50 text-gray-800">
                        {aprobado ? 'APROBADO' : 'NO APROBADO'} — Mayoría requerida: {pregunta.umbral_aprobacion}% · Obtenido: {items.length > 0 ? `${pctAfavor.toFixed(2)}%` : '0%'}
                      </p>
                    )}
                  </div>

                  {/* Votación final por unidad (solo en acta con auditoría; no en soporte general) */}
                  {!actaModoSoporte && (
                  <div className="ml-5 mt-2" data-solo-auditoria="true">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Votación final por unidad</p>
                    <table className="w-full border-collapse" style={{ fontSize: '11px' }}>
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-800" style={{ width: '12%' }}>Unidad</th>
                          <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-800" style={{ width: '40%' }}>Propietario / Residente</th>
                          <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-800" style={{ width: '30%' }}>Voto final</th>
                          <th className="border border-gray-300 px-2 py-1 text-right font-semibold text-gray-800" style={{ width: '18%' }}>Coef. %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {votosFinales.length > 0 ? votosFinales.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-200 px-2 py-1" style={{ wordBreak: 'break-word' }}>{row.es_poder ? 'Poder ' : ''}{row.torre}-{row.numero}</td>
                            <td className="border border-gray-200 px-2 py-1" style={{ wordBreak: 'break-word' }}>{row.nombre_propietario ?? '—'}</td>
                            <td className="border border-gray-200 px-2 py-1" style={{ wordBreak: 'break-word' }}>{row.opcion_texto}</td>
                            <td className="border border-gray-200 px-2 py-1 text-right">{row.coeficiente.toFixed(2)}%</td>
                          </tr>
                        )) : (
                          <tr><td colSpan={4} className="border border-gray-200 px-2 py-2 text-gray-500 text-center text-xs">Ningún voto registrado en esta pregunta</td></tr>
                        )}
                      </tbody>
                    </table>
                    {votosFinales.length > 0 && (() => {
                      const byOption = votosFinales.reduce((acc, r) => { acc[r.opcion_texto] = (acc[r.opcion_texto] ?? 0) + 1; return acc }, {} as Record<string, number>)
                      return (
                        <p className="mt-1.5 text-xs text-gray-500">
                          <span className="font-semibold">Totales:</span>{' '}
                          {Object.entries(byOption).map(([op, n]) => `${op}: ${n} unidad(es)`).join(' | ')}
                        </p>
                      )
                    })()}
                  </div>
                  )}

                  {/* Registro de verificación de quórum: sesión de esta pregunta si existe; si no, última sesión general para no mostrar cero */}
                  {(() => {
                    const sesionesPregunta = sesionesVerificacion
                      .filter((s) => s.pregunta_id === pregunta.id && s.cierre_at != null)
                      .sort((a, b) => new Date(b.cierre_at!).getTime() - new Date(a.cierre_at!).getTime())
                    const sesionPregunta = sesionesPregunta[0] ?? null
                    const sesionesGenerales = sesionesVerificacion
                      .filter((s) => s.pregunta_id == null && s.cierre_at != null)
                      .sort((a, b) => new Date(b.cierre_at!).getTime() - new Date(a.cierre_at!).getTime())
                    const ultimaGeneral = sesionesGenerales[0] ?? null
                    const sesionUsar = sesionPregunta ?? ultimaGeneral
                    if (!sesionUsar) return null
                    const total = sesionUsar.total_verificados ?? 0
                    const porcentaje = Number(sesionUsar.porcentaje_verificado) ?? 0
                    if (total === 0 && porcentaje === 0) return null
                    const quorumAlcanzado = !!sesionUsar.quorum_alcanzado
                    const horaCorte = sesionUsar.cierre_at
                      ? new Date(sesionUsar.cierre_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                      : null
                    const esGeneral = !sesionPregunta && !!ultimaGeneral
                    return (
                      <div className="ml-5 mt-2 mb-0.5">
                        <p className="text-xs font-semibold text-gray-700 mb-0.5">
                          {esGeneral
                            ? 'Registro de verificación de quórum (asamblea en general, aplicable a esta pregunta)'
                            : 'Registro de verificación de quórum (asociada a esta pregunta)'}
                        </p>
                        <p className="text-xs text-gray-600 border-l-2 border-gray-300 pl-2">
                          Al cerrar la verificación
                          {horaCorte ? ` (${horaCorte})` : ''},{' '}
                          el <strong>{porcentaje.toFixed(2)}%</strong> del coeficiente de copropiedad
                          ({total} unidades) había verificado asistencia.{' '}
                          {quorumAlcanzado
                            ? 'Quórum alcanzado según Ley 675 de 2001, Art. 45 (>50%).'
                            : 'Quórum no alcanzado según Ley 675 de 2001, Art. 45 (se requiere >50%).'}
                        </p>
                      </div>
                    )
                  })()}

                  {/* Auditoría de transacciones (solo en acta con auditoría; no en soporte general) */}
                  {!actaModoSoporte && (
                  <div className="ml-5 mt-2" data-solo-auditoria="true">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Auditoría de transacciones (cambios de voto, quién votó, cuándo)</p>
                    <table className="w-full border-collapse" style={{ fontSize: '10px', tableLayout: 'fixed' }}>
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-1.5 py-1 text-left font-semibold text-gray-800" style={{ width: '22%' }}>Votante</th>
                          <th className="border border-gray-300 px-1.5 py-1 text-left font-semibold text-gray-800" style={{ width: '9%' }}>Unidad</th>
                          <th className="border border-gray-300 px-1.5 py-1 text-left font-semibold text-gray-800" style={{ width: '14%' }}>Opción</th>
                          <th className="border border-gray-300 px-1.5 py-1 text-left font-semibold text-gray-800" style={{ width: '20%' }}>Acción</th>
                          <th className="border border-gray-300 px-1.5 py-1 text-left font-semibold text-gray-800" style={{ width: '18%' }}>Fecha/hora</th>
                          <th className="border border-gray-300 px-1.5 py-1 text-left font-semibold text-gray-800" style={{ width: '17%' }}>IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditoria[pregunta.id] && auditoria[pregunta.id].length > 0 ? auditoria[pregunta.id].map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-200 px-1.5 py-1" style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}>
                              {row.votante_email}{row.votante_nombre ? ` (${row.votante_nombre})` : ''}
                            </td>
                            <td className="border border-gray-200 px-1.5 py-1" style={{ wordBreak: 'break-word' }}>
                              {row.es_poder ? 'Poder ' : ''}{row.unidad_torre}-{row.unidad_numero}
                            </td>
                            <td className="border border-gray-200 px-1.5 py-1" style={{ wordBreak: 'break-word' }}>{row.opcion_seleccionada}</td>
                            <td className="border border-gray-200 px-1.5 py-1" style={{ wordBreak: 'break-word' }}>
                              {row.accion}{row.opcion_anterior ? ` (antes: ${row.opcion_anterior})` : ''}
                            </td>
                            <td className="border border-gray-200 px-1.5 py-1">
                              {row.fecha_accion ? new Date(row.fecha_accion).toLocaleString('es-CO') : '-'}
                            </td>
                            <td className="border border-gray-200 px-1.5 py-1" style={{ wordBreak: 'break-all' }}>{row.ip_address || '-'}</td>
                          </tr>
                        )) : (
                          <tr><td colSpan={6} className="border border-gray-200 px-1.5 py-2 text-gray-500 text-center text-xs">No hay transacciones de auditoría para esta pregunta</td></tr>
                        )}
                      </tbody>
                    </table>
                    {auditoria[pregunta.id]?.some((r) => r.es_poder) && (
                      <p className="text-xs text-gray-400 mt-1">* Voto ejercido mediante poder notarial.</p>
                    )}
                  </div>
                  )}

                  {/* Unidades que no votaron en esta pregunta: en versión pública solo totales; en acta completa tabla con detalle */}
                  {(() => {
                    const noParticiparonPregunta = unidadesNoParticipationPorPregunta[pregunta.id] ?? []
                    if (noParticiparonPregunta.length === 0) return null
                    const coefTotal = noParticiparonPregunta.reduce((s, u) => s + u.coeficiente, 0)
                    return (
                      <div className="ml-5 mt-2 break-inside-avoid">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                          Unidades que no votaron en esta pregunta: <strong>{noParticiparonPregunta.length}</strong> unidad(es) · Coeficiente no participante: <strong>{Math.min(100, coefTotal).toFixed(2)}%</strong>
                          {quorum && <> ({noParticiparonPregunta.length} de {quorum.total_unidades} unidades)</>}
                        </p>
                        {!actaModoSoporte && (
                        <table className="w-full border-collapse text-xs mt-1.5" style={{ tableLayout: 'fixed' }} data-solo-auditoria="true">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-800" style={{ width: '9%' }}>Torre</th>
                              <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold" style={{ width: '9%' }}>N.°</th>
                              <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold" style={{ width: '30%' }}>Propietario / Residente</th>
                              <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-800" style={{ width: '29%' }}>Email</th>
                              <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-800" style={{ width: '14%' }}>Teléfono</th>
                              <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-gray-800" style={{ width: '9%' }}>Coef.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {noParticiparonPregunta.map((u) => (
                              <tr key={u.id} className="bg-white">
                                <td className="border border-gray-200 px-2 py-1">{u.torre || '—'}</td>
                                <td className="border border-gray-200 px-2 py-1">{u.numero || '—'}</td>
                                <td className="border border-gray-200 px-2 py-1" style={{ wordBreak: 'break-word' }}>{u.nombre_propietario || '—'}</td>
                                <td className="border border-gray-200 px-2 py-1" style={{ wordBreak: 'break-all' }}>{(u.email_propietario ?? '').trim() || 'No registrado'}</td>
                                <td className="border border-gray-200 px-2 py-1">{(u.telefono_propietario ?? '').trim() || '—'}</td>
                                <td className="border border-gray-200 px-2 py-1 text-right">{u.coeficiente.toFixed(2)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── RESUMEN: UNIDADES QUE NO VALIDARON ASISTENCIA (solo por pregunta; las generales ya figuran en Quórum). Versión pública: solo cantidades y coeficiente. */}
        {resumenNoValidacionPorSesion.some((r) => r.unidades.length > 0 && r.titulo !== 'Verificación general') && (
          <section className="mt-4 pt-3 border-t-2 border-gray-200 break-inside-avoid">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">Resumen de no participación en la verificación de asistencia</h2>
            <p className="text-xs text-gray-500 mb-2">
              Unidades que no validaron su asistencia en cada sesión asociada a una pregunta. La verificación general ya figura en la sección Quórum y participación.
            </p>
            <div className="space-y-2">
              {resumenNoValidacionPorSesion.filter((r) => r.unidades.length > 0 && r.titulo !== 'Verificación general').map((bloque, idx) => {
                const cierreStr = bloque.cierreAt
                  ? new Date(bloque.cierreAt).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
                  : ''
                const coefNoValidaron = bloque.unidades.reduce((s, u) => s + u.coeficiente, 0)
                return (
                  <div key={idx} className="break-inside-avoid">
                    <p className="text-xs font-semibold text-gray-800">
                      {bloque.titulo}{cierreStr ? ` — cierre ${cierreStr}` : ''}: <strong>{bloque.unidades.length}</strong> unidad(es) no validaron · Coeficiente total: <strong>{Math.min(100, coefNoValidaron).toFixed(2)}%</strong>
                    </p>
                    {!actaModoSoporte && (
                    <table className="w-full border-collapse text-xs mt-1.5" style={{ tableLayout: 'fixed' }} data-solo-auditoria="true">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-800" style={{ width: '9%' }}>Torre</th>
                          <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-800" style={{ width: '9%' }}>N.°</th>
                          <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-800" style={{ width: '28%' }}>Propietario / Residente</th>
                          <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-800" style={{ width: '28%' }}>Email</th>
                          <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-800" style={{ width: '17%' }}>Teléfono</th>
                          <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-gray-800" style={{ width: '9%' }}>Coef.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bloque.unidades.map((u) => (
                          <tr key={u.id} className="bg-white">
                            <td className="border border-gray-200 px-2 py-1">{u.torre || '—'}</td>
                            <td className="border border-gray-200 px-2 py-1">{u.numero || '—'}</td>
                            <td className="border border-gray-200 px-2 py-1" style={{ wordBreak: 'break-word' }}>{u.nombre_propietario || '—'}</td>
                            <td className="border border-gray-200 px-2 py-1" style={{ wordBreak: 'break-all' }}>{(u.email_propietario ?? '').trim() || 'No registrado'}</td>
                            <td className="border border-gray-200 px-2 py-1">{(u.telefono_propietario ?? '').trim() || '—'}</td>
                            <td className="border border-gray-200 px-2 py-1 text-right">{u.coeficiente.toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── FIRMAS ── */}
        <section className="mt-5 pt-4 border-t-2 border-gray-900 break-inside-avoid">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Firmas y aprobación del acta</h2>
          <div className="grid grid-cols-3 gap-8">
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Administrador(a)</p>
              <div className="h-14 border-b-2 border-gray-500 mt-6" />
              <div className="h-7 border-b border-gray-400 mt-4" />
              <p className="text-xs text-gray-600 mt-1">Nombre y CC</p>
              <p className="text-xs text-gray-600 mt-2">Fecha</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Presidente de la Asamblea</p>
              <div className="h-14 border-b-2 border-gray-500 mt-6" />
              <div className="h-7 border-b border-gray-400 mt-4" />
              <p className="text-xs text-gray-600 mt-1">Nombre y CC</p>
              <p className="text-xs text-gray-600 mt-2">Fecha</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Secretario(a) de la Asamblea</p>
              <div className="h-14 border-b-2 border-gray-500 mt-6" />
              <div className="h-7 border-b border-gray-400 mt-4" />
              <p className="text-xs text-gray-600 mt-1">Nombre y CC</p>
              <p className="text-xs text-gray-600 mt-2">Fecha</p>
            </div>
          </div>
        </section>

        {/* ── PIE DE PÁGINA ── */}
        <footer className="mt-5 pt-3 border-t border-gray-300 flex items-center justify-between text-xs text-gray-600 break-inside-avoid">
          <p>
            Este documento refleja las votaciones electrónicas registradas en la plataforma Votaciones de Asambleas Online.
            {asamblea?.id && <span className="block mt-1 text-gray-600 break-all font-mono text-[11px]">Ref. {asamblea.id}</span>}
          </p>
          <p className="text-right whitespace-nowrap ml-4">{new Date().toLocaleString('es-CO')}</p>
        </footer>
      </main>

      {/* Modal: elegir tipo de acta al descargar */}
      <Dialog open={showModalTipoActa} onOpenChange={setShowModalTipoActa}>
        <DialogContent showCloseButton={false} className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-600" />
              Descargar acta (PDF)
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
            Elige el tipo de acta que deseas descargar:
          </p>
          {poderesConDocumento.length > 0 && (
            <label className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirAnexosPoderes}
                onChange={(e) => setIncluirAnexosPoderes(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">
                Incluir documentos de poder como anexos ({poderesConDocumento.length} documento{poderesConDocumento.length !== 1 ? 's' : ''})
              </span>
            </label>
          )}
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              className="justify-start text-left h-auto py-3 px-4 border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/60 dark:hover:bg-slate-800/70 dark:text-gray-100"
              onClick={() => {
                setShowModalTipoActa(false)
                descargarSoporteConAnexosRef.current = incluirAnexosPoderes
                setActaModoSoporte(true)
                setDescargarSoportePendiente(true)
              }}
            >
              <span className="font-semibold block dark:text-white">Acta versión pública</span>
              <span className="text-xs text-gray-600 dark:text-gray-300 font-normal mt-0.5 block">
                Quórums generales, preguntas con resultados (porcentaje y total en coeficiente), aprobado/no aprobado, cantidades de unidades que no votaron o no validaron y coeficiente total. Para compartir con participantes.
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start text-left h-auto py-3 px-4 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 dark:text-gray-100"
              onClick={() => {
                setShowModalTipoActa(false)
                handleDescargarPdf(false, incluirAnexosPoderes)
              }}
            >
              <span className="font-semibold block dark:text-white">Acta con auditoría completa</span>
              <span className="text-xs text-gray-600 dark:text-gray-300 font-normal mt-0.5 block">
                Incluye quién votó qué, transacciones, IP y datos para revisión del administrador. Solo uso interno/auditoría.
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Certificado y cómo verificar (no forma parte del acta descargada) */}
      <Dialog open={showVerificacionModal} onOpenChange={setShowVerificacionModal}>
        <DialogContent showCloseButton={false} className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl relative">
          <button
            type="button"
            onClick={() => setShowVerificacionModal(false)}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <FileText className="w-5 h-5 text-emerald-600" />
              Certificado blockchain y verificación OpenTimestamps
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            {(asamblea?.acta_ots_proof_base64 || actaOtsBase64) ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-sm font-semibold text-emerald-800 mb-2">Esta asamblea tiene certificado .ots</p>
                <p className="text-sm text-gray-700 mb-3">El certificado corresponde al PDF del acta con auditoría. Descarga el .ots y verifica en opentimestamps.org usando ese mismo PDF.</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`data:application/octet-stream;base64,${asamblea?.acta_ots_proof_base64 || actaOtsBase64}`}
                    download={`acta-${asamblea?.nombre ?? 'asamblea'}-${params.id}.ots`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                  >
                    <Download className="w-4 h-4" />
                    Descargar certificado .ots
                  </a>
                  <a
                    href="https://opentimestamps.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-emerald-600 text-emerald-700 text-sm font-semibold hover:bg-emerald-50"
                  >
                    Abrir opentimestamps.org ↗
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-sm font-semibold text-amber-900 mb-1">Esta asamblea no tiene certificado .ots</p>
                <p className="text-xs text-amber-800 mb-3">
                  El certificado se genera al cerrar la asamblea con &quot;Finalizar Asamblea&quot; si la certificación está activada en tu plataforma. Si ya finalizaste y no aparece, activa la certificación en Ajustes y usa el botón de abajo para reintentar.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-amber-600 text-amber-800 hover:bg-amber-100"
                    disabled={certificando}
                    onClick={handleReintentarCertificacion}
                  >
                    {certificando ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Certificando…
                      </>
                    ) : (
                      'Reintentar certificación'
                    )}
                  </Button>
                  <a
                    href="https://opentimestamps.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-amber-500 text-amber-800 text-sm font-medium hover:bg-amber-100"
                  >
                    Conocer OpenTimestamps ↗
                  </a>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Cómo verificar en opentimestamps.org</p>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-600">
                <li>Abre opentimestamps.org (enlace de arriba).</li>
                <li>Arrastra el archivo .ots en la zona &quot;an .ots proof file to verify&quot;.</li>
                <li>Si pide el documento original, arrastra el PDF del acta.</li>
                <li>Verás la fecha de sellado en Bitcoin y el resultado de la verificación.</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
