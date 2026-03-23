/**
 * Lista de censo para firma manual: genera PDF en cliente (html2pdf.js),
 * mismo enfoque liviano que el acta (JPEG + jsPDF con compress).
 */

export interface FilaListaAsistenciaUnidad {
  torre?: string | null
  numero: string
  nombre_propietario?: string | null
  coeficiente: number
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ordenarFilas(a: FilaListaAsistenciaUnidad, b: FilaListaAsistenciaUnidad): number {
  const ta = String(a.torre ?? '').localeCompare(String(b.torre ?? ''), 'es', { numeric: true })
  if (ta !== 0) return ta
  return String(a.numero ?? '').localeCompare(String(b.numero ?? ''), 'es', { numeric: true })
}

/** HTML con estilos en línea (fondo claro) para captura html2canvas → PDF. */
export function buildListaAsistenciaInnerHtml(
  conjuntoNombre: string,
  filas: FilaListaAsistenciaUnidad[],
  generadoEn: Date = new Date()
): string {
  const ordenadas = [...filas].sort(ordenarFilas)
  const fechaStr = generadoEn.toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  const rows = ordenadas
    .map((u, i) => {
      const torre = escapeHtml(String(u.torre ?? '—'))
      const num = escapeHtml(String(u.numero ?? ''))
      const prop = escapeHtml(String(u.nombre_propietario ?? '—'))
      const coef =
        typeof u.coeficiente === 'number' && !Number.isNaN(u.coeficiente) ? u.coeficiente.toFixed(4) : '—'
      return `<tr>
  <td style="text-align:center;border:1px solid #222;padding:5px 6px;">${i + 1}</td>
  <td style="border:1px solid #222;padding:5px 6px;">${torre}</td>
  <td style="border:1px solid #222;padding:5px 6px;">${num}</td>
  <td style="border:1px solid #222;padding:5px 6px;">${prop}</td>
  <td style="text-align:right;border:1px solid #222;padding:5px 6px;">${coef}</td>
  <td style="border:1px solid #222;padding:16px 8px;min-width:100px;">&nbsp;</td>
</tr>`
    })
    .join('\n')

  const titulo = escapeHtml(conjuntoNombre)
  return `<div style="box-sizing:border-box;font-family:Helvetica,Arial,sans-serif;color:#111;background:#fff;font-size:10px;line-height:1.35;padding:4px;">
  <p style="margin:0 0 10px;font-size:13px;font-weight:bold;">Lista de unidades — asistencia (firma manual)</p>
  <p style="margin:0 0 12px;font-size:9px;color:#333;">
    <strong>Conjunto:</strong> ${titulo}<br/>
    <strong>Unidades:</strong> ${ordenadas.length} · <strong>Generado:</strong> ${escapeHtml(fechaStr)} (Colombia)
  </p>
  <p style="margin:0 0 10px;font-size:8px;color:#444;">
    Cada copropietario o representante puede firmar frente a su unidad como respaldo de asistencia.
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:9px;">
    <thead>
      <tr>
        <th style="text-align:center;border:1px solid #222;background:#eee;padding:6px 6px;width:28px;">N.º</th>
        <th style="border:1px solid #222;background:#eee;padding:6px 6px;width:48px;">Torre</th>
        <th style="border:1px solid #222;background:#eee;padding:6px 6px;width:52px;">Unidad</th>
        <th style="border:1px solid #222;background:#eee;padding:6px 6px;">Propietario / titular</th>
        <th style="text-align:right;border:1px solid #222;background:#eee;padding:6px 6px;width:56px;">Coef. %</th>
        <th style="border:1px solid #222;background:#eee;padding:6px 6px;min-width:110px;">Firma</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</div>`
}

function filenameListaPdf(conjuntoNombre: string): string {
  const safe = conjuntoNombre.replace(/[^a-zA-Z0-9\u00C0-\u024F\s.-]/g, '').trim().slice(0, 64) || 'conjunto'
  return `lista-asistencia-firmas-${safe.replace(/\s+/g, '_')}.pdf`
}

/**
 * Descarga un PDF liviano (misma pipeline que el acta: html2pdf.js, JPEG, jsPDF compress).
 */
export async function descargarListaAsistenciaPdf(
  conjuntoNombre: string,
  filas: FilaListaAsistenciaUnidad[]
): Promise<void> {
  if (typeof document === 'undefined') return

  const inner = buildListaAsistenciaInnerHtml(conjuntoNombre, filas)
  const el = document.createElement('div')
  el.setAttribute('data-lista-asistencia-pdf', '1')
  el.style.position = 'fixed'
  el.style.left = '-12000px'
  el.style.top = '0'
  el.style.width = '800px'
  el.style.backgroundColor = '#ffffff'
  el.style.color = '#111111'
  el.innerHTML = inner
  document.body.appendChild(el)

  try {
    const html2pdf = (await import('html2pdf.js')).default
    const filename = filenameListaPdf(conjuntoNombre)
    const opts = {
      margin: [12, 10, 12, 10] as [number, number, number, number],
      filename,
      image: { type: 'jpeg' as const, quality: 0.82 },
      html2canvas: {
        scale: 1.25,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: el.scrollWidth + 40,
      },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const, compress: true },
    }
    const blob = (await html2pdf().set(opts).from(el).toPdf().output('blob')) as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } finally {
    document.body.removeChild(el)
  }
}
