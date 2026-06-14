#!/usr/bin/env node
/**
 * Guarda respuesta MCP desde stdin o archivo → raw/<section>.mcp.txt + plain/<section>.sql
 * Uso: node scripts/save-mcp-stdin.mjs tables [archivo.json]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMcpDdl, fixDoubleSemicolons } from './lib/mcp-parse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const RAW = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'raw')
const PLAIN = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'plain')

const FIX = { views: fixDoubleSemicolons }

async function readInput(src) {
  if (src) return readFile(src, 'utf8')
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const [, , section, src] = process.argv
  if (!section) {
    console.error('Uso: node scripts/save-mcp-stdin.mjs <section> [archivo.json]')
    process.exit(1)
  }
  const raw = await readInput(src)
  await mkdir(RAW, { recursive: true })
  await mkdir(PLAIN, { recursive: true })
  await writeFile(path.join(RAW, `${section}.mcp.txt`), raw, 'utf8')
  let sql = parseMcpDdl(raw)
  if (FIX[section]) sql = FIX[section](sql)
  await writeFile(path.join(PLAIN, `${section}.sql`), `${sql.trim()}\n`, 'utf8')
  console.log(`OK ${section}: ${sql.length} chars`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
