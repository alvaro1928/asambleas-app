#!/usr/bin/env node
/**
 * Guarda respuestas MCP (archivo .txt con JSON de execute_sql) en snapshot/raw/
 * y genera snapshot/plain/*.sql
 *
 * Uso:
 *   node scripts/fetch-plain-via-mcp-save.mjs tables path/to/mcp-response.txt
 */
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const RAW = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'raw')
const [, , key, src] = process.argv

if (!key || !src) {
  console.error('Uso: node scripts/fetch-plain-via-mcp-save.mjs <nombre> <archivo-mcp.txt>')
  process.exit(1)
}

await mkdir(RAW, { recursive: true })
const dest = path.join(RAW, `${key}.mcp.txt`)
await copyFile(src, dest)
console.log(`Copiado → ${dest}`)

const r = spawnSync(process.execPath, ['scripts/write-plain-from-mcp-files.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
})
process.exit(r.status ?? 1)
