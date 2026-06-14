#!/usr/bin/env node
/**
 * Convierte un archivo JSON de respuesta MCP (execute_sql) a snapshot/plain/<section>.sql
 * Uso: node scripts/import-mcp-json-to-plain.mjs tables path/to/response.json
 */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMcpDdl, fixIndexSemicolons, fixDoubleSemicolons } from './lib/mcp-parse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PLAIN = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'plain')
const RAW = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'raw')

const FIX = {
  indexes: fixIndexSemicolons,
  views: fixDoubleSemicolons,
}

async function main() {
  const [, , section, src] = process.argv
  if (!section || !src) {
    console.error('Uso: node scripts/import-mcp-json-to-plain.mjs <section> <archivo-mcp.json>')
    process.exit(1)
  }
  await mkdir(PLAIN, { recursive: true })
  await mkdir(RAW, { recursive: true })
  const raw = await readFile(src, 'utf8')
  await copyFile(src, path.join(RAW, `${section}.mcp.txt`))
  let sql = parseMcpDdl(raw)
  if (FIX[section]) sql = FIX[section](sql)
  await writeFile(path.join(PLAIN, `${section}.sql`), `${sql.trim()}\n`, 'utf8')
  console.log(`plain/${section}.sql (${sql.length} chars)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
