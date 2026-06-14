#!/usr/bin/env node
/**
 * Guarda una respuesta MCP (archivo .txt de agent-tools o JSON) en snapshot/.
 *
 * Uso:
 *   node scripts/save-mcp-snapshot.mjs tables path/to/mcp-response.txt
 */
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_DIR = path.join(__dirname, '..', 'supabase', 'schema', '.export-chunks', 'snapshot')

const NAMES = {
  tables: 'tables.mcp.json',
  constraints: 'constraints.mcp.json',
  indexes: 'indexes.mcp.json',
  triggers: 'triggers.mcp.json',
  views: 'views.mcp.json',
  rls_enable: 'rls_enable.mcp.json',
  policies: 'policies.mcp.json',
  comments: 'comments.mcp.json',
}

async function main() {
  const [, , key, src] = process.argv
  if (!key || !src || !NAMES[key]) {
    console.error('Uso: node scripts/save-mcp-snapshot.mjs <tables|constraints|...> <archivo-mcp.txt>')
    process.exit(1)
  }
  await mkdir(SNAPSHOT_DIR, { recursive: true })
  const dest = path.join(SNAPSHOT_DIR, NAMES[key])
  await copyFile(src, dest)
  console.log(`Guardado: ${dest}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
