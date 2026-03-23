/**
 * Genera una página HTML imprimible con el censo de unidades y columna para firma manual.
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

export function buildHtmlListaAsistenciaUnidades(
  conjuntoNombre: string,
  filas: FilaListaAsistenciaUnidad[],
  generadoEn: Date = new Date()
): string {
  const ordenadas = [...filas].sort(ordenarFilas)
  const fechaStr = generadoEn.toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  const bodyRows = ordenadas
    .map((u, i) => {
      const torre = escapeHtml(String(u.torre ?? '—'))
      const num = escapeHtml(String(u.numero ?? ''))
      const prop = escapeHtml(String(u.nombre_propietario ?? '—'))
      const coef = typeof u.coeficiente === 'number' && !Number.isNaN(u.coeficiente) ? u.coeficiente.toFixed(4) : '—'
      return `<tr>
  <td style="text-align:center">${i + 1}</td>
  <td>${torre}</td>
  <td>${num}</td>
  <td>${prop}</td>
  <td style="text-align:right">${coef}</td>
  <td style="min-height:36px;border-bottom:1px solid #333">&nbsp;</td>
</tr>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Lista de asistencia — ${escapeHtml(conjuntoNombre)}</title>
  <style>
    body { font-family: system-ui, Segoe UI, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    .meta { font-size: 0.85rem; color: #444; margin-bottom: 20px; }
    .nota { font-size: 0.8rem; color: #555; margin-bottom: 16px; max-width: 720px; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    th, td { border: 1px solid #333; padding: 6px 8px; vertical-align: middle; }
    th { background: #f0f0f0; text-align: left; }
    @media print {
      body { margin: 12mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <p class="no-print nota"><strong>Uso:</strong> Imprime desde el navegador (Ctrl+P) o elige &quot;Guardar como PDF&quot;. Cada propietario o representante puede firmar frente a su unidad como respaldo de asistencia manual.</p>
  <h1>Lista de unidades — asistencia (firma)</h1>
  <p class="meta"><strong>Conjunto:</strong> ${escapeHtml(conjuntoNombre)}<br />
  <strong>Total unidades:</strong> ${ordenadas.length} · <strong>Generado:</strong> ${escapeHtml(fechaStr)}</p>
  <table>
    <thead>
      <tr>
        <th style="width:36px">N.º</th>
        <th style="width:64px">Torre</th>
        <th style="width:72px">Unidad</th>
        <th>Propietario / titular</th>
        <th style="width:72px">Coef. %</th>
        <th style="min-width:140px">Firma</th>
      </tr>
    </thead>
    <tbody>
${bodyRows}
    </tbody>
  </table>
</body>
</html>`
}

/** Abre una ventana con la lista lista para imprimir o guardar como PDF. */
export function abrirListaAsistenciaImpresion(conjuntoNombre: string, filas: FilaListaAsistenciaUnidad[]): boolean {
  const html = buildHtmlListaAsistenciaUnidades(conjuntoNombre, filas)
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}

/** Descarga un archivo .html con la misma lista (por si el bloqueador impide ventanas nuevas). */
export function descargarListaAsistenciaHtml(conjuntoNombre: string, filas: FilaListaAsistenciaUnidad[]): void {
  const html = buildHtmlListaAsistenciaUnidades(conjuntoNombre, filas)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safe = conjuntoNombre.replace(/[^\w\-]+/g, '_').slice(0, 48) || 'conjunto'
  a.href = url
  a.download = `lista-asistencia-unidades-${safe}.html`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
