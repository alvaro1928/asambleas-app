#!/usr/bin/env node
/**
 * Escribe snapshot/plain/*.sql decodificando {"ddl":"..."} desde snapshot/bootstrap/*.json
 * Generado por exportación MCP (execute_sql con string_agg).
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixDoubleSemicolons, fixIndexSemicolons } from './lib/mcp-parse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOOT = path.join(__dirname, '..', 'supabase', 'schema', '.export-chunks', 'snapshot', 'bootstrap')
const PLAIN = path.join(__dirname, '..', 'supabase', 'schema', '.export-chunks', 'snapshot', 'plain')

const FIX = {
  indexes: fixIndexSemicolons,
  views: fixDoubleSemicolons,
}

async function main() {
  await mkdir(PLAIN, { recursive: true })
  const files = (await readdir(BOOT)).filter((f) => f.endsWith('.json'))
  if (!files.length) {
    console.error('No hay archivos en snapshot/bootstrap/*.json')
    process.exit(1)
  }
  for (const file of files) {
    const key = file.replace('.json', '')
    const { ddl } = JSON.parse(await readFile(path.join(BOOT, file), 'utf8'))
    if (typeof ddl !== 'string' || !ddl.trim()) {
      throw new Error(`DDL vacío en bootstrap/${file}`)
    }
    let sql = ddl.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"')
    if (FIX[key]) sql = FIX[key](sql)
    await writeFile(path.join(PLAIN, `${key}.sql`), `${sql.trim()}\n`, 'utf8')
    console.log(`${key}.sql (${sql.length} chars)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
