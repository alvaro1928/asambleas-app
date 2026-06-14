#!/usr/bin/env node
/**
 * Materializa chunks en .export-chunks/ y ensambla public-schema.sql.
 *
 * Fuentes (en orden):
 * 1. SUPABASE_ACCESS_TOKEN → export-schema-backup.mjs
 * 2. supabase/schema/.export-chunks/snapshot/*.mcp.json (respuestas MCP guardadas)
 * 3. agent-tools de Cursor (funciones)
 *
 * Uso: node scripts/materialize-and-compose.mjs
 */
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import {
  parseMcpDdl,
  normalizeSql,
  fixIndexSemicolons,
  fixDoubleSemicolons,
} from './lib/mcp-parse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CHUNKS_DIR = path.join(ROOT, 'supabase', 'schema', '.export-chunks')
const SNAPSHOT_DIR = path.join(CHUNKS_DIR, 'snapshot')
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

const ENUMS_SQL = `-- Custom ENUM types
DO $$ BEGIN CREATE TYPE public.quorum_event_type AS ENUM ('joined', 'heartbeat', 'activity', 'vote_cast', 'stale', 'offline', 'reconnected', 'quorum_recalculated', 'quorum_lost', 'quorum_recovered', 'admin_override', 'snapshot_created'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quorum_presence_status AS ENUM ('online', 'idle', 'stale', 'offline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quorum_snapshot_type AS ENUM ('assembly_opening', 'voting_opening', 'voting_closing', 'quorum_change', 'assembly_closing', 'manual_check'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`

const SNAPSHOT_MAP = [
  ['02_tables', 'tables.mcp.json'],
  ['03_constraints', 'constraints.mcp.json'],
  ['04_indexes', 'indexes.mcp.json'],
  ['06_triggers', 'triggers.mcp.json'],
  ['07_views', 'views.mcp.json'],
  ['08_rls_enable', 'rls_enable.mcp.json'],
  ['09_policies', 'policies.mcp.json'],
  ['10_comments', 'comments.mcp.json'],
]

const FUNCTION_SOURCES = [
  ['d6e09b81-fc90-4036-9cdc-cefc02a662d2.txt', '05_functions_a.sql'],
  ['60b3de06-6767-41ad-9b11-47461f58295a.txt', '05_functions_b.sql'],
]

async function fileExists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function runExportWithToken() {
  if (!process.env.SUPABASE_ACCESS_TOKEN?.trim()) return false
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/export-schema-backup.mjs'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('exit', (code) => resolve(code === 0))
  })
}

async function writeChunk(name, sql) {
  await writeFile(path.join(CHUNKS_DIR, `${name}.sql`), sql, 'utf8')
}

async function materializeFromSnapshotAndAgentTools() {
  await mkdir(CHUNKS_DIR, { recursive: true })
  await writeChunk('01_enums', ENUMS_SQL)

  for (const [chunkKey, snapshotFile] of SNAPSHOT_MAP) {
    const snapshotPath = path.join(SNAPSHOT_DIR, snapshotFile)
    if (!(await fileExists(snapshotPath))) {
      throw new Error(`Falta snapshot: ${snapshotPath}`)
    }
    let sql = parseMcpDdl(await readFile(snapshotPath, 'utf8'))
    if (chunkKey === '04_indexes') sql = fixIndexSemicolons(sql)
    if (chunkKey === '07_views') sql = fixDoubleSemicolons(sql)
    await writeChunk(chunkKey, sql)
    console.log(`Chunk: ${chunkKey}.sql (${sql.length} chars)`)
  }

  for (const [src, dest] of FUNCTION_SOURCES) {
    const srcPath = path.join(AGENT_TOOLS, src)
    if (!(await fileExists(srcPath))) {
      throw new Error(`Falta agent-tools: ${srcPath}`)
    }
    const sql = parseMcpDdl(await readFile(srcPath, 'utf8'))
    await writeFile(path.join(CHUNKS_DIR, dest), sql, 'utf8')
    console.log(`Chunk: ${dest} (${sql.length} chars)`)
  }
}

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

const SECTIONS = [
  { file: '01_enums.sql', title: '-- Custom ENUM types' },
  { file: '02_tables.sql', title: '-- Tables (structure only)' },
  { file: '03_constraints.sql', title: '-- Primary keys, foreign keys, uniques, checks' },
  { file: '04_indexes.sql', title: '-- Indexes' },
  { file: '05_functions_a.sql', title: '-- Functions (part 1)' },
  { file: '05_functions_b.sql', title: '-- Functions (part 2)' },
  { file: '06_triggers.sql', title: '-- Triggers' },
  { file: '07_views.sql', title: '-- Views' },
  { file: '08_rls_enable.sql', title: '-- Row Level Security (enable)' },
  { file: '09_policies.sql', title: '-- RLS policies' },
  { file: '10_comments.sql', title: '-- Table comments' },
]

async function assembleFromChunks() {
  const parts = [header()]
  const manifest = {
    project_ref: PROJECT_REF,
    generated_at: new Date().toISOString(),
    schema: 'public',
    source: 'chunks',
    sections: {},
  }

  for (const section of SECTIONS) {
    const filePath = path.join(CHUNKS_DIR, section.file)
    let sql = normalizeSql(await readFile(filePath, 'utf8'))
    parts.push(`${section.title}\n\n${sql}`)
    manifest.sections[section.file.replace('.sql', '')] = {
      lines: sql.split('\n').length,
      chars: sql.length,
    }
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

async function main() {
  if (await runExportWithToken()) {
    console.log('Exportado vía SUPABASE_ACCESS_TOKEN')
    return
  }

  const snapshotOk = await fileExists(path.join(SNAPSHOT_DIR, 'tables.mcp.json'))
  if (!snapshotOk) {
    console.error(
      'Sin SUPABASE_ACCESS_TOKEN ni snapshots en supabase/schema/.export-chunks/snapshot/',
    )
    console.error('Guarda respuestas MCP con scripts/save-mcp-snapshot.mjs o usa export-schema-backup.mjs')
    process.exit(1)
  }

  await materializeFromSnapshotAndAgentTools()
  await assembleFromChunks()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
