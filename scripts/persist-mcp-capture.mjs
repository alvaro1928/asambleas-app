#!/usr/bin/env node
/**
 * Guarda respuesta MCP (JSON) en snapshot/raw/<section>.mcp.txt
 * y opcionalmente decodifica a snapshot/plain/<section>.sql
 *
 * Uso:
 *   node scripts/persist-mcp-capture.mjs tables path/to/response.json
 *   node scripts/persist-mcp-capture.mjs --decode-all
 */
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMcpDdl, fixIndexSemicolons, fixDoubleSemicolons } from './lib/mcp-parse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW = path.join(__dirname, '..', 'supabase', 'schema', '.export-chunks', 'snapshot', 'raw')
const PLAIN = path.join(__dirname, '..', 'supabase', 'schema', '.export-chunks', 'snapshot', 'plain')

const FIX = {
  indexes: fixIndexSemicolons,
  views: fixDoubleSemicolons,
}

async function decodeAll() {
  await mkdir(PLAIN, { recursive: true })
  const files = (await readdir(RAW)).filter((f) => f.endsWith('.mcp.txt'))
  for (const file of files) {
    const key = file.replace('.mcp.txt', '')
    let sql = parseMcpDdl(await readFile(path.join(RAW, file), 'utf8'))
    if (FIX[key]) sql = FIX[key](sql)
    await writeFile(path.join(PLAIN, `${key}.sql`), `${sql}\n`, 'utf8')
    console.log(`plain/${key}.sql (${sql.length} chars)`)
  }
}

async function persist(section, src) {
  await mkdir(RAW, { recursive: true })
  const dest = path.join(RAW, `${section}.mcp.txt`)
  await copyFile(src, dest)
  console.log(`raw/${section}.mcp.txt`)
  let sql = parseMcpDdl(await readFile(dest, 'utf8'))
  if (FIX[section]) sql = FIX[section](sql)
  await mkdir(PLAIN, { recursive: true })
  await writeFile(path.join(PLAIN, `${section}.sql`), `${sql}\n`, 'utf8')
  console.log(`plain/${section}.sql (${sql.length} chars)`)
}

async function main() {
  if (process.argv[2] === '--decode-all') {
    await decodeAll()
    return
  }
  const [, , section, src] = process.argv
  if (!section || !src) {
    console.error('Uso: node scripts/persist-mcp-capture.mjs <section> <archivo.json>')
    console.error('     node scripts/persist-mcp-capture.mjs --decode-all')
    process.exit(1)
  }
  await persist(section, src)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
