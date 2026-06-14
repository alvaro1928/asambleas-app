#!/usr/bin/env node
/**
 * Extrae DDL de respuestas MCP (agent-tools) y escribe chunks en .export-chunks/
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const agentTools = path.join(
  process.env.USERPROFILE ?? '',
  '.cursor',
  'projects',
  'c-Users-Alvaro-Contreras-asambleas-app',
  'agent-tools',
)
const chunksDir = path.join(__dirname, '..', 'supabase', 'schema', '.export-chunks')

export function parseMcpDdl(raw) {
  let text = raw
  try {
    const outer = JSON.parse(raw)
    if (typeof outer.result === 'string') text = outer.result
  } catch {
    /* raw is already plain text */
  }
  const match = text.match(/<untrusted-data-[^>]+>\n([\s\S]*?)\n<\/untrusted-data/)
  const jsonText = match ? match[1] : text
  const data = JSON.parse(jsonText)
  let ddl
  if (Array.isArray(data)) {
    if (data.length === 1 && typeof data[0]?.ddl === 'string') ddl = data[0].ddl
    else ddl = data.map((r) => r.ddl).filter(Boolean).join('\n\n')
  } else {
    ddl = data.ddl
  }
  if (!ddl) throw new Error('DDL vacío en respuesta MCP')
  return ddl.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"')
}

const FILE_MAP = [
  ['d6e09b81-fc90-4036-9cdc-cefc02a662d2.txt', '05_functions_a.sql'],
  ['e1ae6d66-42b6-44d1-b779-934ce777f06c.txt', '05_functions_b.sql'],
]

async function main() {
  await mkdir(chunksDir, { recursive: true })
  for (const [src, dest] of FILE_MAP) {
    const raw = await readFile(path.join(agentTools, src), 'utf8')
    const ddl = parseMcpDdl(raw)
    await writeFile(path.join(chunksDir, dest), ddl, 'utf8')
    console.log(`Chunk: ${dest} (${ddl.length} chars)`)
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
