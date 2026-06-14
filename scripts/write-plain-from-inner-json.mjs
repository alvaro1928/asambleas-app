#!/usr/bin/env node
/**
 * Escribe snapshot/plain/*.sql desde archivos bootstrap/captures/<section>.inner.json
 * Formato: [{"ddl":"..."}] (respuesta agregada de execute_sql)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeSql, fixDoubleSemicolons } from './lib/mcp-parse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CAP = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'bootstrap', 'captures')
const PLAIN = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'plain')
const RAW = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'raw')

const FIX = { views: fixDoubleSemicolons }

const SECTIONS = ['tables', 'constraints', 'indexes', 'views', 'policies']

async function main() {
  await mkdir(PLAIN, { recursive: true })
  await mkdir(RAW, { recursive: true })
  for (const section of SECTIONS) {
    const src = path.join(CAP, `${section}.inner.json`)
    let inner
    try {
      inner = JSON.parse(await readFile(src, 'utf8'))
    } catch {
      console.warn(`skip ${section}: falta ${src}`)
      continue
    }
    const ddl = normalizeSql(inner[0]?.ddl ?? '')
    if (!ddl.trim()) {
      console.warn(`skip ${section}: ddl vacío`)
      continue
    }
    const sql = FIX[section] ? FIX[section](ddl) : ddl
    await writeFile(path.join(PLAIN, `${section}.sql`), `${sql.trim()}\n`, 'utf8')
    await writeFile(path.join(RAW, `${section}.mcp.txt`), JSON.stringify({ result: JSON.stringify(inner) }), 'utf8')
    console.log(`plain/${section}.sql (${sql.length} chars)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
