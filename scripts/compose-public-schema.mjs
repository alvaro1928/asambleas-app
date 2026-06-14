#!/usr/bin/env node
/**
 * Ensambla supabase/schema/restore/public-schema.sql desde snapshot/plain/*.sql
 * y genera MANIFEST.json con conteos verificables.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixDoubleSemicolons, fixIndexSemicolons, normalizeSql } from './lib/mcp-parse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PLAIN = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'plain')
const OUT_FILE = path.join(ROOT, 'supabase', 'schema', 'restore', 'public-schema.sql')
const MANIFEST_FILE = path.join(ROOT, 'supabase', 'schema', 'MANIFEST.json')
const PROJECT_REF = 'zbfwuabsgnrpizckeump'

const ENUMS_SQL = `DO $$ BEGIN CREATE TYPE public.quorum_event_type AS ENUM ('joined', 'heartbeat', 'activity', 'vote_cast', 'stale', 'offline', 'reconnected', 'quorum_recalculated', 'quorum_lost', 'quorum_recovered', 'admin_override', 'snapshot_created'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quorum_presence_status AS ENUM ('online', 'idle', 'stale', 'offline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quorum_snapshot_type AS ENUM ('assembly_opening', 'voting_opening', 'voting_closing', 'quorum_change', 'assembly_closing', 'manual_check'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`

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

async function readPlain(name, fix) {
  let sql = normalizeSql(await readFile(path.join(PLAIN, name), 'utf8'))
  if (fix === 'indexes') sql = fixIndexSemicolons(sql)
  if (fix === 'views') sql = fixDoubleSemicolons(sql)
  return sql.trim()
}

function countMatches(sql, pattern) {
  return (sql.match(pattern) ?? []).length
}

async function main() {
  const functionsA = await readPlain('functions_a.sql')
  const functionsB = await readPlain('functions_b.sql')
  const functions = `${functionsA}\n\n${functionsB}`

  const sections = [
    ['-- Custom ENUM types', ENUMS_SQL],
    ['-- Tables (structure only)', await readPlain('tables.sql')],
    ['-- Primary keys, foreign keys, uniques, checks', await readPlain('constraints.sql')],
    ['-- Indexes', await readPlain('indexes.sql', 'indexes')],
    ['-- Functions', functions],
    ['-- Triggers', await readPlain('triggers.sql')],
    ['-- Views', await readPlain('views.sql', 'views')],
    ['-- Row Level Security (enable)', await readPlain('rls_enable.sql')],
    ['-- RLS policies', await readPlain('policies.sql')],
    ['-- Table comments', await readPlain('comments.sql')],
  ]

  const parts = [header()]
  const manifest = {
    project_ref: PROJECT_REF,
    generated_at: new Date().toISOString(),
    schema: 'public',
    source: 'supabase/schema/.export-chunks/snapshot/plain',
    counts: {},
    sections: {},
  }

  for (const [title, sql] of sections) {
    parts.push(`${title}\n\n${sql}`)
    manifest.sections[title.replace(/^--\s*/, '')] = {
      chars: sql.length,
      lines: sql.split('\n').length,
    }
  }

  const full = `${parts.join('\n\n')}\n`
  await mkdir(path.dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, full, 'utf8')

  const tablesSql = sections[1][1]
  manifest.counts = {
    tables: countMatches(tablesSql, /CREATE TABLE IF NOT EXISTS public\./g),
    functions: countMatches(functions, /CREATE OR REPLACE FUNCTION public\./g),
    triggers: countMatches(sections[5][1], /CREATE TRIGGER /g),
    views: countMatches(sections[6][1], /CREATE OR REPLACE VIEW public\./g),
    rls_tables: countMatches(sections[7][1], /ENABLE ROW LEVEL SECURITY/g),
    policies: countMatches(sections[8][1], /^CREATE POLICY /gm),
    comments: countMatches(sections[9][1], /^COMMENT ON TABLE /gm),
  }
  manifest.file = 'supabase/schema/restore/public-schema.sql'
  manifest.size_bytes = Buffer.byteLength(full, 'utf8')

  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const plainFiles = (await readdir(PLAIN)).filter((f) => f.endsWith('.sql'))
  console.log(`Plain files: ${plainFiles.length}`)
  console.log(`Counts:`, manifest.counts)
  console.log(`Escrito: ${OUT_FILE} (${manifest.size_bytes} bytes)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
