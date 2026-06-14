#!/usr/bin/env node
/**
 * Ensambla supabase/schema/restore/public-schema.sql desde chunks .sql en .export/
 * Generados por export-schema-backup.mjs o manualmente vía MCP.
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const exportDir = path.join(__dirname, '..', 'supabase', 'schema', '.export')
const outFile = path.join(__dirname, '..', 'supabase', 'schema', 'restore', 'public-schema.sql')

const ORDER = [
  '00_header.sql',
  '01_enums.sql',
  '02_tables_a.sql',
  '02_tables_b.sql',
  '03_constraints.sql',
  '04_indexes.sql',
  '05_functions_a.sql',
  '05_functions_b.sql',
  '06_triggers.sql',
  '07_views.sql',
  '08_rls_enable.sql',
  '09_policies.sql',
  '10_comments.sql',
]

async function main() {
  const parts = []
  for (const name of ORDER) {
    const file = path.join(exportDir, name)
    try {
      parts.push(await readFile(file, 'utf8'))
    } catch {
      console.warn(`Omitido (no existe): ${name}`)
    }
  }
  await mkdir(path.dirname(outFile), { recursive: true })
  await writeFile(outFile, parts.filter(Boolean).join('\n\n'), 'utf8')
  console.log(`Escrito: ${outFile}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
