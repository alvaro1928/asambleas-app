#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CAP = path.join(__dirname, '..', 'supabase', 'schema', '.export-chunks', 'snapshot', 'bootstrap', 'captures')

const sections = ['tables', 'constraints', 'indexes', 'views', 'policies', 'comments']

async function main() {
  await mkdir(CAP, { recursive: true })
  for (const section of sections) {
    try {
      const mod = await import(`./ddl/${section}.mjs`)
      const ddl = mod.default
      if (!ddl?.trim()) throw new Error('vacío')
      await writeFile(path.join(CAP, `${section}.inner.json`), `${JSON.stringify([{ ddl }])}\n`, 'utf8')
      console.log(`captures/${section}.inner.json (${ddl.length} chars)`)
    } catch (err) {
      console.warn(`skip ${section}:`, err.message)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
