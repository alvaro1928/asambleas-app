import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const MAX_CERTIFICADOS_POR_HORA = 3
const VENTANA_HORA_MS = 60 * 60 * 1000

// Rate limit en memoria: clave = `${email}:${asamblea_id}`, valor = timestamps de las últimas solicitudes
const timestampsPorClave = new Map<string, number[]>()

function puedeEmitirCertificado(email: string, asambleaId: string): boolean {
  const clave = `${email.toLowerCase().trim()}:${asambleaId}`
  const ahora = Date.now()
  const ventana = ahora - VENTANA_HORA_MS

  let list = timestampsPorClave.get(clave) ?? []
  list = list.filter((t) => t > ventana)
  if (list.length >= MAX_CERTIFICADOS_POR_HORA) return false

  list.push(ahora)
  timestampsPorClave.set(clave, list)
  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const codigo = typeof body.codigo === 'string' ? body.codigo.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''

    if (!codigo || !email) {
      return NextResponse.json(
        { error: 'Faltan código de acceso o email.' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const { data: codigoData, error: codigoError } = await supabase.rpc(
      'validar_codigo_acceso',
      { p_codigo: codigo.toUpperCase() }
    )

    if (codigoError || !codigoData?.length) {
      return NextResponse.json(
        { error: 'Código de acceso inválido.' },
        { status: 400 }
      )
    }

    const asambleaInfo = codigoData[0]
    if (!asambleaInfo.acceso_valido) {
      return NextResponse.json(
        { error: asambleaInfo.mensaje ?? 'Acceso denegado.' },
        { status: 403 }
      )
    }

    const asambleaId = asambleaInfo.asamblea_id
    const nombreAsamblea = asambleaInfo.nombre ?? 'Asamblea'
    const nombreConjunto = asambleaInfo.nombre_conjunto ?? 'Conjunto'
    const fechaAsamblea = asambleaInfo.fecha
      ? new Date(asambleaInfo.fecha).toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : ''

    const identificador = email.includes('@') ? email.toLowerCase() : email
    const { data: votanteData, error: votanteError } = await supabase.rpc(
      'validar_votante_asamblea',
      {
        p_codigo_asamblea: codigo.toUpperCase(),
        p_email_votante: identificador,
      }
    )

    if (votanteError || !votanteData?.length) {
      return NextResponse.json(
        { error: 'No tienes permiso para votar en esta asamblea con este correo o teléfono.' },
        { status: 403 }
      )
    }

    if (!puedeEmitirCertificado(identificador, asambleaId)) {
      return NextResponse.json(
        {
          error: `Máximo ${MAX_CERTIFICADOS_POR_HORA} certificados por hora. Intenta más tarde.`,
          code: 'RATE_LIMIT',
        },
        { status: 429 }
      )
    }

    const { data: preguntasData } = await supabase
      .from('preguntas')
      .select('id')
      .eq('asamblea_id', asambleaId)

    const preguntaIds = (preguntasData ?? []).map((p: { id: string }) => p.id)

    if (preguntaIds.length === 0) {
      const fechaEmision = new Date().toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
      const html = buildCertificadoHtml({
        nombreAsamblea,
        nombreConjunto,
        fechaAsamblea,
        fechaEmision,
        email: identificador,
        filas: [],
      })
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'inline; filename="certificado-mis-votos.html"',
        },
      })
    }

    const { data: votosData, error: votosError } = await supabase
      .from('votos')
      .select(
        `
        pregunta_id,
        unidad_id,
        opcion_id,
        created_at,
        preguntas(asamblea_id, texto_pregunta, orden),
        opciones_pregunta(texto_opcion),
        unidades(torre, numero)
      `
      )
      .eq('votante_email', identificador)
      .in('pregunta_id', preguntaIds)

    if (votosError) {
      return NextResponse.json(
        { error: 'Error al obtener tus votos.' },
        { status: 500 }
      )
    }

    const norm = (x: any) => (Array.isArray(x) ? x[0] : x)
    const votosFiltrados = votosData ?? []

    const filas = votosFiltrados
      .sort((a: any, b: any) => {
        const pA = norm(a.preguntas)
        const pB = norm(b.preguntas)
        const ordenA = pA?.orden ?? 0
        const ordenB = pB?.orden ?? 0
        if (ordenA !== ordenB) return ordenA - ordenB
        const uA = norm(a.unidades)
        const uB = norm(b.unidades)
        const torreA = uA?.torre ?? ''
        const torreB = uB?.torre ?? ''
        if (torreA !== torreB) return String(torreA).localeCompare(String(torreB))
        return String(uA?.numero ?? '').localeCompare(String(uB?.numero ?? ''))
      })
      .map((v: any) => {
        const p = norm(v.preguntas)
        const u = norm(v.unidades)
        const o = norm(v.opciones_pregunta)
        const fechaHora = v.created_at
          ? new Date(v.created_at).toLocaleString('es-CO', {
              dateStyle: 'short',
              timeStyle: 'medium',
            })
          : '—'
        return {
          pregunta: p?.texto_pregunta ?? '—',
          unidad: `${u?.torre ?? ''} - ${u?.numero ?? ''}`.trim() || '—',
          opcion: o?.texto_opcion ?? '—',
          fechaHora,
        }
      })

    const fechaEmision = new Date().toLocaleString('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    })
    const html = buildCertificadoHtml({
      nombreAsamblea,
      nombreConjunto,
      fechaAsamblea,
      fechaEmision,
      email: identificador,
      filas,
    })

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline; filename="certificado-mis-votos.html"',
      },
    })
  } catch (e) {
    console.error('[api/votar/certificado-mis-votos]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al generar el certificado.' },
      { status: 500 }
    )
  }
}

