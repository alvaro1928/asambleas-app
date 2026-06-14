#!/usr/bin/env node
/**
 * Decodifica snapshot/raw/*.mcp.txt → snapshot/plain/*.sql
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
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

async function main() {
  await mkdir(PLAIN, { recursive: true })
  const files = (await readdir(RAW)).filter((f) => f.endsWith('.mcp.txt'))
  if (!files.length) {
    console.error('No hay archivos .mcp.txt en snapshot/raw/')
    process.exit(1)
  }
  for (const file of files) {
    const key = file.replace('.mcp.txt', '')
    let sql = parseMcpDdl(await readFile(path.join(RAW, file), 'utf8'))
    if (FIX[key]) sql = FIX[key](sql)
    await writeFile(path.join(PLAIN, `${key}.sql`), sql, 'utf8')
    console.log(`${key}.sql (${sql.length} bytes)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
