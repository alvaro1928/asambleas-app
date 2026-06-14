#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMcpDdl } from './lib/mcp-parse.mjs'

const [, , src, dest] = process.argv
if (!src || !dest) {
  console.error('Uso: node scripts/decode-mcp-to-plain.mjs <mcp.txt> <plain.sql>')
  process.exit(1)
}
const ddl = parseMcpDdl(await readFile(src, 'utf8'))
await mkdir(path.dirname(dest), { recursive: true })
await writeFile(dest, ddl, 'utf8')
console.log(`Escrito ${dest} (${ddl.length} bytes)`)