function buildCertificadoHtml(params: {
  nombreAsamblea: string
  nombreConjunto: string
  fechaAsamblea: string
  fechaEmision: string
  email: string
  filas: Array<{ pregunta: string; unidad: string; opcion: string; fechaHora?: string }>
}): string {
  const { nombreAsamblea, nombreConjunto, fechaAsamblea, fechaEmision, email, filas } = params

  const filasHtml =
    filas.length === 0
      ? '<tr><td colspan="4" style="text-align:center;padding:1rem;">No hay votos registrados para esta asamblea.</td></tr>'
      : filas
          .map(
            (f) =>
              `<tr>
                <td style="padding:0.5rem 0.75rem;border:1px solid #e5e7eb;">${escapeHtml(f.pregunta)}</td>
                <td style="padding:0.5rem 0.75rem;border:1px solid #e5e7eb;">${escapeHtml(f.unidad)}</td>
                <td style="padding:0.5rem 0.75rem;border:1px solid #e5e7eb;">${escapeHtml(f.opcion)}</td>
                <td style="padding:0.5rem 0.75rem;border:1px solid #e5e7eb;">${escapeHtml(f.fechaHora ?? '—')}</td>
              </tr>`
          )
          .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Certificado de mis votos - ${escapeHtml(nombreAsamblea)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #111; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .subtitle { color: #555; font-size: 0.95rem; margin-bottom: 0.5rem; }
    .fecha-emision { font-size: 0.9rem; color: #374151; margin-bottom: 1.5rem; }
    .votante { margin-bottom: 1.5rem; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th { background: #f3f4f6; padding: 0.5rem 0.75rem; text-align: left; border: 1px solid #e5e7eb; }
    .footer { margin-top: 2rem; font-size: 0.85rem; color: #6b7280; }
    @media print {
      @page { margin: 1.5cm; }
      body { margin: 0; max-width: none; padding: 0; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; }
      table { overflow: visible; width: 100%; }
    }
  </style>
</head>
<body>
  <h1>Certificado de votación</h1>
  <p class="subtitle">Registro de tus votos emitidos (transparencia)</p>
  <p class="fecha-emision"><strong>Certificado emitido el:</strong> ${escapeHtml(fechaEmision)}</p>
  <p><strong>Asamblea:</strong> ${escapeHtml(nombreAsamblea)}</p>
  <p><strong>Conjunto:</strong> ${escapeHtml(nombreConjunto)}</p>
  ${fechaAsamblea ? `<p><strong>Fecha de la asamblea:</strong> ${escapeHtml(fechaAsamblea)}</p>` : ''}
  <p class="votante"><strong>Votante:</strong> ${escapeHtml(email)}</p>
  <p><strong>Detalle de votos:</strong></p>
  <table>
    <thead>
      <tr>
        <th>Pregunta</th>
        <th>Unidad</th>
        <th>Tu voto</th>
        <th>Fecha/hora (registro)</th>
      </tr>
    </thead>
    <tbody>${filasHtml}</tbody>
  </table>
  <p class="footer">Documento generado el ${fechaEmision}. Puedes guardar o imprimir esta página como PDF.</p>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
