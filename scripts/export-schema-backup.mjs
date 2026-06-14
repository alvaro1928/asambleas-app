#!/usr/bin/env node
/**
 * Exporta el esquema public actual de Supabase a un único SQL restaurable.
 *
 * Requiere Personal Access Token de Supabase:
 *   https://supabase.com/dashboard/account/tokens
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
 *   node scripts/export-schema-backup.mjs
 *
 * Salida:
 *   supabase/schema/restore/public-schema.sql
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_REF = 'zbfwuabsgnrpizckeump'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN?.trim()

if (!TOKEN) {
  console.error('Falta SUPABASE_ACCESS_TOKEN. Genera uno en Supabase → Account → Access Tokens.')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'supabase', 'schema', 'restore')
const OUT_FILE = path.join(OUT_DIR, 'public-schema.sql')

async function runQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Query failed (${res.status}): ${text}`)
  }
  const json = await res.json()
  return json.result ?? json
}

function rows(result) {
  if (Array.isArray(result)) return result
  if (result && Array.isArray(result.rows)) return result.rows
  return []
}

function cell(row, key) {
  return row[key] ?? row[key.toUpperCase()]
}

async function sectionEnums() {
  const result = await runQuery(`
    SELECT t.typname,
           string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname;
  `)
  const lines = ['-- Custom ENUM types']
  for (const r of rows(result)) {
    lines.push(`DO $$ BEGIN CREATE TYPE public.${cell(r, 'typname')} AS ENUM (${cell(r, 'labels')}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`)
  }
  return lines.join('\n')
}

async function sectionTables() {
  const result = await runQuery(`
    SELECT c.relname AS table_name,
      'CREATE TABLE IF NOT EXISTS public.' || quote_ident(c.relname) || E' (\\n' ||
      string_agg(
        '    ' || quote_ident(a.attname) || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod) ||
        CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN ad.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END,
        E',\\n' ORDER BY a.attnum
      ) || E'\\n);' AS ddl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
    GROUP BY c.relname
    ORDER BY c.relname;
  `)
  const lines = ['-- Tables (structure only)']
  for (const r of rows(result)) lines.push(cell(r, 'ddl'))
  return lines.join('\n\n')
}

async function sectionConstraints() {
  const result = await runQuery(`
    SELECT conrelid::regclass::text AS table_name, conname,
      pg_get_constraintdef(c.oid, true) AS def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND c.contype IN ('p','f','u','c')
    ORDER BY 1, conname;
  `)
  const lines = ['-- Primary keys, foreign keys, uniques, checks']
  for (const r of rows(result)) {
    const table = cell(r, 'table_name').replace(/^public\./, '')
    lines.push(`ALTER TABLE public.${table} DROP CONSTRAINT IF EXISTS ${cell(r, 'conname')};`)
    lines.push(`ALTER TABLE public.${table} ADD CONSTRAINT ${cell(r, 'conname')} ${cell(r, 'def')};`)
  }
  return lines.join('\n')
}

async function sectionIndexes() {
  const result = await runQuery(`
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `)
  const lines = ['-- Indexes']
  for (const r of rows(result)) {
    const ddl = cell(r, 'indexdef').replace(/^CREATE (UNIQUE )?INDEX/, 'CREATE $1INDEX IF NOT EXISTS')
    lines.push(`${ddl};`)
  }
  return lines.join('\n')
}

async function sectionFunctions() {
  const result = await runQuery(`
    SELECT pg_get_functiondef(p.oid) AS ddl
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
    ORDER BY p.proname;
  `)
  const lines = ['-- Functions']
  for (const r of rows(result)) lines.push(`${cell(r, 'ddl')};`)
  return lines.join('\n\n')
}

async function sectionTriggers() {
  const result = await runQuery(`
    SELECT pg_get_triggerdef(t.oid, true) AS ddl
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname = 'public'
    ORDER BY c.relname, t.tgname;
  `)
  const lines = ['-- Triggers']
  for (const r of rows(result)) lines.push(`${cell(r, 'ddl')};`)
  return lines.join('\n')
}

async function sectionViews() {
  const result = await runQuery(`
    SELECT 'CREATE OR REPLACE VIEW public.' || quote_ident(viewname) || ' AS ' || definition AS ddl
    FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;
  `)
  const lines = ['-- Views']
  for (const r of rows(result)) lines.push(`${cell(r, 'ddl')};`)
  return lines.join('\n\n')
}

async function sectionRls() {
  const enable = await runQuery(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true ORDER BY tablename;
  `)
  const policies = await runQuery(`
    SELECT schemaname, tablename, policyname,
      format(
        'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
        policyname, schemaname, tablename,
        CASE WHEN permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
        cmd, array_to_string(roles, ', '),
        CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END,
        CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END
      ) AS ddl
    FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
  `)
  const lines = ['-- Row Level Security']
  for (const r of rows(enable)) {
    lines.push(`ALTER TABLE public.${cell(r, 'tablename')} ENABLE ROW LEVEL SECURITY;`)
  }
  lines.push('')
  for (const r of rows(policies)) {
    lines.push(`DROP POLICY IF EXISTS ${cell(r, 'policyname')} ON public.${cell(r, 'tablename')};`)
    lines.push(cell(r, 'ddl'))
  }
  return lines.join('\n')
}

async function sectionComments() {
  const result = await runQuery(`
    SELECT c.relname AS table_name, obj_description(c.oid, 'pg_class') AS comment
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND obj_description(c.oid, 'pg_class') IS NOT NULL
    ORDER BY c.relname;
  `)
  const lines = ['-- Table comments']
  for (const r of rows(result)) {
    const comment = cell(r, 'comment').replace(/'/g, "''")
    lines.push(`COMMENT ON TABLE public.${cell(r, 'table_name')} IS '${comment}';`)
  }
  return lines.join('\n')
}

const header = `-- =============================================================================
-- BACKUP DE ESQUEMA (solo estructura, sin datos)
-- Proyecto: asambleas-saas (${PROJECT_REF})
-- Schema: public
-- Generado: ${new Date().toISOString()}
--
-- Restaurar en proyecto vacío o tras DROP SCHEMA public CASCADE:
--   Ver supabase/schema/README.md
-- =============================================================================

SET client_min_messages TO warning;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

`

async function main() {
  console.log('Exportando esquema public...')
  const parts = [
    header,
    await sectionEnums(),
    await sectionTables(),
    await sectionConstraints(),
    await sectionIndexes(),
    await sectionFunctions(),
    await sectionTriggers(),
    await sectionViews(),
    await sectionRls(),
    await sectionComments(),
  ]
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(OUT_FILE, parts.join('\n\n'), 'utf8')
  console.log(`Escrito: ${OUT_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
