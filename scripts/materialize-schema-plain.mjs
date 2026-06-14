#!/usr/bin/env node
/**
 * Materializa snapshot/plain/*.sql desde respuestas MCP guardadas en snapshot/raw/*.mcp.txt
 * y copia functions desde agent-tools si faltan.
 *
 * Uso:
 *   node scripts/materialize-schema-plain.mjs
 *   node scripts/materialize-schema-plain.mjs --from-agent-tools
 */
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMcpDdl, fixDoubleSemicolons } from './lib/mcp-parse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const RAW = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'raw')
const PLAIN = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'plain')
const AGENT = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? '',
  '.cursor',
  'projects',
  'c-Users-Alvaro-Contreras-asambleas-app',
  'agent-tools',
)

const FIX = {
  views: fixDoubleSemicolons,
}

const AGENT_FUNCTIONS = [
  ['functions_a', '9429d8fc-aa30-43cb-8c78-70794383315a.txt'],
  ['functions_b', '084a19e1-a967-48ca-aa2c-8b5880c6ca42.txt'],
]

async function writePlain(section, sql) {
  await mkdir(PLAIN, { recursive: true })
  const fixed = FIX[section] ? FIX[section](sql) : sql
  await writeFile(path.join(PLAIN, `${section}.sql`), `${fixed.trim()}\n`, 'utf8')
  console.log(`plain/${section}.sql (${fixed.length} chars)`)
}

async function fromRaw(section) {
  const rawPath = path.join(RAW, `${section}.mcp.txt`)
  try {
    const raw = await readFile(rawPath, 'utf8')
    const sql = parseMcpDdl(raw)
    await writePlain(section, sql)
    return true
  } catch {
    return false
  }
}

async function fromAgentTools() {
  for (const [section, file] of AGENT_FUNCTIONS) {
    const src = path.join(AGENT, file)
    const raw = await readFile(src, 'utf8')
    await mkdir(RAW, { recursive: true })
    await writeFile(path.join(RAW, `${section}.mcp.txt`), raw, 'utf8')
    await writePlain(section, parseMcpDdl(raw))
  }
}

async function decodeAllRaw() {
  await mkdir(PLAIN, { recursive: true })
  const files = (await readdir(RAW)).filter((f) => f.endsWith('.mcp.txt'))
  for (const file of files) {
    const section = file.replace('.mcp.txt', '')
    if (section.endsWith('_a') || section.endsWith('_b')) continue
    await fromRaw(section)
  }
}

async function main() {
  if (process.argv.includes('--from-agent-tools')) {
    await fromAgentTools()
  }
  await decodeAllRaw()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
