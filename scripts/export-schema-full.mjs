#!/usr/bin/env node
/**
 * Pipeline completo de backup de esquema:
 * 1. sync-ddl-source (ddl-source → plain/captures)
 * 2. bootstrap-write-all (functions desde agent-tools)
 * 3. compose-public-schema → public-schema.sql + MANIFEST.json
 *
 * Regeneración desde API (requiere token):
 *   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
 *   node scripts/export-schema-full.mjs --fetch
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, script), ...args], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))))
  })
}

async function main() {
  if (process.argv.includes('--fetch')) {
    await run('fetch-inner-captures.mjs')
    await run('write-plain-from-inner-json.mjs')
  }
  await run('sync-ddl-source.mjs')
  await run('bootstrap-write-all.mjs')
  await run('compose-public-schema.mjs')
  console.log('Backup listo: supabase/schema/restore/public-schema.sql')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
