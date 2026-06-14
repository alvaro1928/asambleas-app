/**
 * Parsea respuestas del MCP Supabase (execute_sql) y extrae DDL.
 */
export function parseMcpRows(raw) {
  let text = raw
  try {
    const outer = JSON.parse(raw)
    if (typeof outer.result === 'string') text = outer.result
  } catch {
    /* plain text */
  }
  const match = text.match(/<untrusted-data-[^>]+>\n([\s\S]*?)\n<\/untrusted-data/)
  const jsonText = match ? match[1] : text
  return JSON.parse(jsonText)
}

export function parseMcpDdl(raw) {
  const data = parseMcpRows(raw)
  let ddl
  if (Array.isArray(data)) {
    if (data.length === 1 && typeof data[0]?.ddl === 'string') ddl = data[0].ddl
    else if (data.length === 1 && typeof data[0]?.chunk === 'string') ddl = data[0].chunk
    else {
      ddl = data
        .map((row) => row.ddl ?? row.chunk)
        .filter(Boolean)
        .join('\n\n')
    }
  } else if (typeof data?.ddl === 'string') {
    ddl = data.ddl
  } else if (typeof data?.chunk === 'string') {
    ddl = data.chunk
  }
  if (!ddl) throw new Error('DDL vacío en respuesta MCP')
  return normalizeSql(ddl)
}

export function normalizeSql(sql) {
  let s = sql
  for (let i = 0; i < 4; i++) {
    const next = s.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"')
    if (next === s) break
    s = next
  }
  // Residuo de format() sin E'…' en exportaciones antiguas: "…;\nCREATE …"
  return s.replace(/;\\\r?\n/g, ';\n')
}

export function fixIndexSemicolons(sql) {
  return sql
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('CREATE ') && !trimmed.endsWith(';')) return `${line};`
      return line
    })
    .join('\n')
}

export function fixDoubleSemicolons(sql) {
  return sql.replace(/;;+/g, ';')
}
