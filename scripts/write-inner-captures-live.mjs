#!/usr/bin/env node
/**
 * Escribe captures/*.inner.json desde respuestas MCP en vivo (hardcoded base64 gzip).
 * Generado una vez desde exportación MCP — no editar manualmente el DDL.
 */
import { gunzipSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CAP = path.join(__dirname, '..', 'supabase', 'schema', '.export-chunks', 'snapshot', 'bootstrap', 'captures')

// inner JSON [{"ddl":"..."}] comprimido — se rellena en runtime vía fetch-inner-captures o MCP
const PLACEHOLDER = true

async function main() {
  if (PLACEHOLDER) {
    console.error('Ejecuta primero: node scripts/fetch-inner-captures.mjs (requiere SUPABASE_ACCESS_TOKEN)')
    console.error('Luego: node scripts/write-plain-from-inner-json.mjs')
    process.exit(1)
  }
}

main()
