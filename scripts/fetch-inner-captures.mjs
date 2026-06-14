#!/usr/bin/env node
/**
 * Descarga snapshot/bootstrap/captures/*.inner.json desde Supabase Management API.
 * Requiere: SUPABASE_ACCESS_TOKEN
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_REF = 'zbfwuabsgnrpizckeump'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN?.trim()
if (!TOKEN) {
  console.error('Falta SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CAP = path.join(__dirname, '..', 'supabase', 'schema', '.export-chunks', 'snapshot', 'bootstrap', 'captures')

async function runQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json.result ?? json
}

function rows(result) {
  if (Array.isArray(result)) return result
  if (result?.rows) return result.rows
  return []
}

function cell(row, key) {
  return row[key] ?? row[key.toUpperCase()]
}

const QUERIES = {
  tables: `SELECT string_agg(sub.ddl, E'\\n\\n' ORDER BY sub.table_name) AS ddl FROM (SELECT c.relname AS table_name, 'CREATE TABLE IF NOT EXISTS public.' || quote_ident(c.relname) || E' (\\n' || string_agg('    ' || quote_ident(a.attname) || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END || CASE WHEN ad.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END, E',\\n' ORDER BY a.attnum) || E'\\n);' AS ddl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped GROUP BY c.relname) sub;`,
  constraints: `SELECT string_agg(format(E'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I;\nALTER TABLE public.%I ADD CONSTRAINT %I %s;', replace(conrelid::regclass::text, 'public.', ''), conname, replace(conrelid::regclass::text, 'public.', ''), conname, pg_get_constraintdef(c.oid, true)), E'\\n' ORDER BY conrelid::regclass::text, conname) AS ddl FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype IN ('p','f','u','c');`,
  indexes: `SELECT string_agg(regexp_replace(indexdef, '^CREATE (UNIQUE )?INDEX', 'CREATE \\1INDEX IF NOT EXISTS') || ';', E'\\n' ORDER BY tablename, indexname) AS ddl FROM pg_indexes WHERE schemaname = 'public';`,
  views: `SELECT string_agg('CREATE OR REPLACE VIEW public.' || quote_ident(viewname) || ' AS ' || definition || ';', E'\\n\\n' ORDER BY viewname) AS ddl FROM pg_views WHERE schemaname = 'public';`,
  policies: `SELECT string_agg(format(E'DROP POLICY IF EXISTS %I ON public.%I;\nCREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;', policyname, tablename, policyname, schemaname, tablename, CASE WHEN permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END, cmd, array_to_string(roles, ', '), CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END, CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END), E'\\n\\n' ORDER BY tablename, policyname) AS ddl FROM pg_policies WHERE schemaname = 'public';`,
  comments: `SELECT string_agg('COMMENT ON TABLE public.' || quote_ident(c.relname) || ' IS ' || quote_literal(obj_description(c.oid, 'pg_class')), E'\\n' ORDER BY c.relname) AS ddl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND obj_description(c.oid, 'pg_class') IS NOT NULL;`,
}

async function main() {
  await mkdir(CAP, { recursive: true })
  for (const [section, query] of Object.entries(QUERIES)) {
    const result = await runQuery(query)
    const ddl = cell(rows(result)[0], 'ddl')
    if (!ddl) {
      console.warn(`skip ${section}: sin ddl`)
      continue
    }
    const inner = [{ ddl }]
    await writeFile(path.join(CAP, `${section}.inner.json`), `${JSON.stringify(inner)}\n`, 'utf8')
    console.log(`captures/${section}.inner.json (${ddl.length} chars)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
