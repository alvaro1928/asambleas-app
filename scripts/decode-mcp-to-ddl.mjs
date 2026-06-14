#!/usr/bin/env node
/** Decodifica respuesta MCP → ddl-source/<section>.sql */
import { mkdir, writeFile, readFileSync } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMcpDdl, fixDoubleSemicolons } from './lib/mcp-parse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const [, , section, src] = process.argv
if (!section || !src) {
  console.error('Uso: node scripts/decode-mcp-to-ddl.mjs <section> <archivo-mcp.json>')
  process.exit(1)
}
const FIX = { views: fixDoubleSemicolons }
const raw = readFileSync(src, 'utf8')
let ddl = parseMcpDdl(raw)
if (FIX[section]) ddl = FIX[section](ddl)
const outDir = path.join(__dirname, '..', 'supabase', 'schema', '.export-chunks', 'snapshot', 'bootstrap', 'ddl-source')
await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, `${section}.sql`), `${ddl.trim()}\n`, 'utf8')
console.log(`ddl-source/${section}.sql (${ddl.length} chars)`)
