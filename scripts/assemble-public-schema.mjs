#!/usr/bin/env node
/**
 * Ensambla public-schema.sql desde respuestas MCP (agent-tools) o chunks .sql.
 * Uso: node scripts/assemble-public-schema.mjs
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CHUNKS_DIR = path.join(ROOT, 'supabase', 'schema', '.export-chunks')
const OUT_FILE = path.join(ROOT, 'supabase', 'schema', 'restore', 'public-schema.sql')
const MANIFEST_FILE = path.join(ROOT, 'supabase', 'schema', 'MANIFEST.json')
const PROJECT_REF = 'zbfwuabsgnrpizckeump'

function parseMcpJsonFile(raw) {
  const match = raw.match(/<untrusted-data-[^>]+>\n([\s\S]*?)\n<\/untrusted-data/)
  if (!match) {
    try {
      return JSON.parse(raw)
    } catch {
      throw new Error('No se pudo parsear respuesta MCP')
    }
  }
  return JSON.parse(match[1])
}

function ddlFromMcpContent(raw) {
  const data = parseMcpJsonFile(raw)
  if (!Array.isArray(data)) return String(data?.ddl ?? '')
  if (data.length === 1 && data[0]?.ddl && typeof data[0].ddl === 'string') {
    return data[0].ddl.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
  }
  return data
    .map((row) => row.ddl)
    .filter(Boolean)
    .map((d) => d.replace(/\\n/g, '\n').replace(/\\r/g, '\r'))
    .join('\n\n')
}

async function readChunk(name) {
  const file = path.join(CHUNKS_DIR, name)
  const raw = await readFile(file, 'utf8')
  if (name.endsWith('.json')) return ddlFromMcpContent(raw)
  return raw
}

function fixConstraintPublicPrefix(sql) {
  return sql.replace(/^ALTER TABLE (?!public\.)([a-z_]+)/gm, 'ALTER TABLE public.$1')
}

function fixDoubleSemicolons(sql) {
  return sql.replace(/;;+/g, ';')
}

const header = `-- =============================================================================
-- BACKUP DE ESQUEMA (solo estructura, sin datos)
-- Proyecto: asambleas-saas (${PROJECT_REF})
-- Schema: public
-- Generado: ${new Date().toISOString()}
--
-- Restaurar: ver supabase/schema/README.md
-- NO ejecutar scripts sueltos en supabase/*.sql — usar solo este archivo.
-- =============================================================================

SET client_min_messages TO warning;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
`

const SECTIONS = [
  { key: '01_enums', title: '-- Custom ENUM types' },
  { key: '02_tables', title: '-- Tables (structure only)' },
  { key: '03_constraints', title: '-- Primary keys, foreign keys, uniques, checks' },
  { key: '04_indexes', title: '-- Indexes' },
  { key: '05_functions_a', title: '-- Functions (part 1)' },
  { key: '05_functions_b', title: '-- Functions (part 2)' },
  { key: '06_triggers', title: '-- Triggers' },
  { key: '07_views', title: '-- Views' },
  { key: '08_rls_enable', title: '-- Row Level Security (enable)' },
  { key: '09_policies', title: '-- RLS policies' },
  { key: '10_comments', title: '-- Table comments' },
]

async function main() {
  const parts = [header]
  const manifest = {
    project_ref: PROJECT_REF,
    generated_at: new Date().toISOString(),
    schema: 'public',
    sections: {},
  }

  for (const section of SECTIONS) {
    let sql = ''
    for (const ext of ['.json', '.sql']) {
      try {
        sql = await readChunk(`${section.key}${ext}`)
        break
      } catch {
        /* try next ext */
      }
    }
    if (!sql) {
      console.warn(`Omitido (sin chunk): ${section.key}`)
      continue
    }
    if (section.key === '03_constraints') sql = fixConstraintPublicPrefix(sql)
    if (section.key === '07_views') sql = fixDoubleSemicolons(sql)
    sql = sql.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
    parts.push(`${section.title}\n\n${sql}`)
    manifest.sections[section.key] = { lines: sql.split('\n').length, chars: sql.length }
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true })
  const full = parts.join('\n\n')
  await writeFile(OUT_FILE, full, 'utf8')
  manifest.tables = 34
  manifest.functions = 57
  manifest.file = 'supabase/schema/restore/public-schema.sql'
  manifest.size_bytes = Buffer.byteLength(full, 'utf8')
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`Escrito: ${OUT_FILE} (${manifest.size_bytes} bytes)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
