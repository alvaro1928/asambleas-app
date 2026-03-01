'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Download, FileText, Printer, Loader2 } from 'lucide-react'
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

/** Voto final de una unidad en una pregunta (para cuadro de auditoría de votaciones finales) */
interface VotoFinalUnidad {
  torre: string
  numero: string
  nombre_propietario: string | null
  opcion_texto: string
  coeficiente: number
}

export default function ActaPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [conjunto, setConjunto] = useState<Conjunto | null>(null)
  const [preguntas, setPreguntas] = useState<(Pregunta & { opciones: Opcion[] })[]>([])
  const [estadisticas, setEstadisticas] = useState<Record<string, StatsPregunta>>({})
  const [quorum, setQuorum] = useState<Quorum | null>(null)
  const [totalPoderes, setTotalPoderes] = useState(0)
  const [coefPoderes, setCoefPoderes] = useState(0)
  const [auditoria, setAuditoria] = useState<Record<string, AuditRow[]>>({})
  const [incluyeActaDetallada, setIncluyeActaDetallada] = useState(false)
  const [tokensDisponibles, setTokensDisponibles] = useState(0)
  const [costoOperacion, setCostoOperacion] = useState(0)
  const [unidadesNoParticipation, setUnidadesNoParticipation] = useState<UnidadNoParticipo[]>([])
  /** Por pregunta: lista de votos finales (una fila por unidad con su opción elegida) para el cuadro de auditoría */
  const [votacionesFinalesPorPregunta, setVotacionesFinalesPorPregunta] = useState<Record<string, VotoFinalUnidad[]>>({})

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

      // Votaciones finales por pregunta: una fila por unidad con su opción elegida (último voto por unidad)
      const votacionesFinalesMap: Record<string, VotoFinalUnidad[]> = {}
      for (const p of preguntasConOpciones) {
        const { data: votosPregunta } = await supabase
          .from('votos')
          .select('unidad_id, opcion_id, created_at')
          .eq('pregunta_id', p.id)
          .order('created_at', { ascending: false })
        // Quedarse con el último voto por unidad (created_at desc → primera aparición por unidad_id)
        const porUnidad = new Map<string, { opcion_id: string }>()
        for (const v of votosPregunta || []) {
          const uid = (v as { unidad_id?: string }).unidad_id
          const oid = (v as { opcion_id?: string }).opcion_id
          if (uid && oid && !porUnidad.has(uid)) porUnidad.set(uid, { opcion_id: oid })
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
          const opcionId = porUnidad.get(u.id)?.opcion_id
          return {
            torre: u.torre ?? '',
            numero: u.numero ?? '',
            nombre_propietario: u.nombre_propietario ?? null,
            opcion_texto: opcionId ? (opcionesById.get(opcionId) ?? opcionId) : '—',
            coeficiente: Number(u.coeficiente) || 0,
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

      const { data: poderesData } = await supabase
        .from('poderes')
        .select('id, unidad_otorgante_id')
        .eq('asamblea_id', params.id)
        .eq('estado', 'activo')

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

      // Unidades que no votaron / no participaron: todas las unidades del conjunto menos las que tienen al menos un voto en alguna pregunta
      const preguntaIds = (preguntasConOpciones || []).map((p) => p.id)
      let unidadIdsVotaron: string[] = []
      if (preguntaIds.length > 0) {
        const { data: votosData } = await supabase
          .from('votos')
          .select('unidad_id')
          .in('pregunta_id', preguntaIds)
        unidadIdsVotaron = Array.from(new Set((votosData || []).map((v: any) => v.unidad_id).filter(Boolean)))
      }
      // Solo unidades del mismo tipo (demo o reales según asamblea/sandbox_usar_unidades_reales)
      const { data: todasUnidades } = await supabase
        .from('unidades')
        .select('id, torre, numero, nombre_propietario, email_propietario, telefono_propietario, coeficiente, is_demo')
        .eq('organization_id', asambleaData.organization_id)
        .eq('is_demo', esDemoUnidades)
      const filtrarDemoEnNombre = !esDemoUnidades
      const unidadesFiltradas = (todasUnidades || []).filter((u: any) => {
        if (!filtrarDemoEnNombre) return true
        const torre = (u.torre || '').toString()
        const nombre = (u.nombre_propietario || '').toString()
        return !torre.toLowerCase().includes('demo') && !nombre.toLowerCase().includes('demo')
      })
      const setVotaron = new Set(unidadIdsVotaron)
      const noParticiparon = unidadesFiltradas
        .filter((u: any) => !setVotaron.has(u.id))
        .map((u: any) => ({
          id: u.id,
          torre: u.torre ?? '',
          numero: u.numero ?? '',
          nombre_propietario: u.nombre_propietario ?? null,
          email_propietario: u.email_propietario ?? null,
          telefono_propietario: u.telefono_propietario ?? null,
          coeficiente: Number(u.coeficiente) || 0,
        }))
      setUnidadesNoParticipation(noParticiparon)
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
  const [certificando, setCertificando] = useState(false)
  const actaContentRef = useRef<HTMLElement>(null)
  const toast = useToast()

  useEffect(() => {
    if (params.id && typeof window !== 'undefined') {
      setActaGenerada(sessionStorage.getItem('acta_generada_' + params.id) === '1')
    }
  }, [params.id])

  /** Descontar tokens y marcar acta como generada; luego se puede imprimir sin volver a cobrar (Ctrl+P o botón). */
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
        toast.error(certData?.error ?? 'Error al certificar. Revisa que la certificación esté activada en Ajustes.')
      } else if (certData.skipped) {
        toast.info('Activa la certificación blockchain en Super Admin → Ajustes para generar el .ots.')
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

  const handlePrint = () => {
    window.print()
  }

  /** Descarga el acta (incluyendo certificado blockchain si existe) como PDF. */
  const handleDescargarPdf = async () => {
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

    try {
      const html2pdf = (await import('html2pdf.js')).default
      const nombreSeguro = (asamblea?.nombre ?? 'asamblea').replace(/[^a-zA-Z0-9\u00C0-\u024F\s.-]/g, '').trim().slice(0, 80) || 'acta'
      const filename = `acta-${nombreSeguro}-${params.id}.pdf`.replace(/\s+/g, '_')
      const opts = {
        margin: [12, 10, 12, 10] as [number, number, number, number],
        filename,
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
      // Descargar el PDF
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      // Certificar con el hash del PDF para que opentimestamps.org valide este mismo archivo
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
        } else if (certRes.ok && certData.skipped) {
          toast.info('Activa la certificación blockchain en Ajustes para generar el .ots que coincida con este PDF.')
        }
      } catch {
        // No bloquear la descarga si falla la certificación
      }
    } catch (e) {
      console.error('Error al generar PDF:', e)
      setPrintError('No se pudo generar el PDF. Usa Imprimir y elige "Guardar como PDF".')
    } finally {
      // Restaurar estilos originales
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

  // Puerta: generar acta consume tokens; confirmar antes de mostrar el acta (luego pueden imprimir con Ctrl+P sin volver a cobrar)
  if (!actaGenerada) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6 print:hidden">
        <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 text-center">
          <FileText className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Generar acta
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            El cobro es <strong>solo al activar la asamblea</strong> (una vez). Si ya activaste, puedes generar el acta sin nuevo cobro. Una vez generada, podrás imprimir (Ctrl+P o botón) cuantas veces quieras.
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
            Acta generada. Imprimir (Ctrl+P o botón) no consume más tokens.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {printError && (
            <p className="text-sm text-amber-600 dark:text-amber-400">{printError}</p>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowVerificacionModal(true)}
              className={(asamblea?.acta_ots_proof_base64 || actaOtsBase64) ? 'border-emerald-600 text-emerald-700 hover:bg-emerald-50' : 'border-slate-400 text-slate-600 hover:bg-slate-100'}
            >
              <FileText className="w-4 h-4 mr-2" />
              Certificado y cómo verificar
            </Button>
            <Button
              onClick={handleDescargarPdf}
              disabled={descargandoPdf}
              variant="outline"
              className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            >
              {descargandoPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Descargar acta (PDF)
            </Button>
            <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      <main ref={actaContentRef} className="max-w-4xl mx-auto px-8 py-10 print:py-6 bg-white text-gray-900">

        {/* ── ENCABEZADO ── */}
        <header className="mb-8">
          <div className="flex items-start justify-between border-b-4 border-gray-900 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Votaciones de Asambleas Online</p>
              <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900">Acta de votación</h1>
            </div>
            <div className="text-right text-xs text-gray-500 mt-1">
              <p>Generada: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              {isDemo && <p className="mt-1 text-red-600 font-semibold uppercase">Demo — sin validez legal</p>}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
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
          <p className="mb-6 text-sm text-gray-700 border-l-4 border-emerald-500 pl-3 py-1">
            Este acta fue sellada en la blockchain de Bitcoin (OpenTimestamps). Verificación:{' '}
            <a href="https://opentimestamps.org" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 underline">
              https://opentimestamps.org
            </a>
          </p>
        )}

        {/* ── QUÓRUM ── */}
        {quorum && (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3 pb-1 border-b border-gray-200">Quórum y participación</h2>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700 w-1/2">Total de unidades del conjunto</td>
                  <td className="border border-gray-200 px-3 py-2 text-gray-900">{quorum.total_unidades}</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Unidades que votaron</td>
                  <td className="border border-gray-200 px-3 py-2 text-gray-900">{quorum.unidades_votantes}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Unidades que no votaron</td>
                  <td className="border border-gray-200 px-3 py-2 text-gray-900">{quorum.total_unidades - quorum.unidades_votantes}</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Participación por coeficiente</td>
                  <td className="border border-gray-200 px-3 py-2 text-gray-900 font-semibold">{Math.min(100, Number(quorum.porcentaje_participacion_coeficiente)).toFixed(2)}%</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Coeficiente votante</td>
                  <td className="border border-gray-200 px-3 py-2 text-gray-900">{Math.min(100, Number(quorum.coeficiente_votante)).toFixed(2)}%</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-bold text-gray-900">Quórum alcanzado</td>
                  <td className={`border border-gray-200 px-3 py-2 font-bold ${quorum.quorum_alcanzado ? 'text-green-700' : 'text-red-700'}`}>
                    {quorum.quorum_alcanzado ? '✓ Sí' : '✗ No'}
                  </td>
                </tr>
                {totalPoderes > 0 && (
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Poderes registrados</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-900">{totalPoderes} unidades — coef. delegado {Math.min(100, coefPoderes).toFixed(2)}%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* ── RESULTADOS POR PREGUNTA ── */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4 pb-1 border-b border-gray-200">Resultados por pregunta</h2>
          <div className="space-y-10">
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
              let items: { opcion_texto: string; pct: number; count: number }[] = stats
                ? (resumenDesdeTabla && pregunta.tipo_votacion === 'coeficiente'
                    ? Object.entries(resumenDesdeTabla).map(([opcion, { coef, count }]) => ({
                        opcion_texto: opcion,
                        pct: totalCoefVotantes > 0 ? (coef / totalCoefVotantes) * 100 : 0,
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
              const opcionAfavor = items.find((i) => i.opcion_texto?.trim().toLowerCase().includes('a favor'))
              const pctAfavor = opcionAfavor?.pct ?? 0
              const aprobado = pregunta.umbral_aprobacion != null && pctAfavor >= pregunta.umbral_aprobacion

              return (
                <div key={pregunta.id}>
                  {/* Título de pregunta */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
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
                  <div className="ml-10 mb-3">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Resultados de la pregunta</p>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold text-gray-700">Opción</th>
                          <th className="border border-gray-200 px-3 py-1.5 text-right font-semibold text-gray-700 w-24">Votos</th>
                          <th className="border border-gray-200 px-3 py-1.5 text-right font-semibold text-gray-700 w-24">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length > 0 ? items.map((item, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            <td className="border border-gray-200 px-3 py-1.5 text-gray-900">{item.opcion_texto}</td>
                            <td className="border border-gray-200 px-3 py-1.5 text-right text-gray-700">{item.count}</td>
                            <td className="border border-gray-200 px-3 py-1.5 text-right font-semibold text-gray-900">{item.pct.toFixed(2)}%</td>
                          </tr>
                        )) : (
                          <tr><td colSpan={3} className="border border-gray-200 px-3 py-2 text-gray-500 text-center">Sin opciones o sin votos registrados</td></tr>
                        )}
                      </tbody>
                    </table>
                    {pregunta.umbral_aprobacion != null && items.length > 0 && (
                      <p
                        className="text-sm font-bold mt-2 px-3 py-1.5 rounded"
                        style={{ background: aprobado ? '#f0fdf4' : '#fff7ed', color: aprobado ? '#166534' : '#92400e', border: `1px solid ${aprobado ? '#bbf7d0' : '#fde68a'}` }}
                      >
                        {aprobado ? '✓ APROBADO' : '✗ NO APROBADO'} — Mayoría requerida: {pregunta.umbral_aprobacion}% · Obtenido: {pctAfavor.toFixed(2)}%
                      </p>
                    )}
                  </div>

                  {/* Votación final por unidad (siempre visible para auditoría) */}
                  <div className="ml-10 mt-3">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Votación final por unidad</p>
                    <table className="w-full border-collapse" style={{ fontSize: '11px' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          <th className="border border-gray-200 px-2 py-1 text-left font-semibold" style={{ width: '12%' }}>Unidad</th>
                          <th className="border border-gray-200 px-2 py-1 text-left font-semibold" style={{ width: '40%' }}>Propietario / Residente</th>
                          <th className="border border-gray-200 px-2 py-1 text-left font-semibold" style={{ width: '30%' }}>Voto final</th>
                          <th className="border border-gray-200 px-2 py-1 text-right font-semibold" style={{ width: '18%' }}>Coef. %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {votosFinales.length > 0 ? votosFinales.map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            <td className="border border-gray-200 px-2 py-1" style={{ wordBreak: 'break-word' }}>{row.torre}-{row.numero}</td>
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

                  {/* Auditoría de transacciones (siempre visible para auditoría) */}
                  <div className="ml-10 mt-3">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Auditoría de transacciones (cambios de voto, quién votó, cuándo)</p>
                    <table className="w-full border-collapse" style={{ fontSize: '10px', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          <th className="border border-gray-200 px-1.5 py-1 text-left font-semibold" style={{ width: '22%' }}>Votante</th>
                          <th className="border border-gray-200 px-1.5 py-1 text-left font-semibold" style={{ width: '9%' }}>Unidad</th>
                          <th className="border border-gray-200 px-1.5 py-1 text-left font-semibold" style={{ width: '14%' }}>Opción</th>
                          <th className="border border-gray-200 px-1.5 py-1 text-left font-semibold" style={{ width: '20%' }}>Acción</th>
                          <th className="border border-gray-200 px-1.5 py-1 text-left font-semibold" style={{ width: '18%' }}>Fecha/hora</th>
                          <th className="border border-gray-200 px-1.5 py-1 text-left font-semibold" style={{ width: '17%' }}>IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditoria[pregunta.id] && auditoria[pregunta.id].length > 0 ? auditoria[pregunta.id].map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            <td className="border border-gray-200 px-1.5 py-1" style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}>
                              {row.votante_email}{row.votante_nombre ? ` (${row.votante_nombre})` : ''}
                            </td>
                            <td className="border border-gray-200 px-1.5 py-1" style={{ wordBreak: 'break-word' }}>
                              {row.unidad_torre}-{row.unidad_numero}{row.es_poder ? ' *' : ''}
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
                </div>
              )
            })}
          </div>
        </section>

        {/* ── UNIDADES QUE NO PARTICIPARON ── */}
        {unidadesNoParticipation.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3 pb-1 border-b border-gray-200">
              Unidades que no participaron ({unidadesNoParticipation.length})
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Coeficiente total no participante: <strong>{Math.min(100, unidadesNoParticipation.reduce((s, u) => s + u.coeficiente, 0)).toFixed(2)}%</strong>
              {quorum && <> · {unidadesNoParticipation.length} no votaron de {quorum.total_unidades} unidades</>}
            </p>
            <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold" style={{ width: '9%' }}>Torre</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold" style={{ width: '9%' }}>N.°</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold" style={{ width: '30%' }}>Propietario / Residente</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold" style={{ width: '29%' }}>Email</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold" style={{ width: '14%' }}>Teléfono</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-right font-semibold" style={{ width: '9%' }}>Coef.</th>
                </tr>
              </thead>
              <tbody>
                {unidadesNoParticipation.map((u) => (
                  <tr key={u.id}>
                    <td className="border border-gray-200 px-2 py-1">{u.torre || '—'}</td>
                    <td className="border border-gray-200 px-2 py-1">{u.numero || '—'}</td>
                    <td className="border border-gray-200 px-2 py-1" style={{ wordBreak: 'break-word' }}>{u.nombre_propietario || '—'}</td>
                    <td className="border border-gray-200 px-2 py-1" style={{ wordBreak: 'break-all' }}>{u.email_propietario?.trim() || 'No registrado'}</td>
                    <td className="border border-gray-200 px-2 py-1">{u.telefono_propietario?.trim() || '—'}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right">{u.coeficiente.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── FIRMAS ── */}
        <section className="mt-12 pt-6 border-t-2 border-gray-900">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-6">Firmas y aprobación del acta</h2>
          <div className="grid grid-cols-3 gap-8">
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Administrador(a)</p>
              <div className="h-14 border-b-2 border-gray-400 mt-6" />
              <div className="h-7 border-b border-gray-300 mt-4" />
              <p className="text-xs text-gray-400 mt-1">Nombre y CC</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Presidente de la Asamblea</p>
              <div className="h-14 border-b-2 border-gray-400 mt-6" />
              <div className="h-7 border-b border-gray-300 mt-4" />
              <p className="text-xs text-gray-400 mt-1">Nombre y CC</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Secretario(a) de la Asamblea</p>
              <div className="h-14 border-b-2 border-gray-400 mt-6" />
              <div className="h-7 border-b border-gray-300 mt-4" />
              <p className="text-xs text-gray-400 mt-1">Nombre y CC</p>
            </div>
          </div>
        </section>

        {/* ── PIE DE PÁGINA ── */}
        <footer className="mt-10 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
          <p>Este documento refleja las votaciones electrónicas registradas en la plataforma Votaciones de Asambleas Online.</p>
          <p className="text-right whitespace-nowrap ml-4">{new Date().toLocaleString('es-CO')}</p>
        </footer>
      </main>

      {/* Modal: Certificado y cómo verificar (no forma parte del acta descargada) */}
      <Dialog open={showVerificacionModal} onOpenChange={setShowVerificacionModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Certificado blockchain y verificación OpenTimestamps
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            {(asamblea?.acta_ots_proof_base64 || actaOtsBase64) ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-sm font-semibold text-emerald-800 mb-2">Esta asamblea tiene certificado .ots</p>
                <p className="text-sm text-gray-700 mb-3">Descarga el archivo .ots y verifica en opentimestamps.org con el PDF del acta.</p>
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
