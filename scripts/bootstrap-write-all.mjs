#!/usr/bin/env node
/**
 * Materializa captures inner JSON desde respuestas MCP guardadas en
 * supabase/schema/.export-chunks/snapshot/bootstrap/mcp-responses/<section>.json
 *
 * Cada archivo debe ser el JSON completo devuelto por execute_sql MCP:
 * {"result":"Below is the result...\n\n<untrusted-data-...>\n[{\"ddl\":\"...\"}]\n</untrusted-data-...>\n\n..."}
 */
import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMcpRows, parseMcpDdl, fixDoubleSemicolons } from './lib/mcp-parse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MCP_DIR = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'bootstrap', 'mcp-responses')
const CAP = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'bootstrap', 'captures')
const PLAIN = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'plain')
const RAW = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'raw')
const AGENT = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? '',
  '.cursor',
  'projects',
  'c-Users-Alvaro-Contreras-asambleas-app',
  'agent-tools',
)

const FIX = { views: fixDoubleSemicolons }

const AGENT_FUNCTIONS = [
  ['functions_a', '9429d8fc-aa30-43cb-8c78-70794383315a.txt'],
  ['functions_b', '084a19e1-a967-48ca-aa2c-8b5880c6ca42.txt'],
]

async function writePlain(section, sql) {
  const fixed = FIX[section] ? FIX[section](sql) : sql
  await writeFile(path.join(PLAIN, `${section}.sql`), `${fixed.trim()}\n`, 'utf8')
  console.log(`plain/${section}.sql (${fixed.length} chars)`)
}

async function fromMcpFile(section, src) {
  const raw = await readFile(src, 'utf8')
  await writeFile(path.join(RAW, `${section}.mcp.txt`), raw, 'utf8')
  const inner = parseMcpRows(raw)
  await writeFile(path.join(CAP, `${section}.inner.json`), `${JSON.stringify(inner)}\n`, 'utf8')
  await writePlain(section, parseMcpDdl(raw))
}

async function main() {
  await mkdir(MCP_DIR, { recursive: true })
  await mkdir(CAP, { recursive: true })
  await mkdir(PLAIN, { recursive: true })
  await mkdir(RAW, { recursive: true })

  for (const [section, file] of AGENT_FUNCTIONS) {
    await fromMcpFile(section, path.join(AGENT, file))
  }

  const files = (await readdir(MCP_DIR)).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    const section = file.replace('.json', '')
    if (section.startsWith('functions_')) continue
    await fromMcpFile(section, path.join(MCP_DIR, file))
  }

  if (!files.length) {
    console.log('Coloca respuestas MCP en:', MCP_DIR)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
