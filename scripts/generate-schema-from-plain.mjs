#!/usr/bin/env node
/**
 * Genera public-schema.sql leyendo DDL plano en snapshot/plain/ + funciones en agent-tools.
 * No requiere SUPABASE_ACCESS_TOKEN si los plain/*.sql existen.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMcpDdl, normalizeSql, fixIndexSemicolons, fixDoubleSemicolons } from './lib/mcp-parse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PLAIN_DIR = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'plain')
const CHUNKS_DIR = path.join(ROOT, 'supabase', 'schema', '.export-chunks')
const OUT_FILE = path.join(ROOT, 'supabase', 'schema', 'restore', 'public-schema.sql')
const MANIFEST_FILE = path.join(ROOT, 'supabase', 'schema', 'MANIFEST.json')
const PROJECT_REF = 'zbfwuabsgnrpizckeump'
const AGENT_TOOLS = path.join(
  process.env.USERPROFILE ?? '',
  '.cursor',
  'projects',
  'c-Users-Alvaro-Contreras-asambleas-app',
  'agent-tools',
)

const ENUMS_SQL = `DO $$ BEGIN CREATE TYPE public.quorum_event_type AS ENUM ('joined', 'heartbeat', 'activity', 'vote_cast', 'stale', 'offline', 'reconnected', 'quorum_recalculated', 'quorum_lost', 'quorum_recovered', 'admin_override', 'snapshot_created'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quorum_presence_status AS ENUM ('online', 'idle', 'stale', 'offline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quorum_snapshot_type AS ENUM ('assembly_opening', 'voting_opening', 'voting_closing', 'quorum_change', 'assembly_closing', 'manual_check'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`

const PLAIN_SECTIONS = [
  ['02_tables', 'tables.sql'],
  ['03_constraints', 'constraints.sql'],
  ['04_indexes', 'indexes.sql'],
  ['06_triggers', 'triggers.sql'],
  ['07_views', 'views.sql'],
  ['08_rls_enable', 'rls_enable.sql'],
  ['09_policies', 'policies.sql'],
  ['10_comments', 'comments.sql'],
]

const FUNCTION_SOURCES = [
  ['d6e09b81-fc90-4036-9cdc-cefc02a662d2.txt', '05_functions_a.sql'],
  ['60b3de06-6767-41ad-9b11-47461f58295a.txt', '05_functions_b.sql'],
]

const header = () => `-- =============================================================================
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

async function readPlain(name) {
  return normalizeSql(await readFile(path.join(PLAIN_DIR, name), 'utf8'))
}

async function main() {
  await mkdir(CHUNKS_DIR, { recursive: true })
  await mkdir(path.dirname(OUT_FILE), { recursive: true })

  await writeFile(path.join(CHUNKS_DIR, '01_enums.sql'), ENUMS_SQL, 'utf8')

  for (const [chunkKey, plainFile] of PLAIN_SECTIONS) {
    let sql = await readPlain(plainFile)
    if (chunkKey === '04_indexes') sql = fixIndexSemicolons(sql)
    if (chunkKey === '07_views') sql = fixDoubleSemicolons(sql)
    await writeFile(path.join(CHUNKS_DIR, `${chunkKey}.sql`), sql, 'utf8')
    console.log(`Chunk ${chunkKey}: ${sql.length} chars`)
  }

  for (const [src, dest] of FUNCTION_SOURCES) {
    const sql = parseMcpDdl(await readFile(path.join(AGENT_TOOLS, src), 'utf8'))
    await writeFile(path.join(CHUNKS_DIR, dest), sql, 'utf8')
    console.log(`Chunk ${dest}: ${sql.length} chars`)
  }

  const sections = [
    ['-- Custom ENUM types', ENUMS_SQL],
    ['-- Tables (structure only)', await readPlain('tables.sql')],
    ['-- Primary keys, foreign keys, uniques, checks', await readPlain('constraints.sql')],
    ['-- Indexes', fixIndexSemicolons(await readPlain('indexes.sql'))],
    [
      '-- Functions (part 1)',
      parseMcpDdl(await readFile(path.join(AGENT_TOOLS, FUNCTION_SOURCES[0][0]), 'utf8')),
    ],
    [
      '-- Functions (part 2)',
      parseMcpDdl(await readFile(path.join(AGENT_TOOLS, FUNCTION_SOURCES[1][0]), 'utf8')),
    ],
    ['-- Triggers', await readPlain('triggers.sql')],
    ['-- Views', fixDoubleSemicolons(await readPlain('views.sql'))],
    ['-- Row Level Security (enable)', await readPlain('rls_enable.sql')],
    ['-- RLS policies', await readPlain('policies.sql')],
    ['-- Table comments', await readPlain('comments.sql')],
  ]

  const parts = [header()]
  const manifest = {
    project_ref: PROJECT_REF,
    generated_at: new Date().toISOString(),
    schema: 'public',
    tables: 34,
    functions: 57,
    sections: {},
  }

  for (const [title, sql] of sections) {
    parts.push(`${title}\n\n${sql}`)
    manifest.sections[title] = { chars: sql.length, lines: sql.split('\n').length }
  }

  const full = parts.join('\n\n')
  await writeFile(OUT_FILE, full, 'utf8')
  manifest.file = 'supabase/schema/restore/public-schema.sql'
  manifest.size_bytes = Buffer.byteLength(full, 'utf8')
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`Escrito: ${OUT_FILE} (${manifest.size_bytes} bytes)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
