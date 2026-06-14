#!/usr/bin/env node
/**
 * Escribe ddl-source/*.sql y plain/*.sql desde Management API o captures existentes.
 * Requiere SUPABASE_ACCESS_TOKEN para secciones faltantes.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixDoubleSemicolons, normalizeSql } from './lib/mcp-parse.mjs'

const PROJECT_REF = 'zbfwuabsgnrpizckeump'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DDL_SRC = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'bootstrap', 'ddl-source')
const PLAIN = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'plain')
const CAP = path.join(ROOT, 'supabase', 'schema', '.export-chunks', 'snapshot', 'bootstrap', 'captures')

const QUERIES = {
  tables: `SELECT string_agg(sub.ddl, E'\\n\\n' ORDER BY sub.table_name) AS ddl FROM (SELECT c.relname AS table_name, 'CREATE TABLE IF NOT EXISTS public.' || quote_ident(c.relname) || E' (\\n' || string_agg('    ' || quote_ident(a.attname) || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END || CASE WHEN ad.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END, E',\\n' ORDER BY a.attnum) || E'\\n);' AS ddl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped GROUP BY c.relname) sub;`,
  constraints: `SELECT string_agg(format(E'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I;\nALTER TABLE public.%I ADD CONSTRAINT %I %s;', replace(conrelid::regclass::text, 'public.', ''), conname, replace(conrelid::regclass::text, 'public.', ''), conname, pg_get_constraintdef(c.oid, true)), E'\\n' ORDER BY conrelid::regclass::text, conname) AS ddl FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype IN ('p','f','u','c');`,
  indexes: `SELECT string_agg(regexp_replace(indexdef, '^CREATE (UNIQUE )?INDEX', 'CREATE \\1INDEX IF NOT EXISTS') || ';', E'\\n' ORDER BY tablename, indexname) AS ddl FROM pg_indexes WHERE schemaname = 'public';`,
  views: `SELECT string_agg('CREATE OR REPLACE VIEW public.' || quote_ident(viewname) || ' AS ' || definition || ';', E'\\n\\n' ORDER BY viewname) AS ddl FROM pg_views WHERE schemaname = 'public';`,
  policies: `SELECT string_agg(format(E'DROP POLICY IF EXISTS %I ON public.%I;\nCREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;', policyname, tablename, policyname, schemaname, tablename, CASE WHEN permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END, cmd, array_to_string(roles, ', '), CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END, CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END), E'\\n\\n' ORDER BY tablename, policyname) AS ddl FROM pg_policies WHERE schemaname = 'public';`,
  comments: `SELECT string_agg('COMMENT ON TABLE public.' || quote_ident(c.relname) || ' IS ' || quote_literal(obj_description(c.oid, 'pg_class')), E'\\n' ORDER BY c.relname) AS ddl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND obj_description(c.oid, 'pg_class') IS NOT NULL;`,
}

const FIX = { views: fixDoubleSemicolons }

async function runQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  const json = await res.json()
  const rows = Array.isArray(json.result) ? json.result : json.result?.rows ?? []
  return rows[0]?.ddl ?? rows[0]?.DDL
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  await mkdir(DDL_SRC, { recursive: true })
  await mkdir(PLAIN, { recursive: true })
  await mkdir(CAP, { recursive: true })

  for (const [section, query] of Object.entries(QUERIES)) {
    const srcPath = path.join(DDL_SRC, `${section}.sql`)
    let ddl
    if (await exists(srcPath)) {
      ddl = await readFile(srcPath, 'utf8')
      console.log(`${section}: ddl-source existente`)
    } else if (TOKEN) {
      ddl = await runQuery(query)
      if (!ddl) {
        console.warn(`${section}: sin ddl desde API`)
        continue
      }
      await writeFile(srcPath, `${ddl.trim()}\n`, 'utf8')
      console.log(`${section}: descargado (${ddl.length} chars)`)
    } else {
      const plainPath = path.join(PLAIN, `${section}.sql`)
      if (await exists(plainPath)) {
        ddl = await readFile(plainPath, 'utf8')
        await writeFile(srcPath, `${ddl.trim()}\n`, 'utf8')
        console.log(`${section}: copiado desde plain → ddl-source`)
      } else {
        console.warn(`${section}: falta ddl-source/${section}.sql y no hay token`)
        continue
      }
    }
    ddl = normalizeSql(ddl)
    if (FIX[section]) ddl = FIX[section](ddl)
    await writeFile(path.join(CAP, `${section}.inner.json`), `${JSON.stringify([{ ddl: ddl.trim() }])}\n`, 'utf8')
    await writeFile(path.join(PLAIN, `${section}.sql`), `${ddl.trim()}\n`, 'utf8')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
