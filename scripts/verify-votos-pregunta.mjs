#!/usr/bin/env node
/**
 * Resumen de votos en BD para una pregunta (service role vía .env.local).
 * Uso: node scripts/verify-votos-pregunta.mjs
 * Opcional: PREGUNTA_ID=uuid
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFromRoot(fileName) {
  const p = join(process.cwd(), fileName)
  if (!existsSync(p)) return
  const text = readFileSync(p, 'utf8')
  for (const line of text.split(/\n/)) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const eq = s.indexOf('=')
    if (eq <= 0) continue
    const key = s.slice(0, eq).trim()
    let val = s.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvFromRoot('.env.local')
loadEnvFromRoot('.env.pilot.local')

const PREGUNTA_ID =
  process.env.PREGUNTA_ID?.trim() || 'f4c607cc-a33d-4235-9464-ab432d227046'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const { count, error: cErr } = await supabase
  .from('votos')
  .select('*', { count: 'exact', head: true })
  .eq('pregunta_id', PREGUNTA_ID)

if (cErr) {
  console.error('Error contando votos:', cErr.message)
  process.exit(1)
}

const { data: rows, error: rErr } = await supabase
  .from('votos')
  .select('id, unidad_id, opcion_id, votante_email, created_at')
  .eq('pregunta_id', PREGUNTA_ID)
  .order('created_at', { ascending: true })

if (rErr) {
  console.error('Error leyendo votos:', rErr.message)
  process.exit(1)
}

const byOpcion = new Map()
for (const r of rows ?? []) {
  const o = r.opcion_id ?? 'null'
  byOpcion.set(o, (byOpcion.get(o) || 0) + 1)
}

const { data: opciones } = await supabase
  .from('opciones_pregunta')
  .select('id, texto_opcion, orden')
  .eq('pregunta_id', PREGUNTA_ID)
  .order('orden')

console.log('=== Votos en BD ===')
console.log('pregunta_id:', PREGUNTA_ID)
console.log('Total filas en `votos`:', count ?? rows?.length ?? 0)
console.log('Unidades distintas (aprox.):', new Set((rows ?? []).map((r) => r.unidad_id)).size)
console.log('\nPor opción:')
for (const op of opciones ?? []) {
  const n = byOpcion.get(op.id) ?? 0
  console.log(`  ${n}  — ${op.texto_opcion} (${op.id})`)
}
const otros = [...byOpcion.entries()].filter(([id]) => !(opciones ?? []).some((o) => o.id === id))
if (otros.length) console.log('  (otros opcion_id):', Object.fromEntries(otros))

console.log('\nÚltimas 5 filas (más recientes):')
;[...(rows ?? [])]
  .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  .slice(0, 5)
  .forEach((r) => {
    console.log(
      `  ${r.created_at?.slice?.(0, 19) ?? r.created_at} | ${r.votante_email} | unidad ${r.unidad_id?.slice(0, 8)}…`,
    )
  })
