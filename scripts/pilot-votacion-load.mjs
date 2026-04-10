#!/usr/bin/env node
/**
 * Carga piloto: empareja correos del piloto con unidades en BD y dispara POST /api/votar
 * usando el bypass de estrés (header x-stress-test-secret = STRESS_TEST_SECRET en Vercel).
 *
 * Requisitos en el entorno (PowerShell ej.):
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://....supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..."
 *   $env:BASE_URL="https://tu-app.vercel.app"
 *   $env:STRESS_TEST_SECRET="(mismo valor que en Vercel)"
 *
 * Opcional:
 *   $env:PREGUNTA_ID / $env:OPCION_ID — si ya los tienes, evita la consulta a preguntas/opciones
 *   $env:DRY_RUN="1" — solo imprime ids y emparejamientos, no envía votos
 *   $env:CONCURRENCY="15" — peticiones en paralelo (default 15)
 *   $env:REPORT_ONLY="1" — solo informe por correo (sin POST); sale 0 aunque falten unidades
 *
 * IDs en Supabase: scripts/sql/pilot-ids-asamblea.sql (incluye snapshot opciones piloto).
 * Ejemplo con ids ya conocidos (voto "A favor"):
 *   $env:PREGUNTA_ID="f4c607cc-a33d-4235-9464-ab432d227046"
 *   $env:OPCION_ID="1572d107-ff19-4a2f-afed-0dcd944fed41"
 *
 * Si ejecutas desde la raíz del repo (`npm run test:pilot-load`), el script intenta cargar
 * `.env.local` y `.env.pilot.local` (sin depender de `node --env-file`). Añade ahí
 * SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API → service_role); no la subas a git.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

/** Carga KEY=VAL desde la raíz del proyecto (no sobrescribe variables ya definidas). */
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

const ASAMBLEA_ID = '967b8219-a731-4a27-b16c-289044a19cc5'

/** Filas del listado piloto (separadores ; o ,). Se normalizan a minúsculas. */
const PILOT_EMAIL_RAW = `
administraciones@arinmobiliaria.com.co; florballendediaz@gmail.com
alida1410@hotmail.com
florcorredor14@hotmail.com
wdlarosa@gmail.com
jimenez.soler.aero@gmail.com
lynata84@icloud.com
mariaclaudiavalbuena@gmail.com; nurymahecha6@gmail.com
stellitacaceres@gmail.com
zullyvasan@yahoo.com
mcarvajal2010@hotmail.com
maivonneg@hotmail.com
juancmm99@hotmail.com
alixherali@hotmail.com
anaclelia41@gmail.com, juanleal08@gmail.com
arcoscristian80@gmail.com
clara.madero@gmail.com
gonzorub21@yahoo.com
maurobernal.cmbr@gmail.com, fabiolarc26@hotmail.com
cdlm090602@gmail.com, natalialrm@hotmail.com
laura.ximi@gmail.com
suarezamayanataly@gmail.com, a_shell@hotmail.com
martecupe@hotmail.com
diezj26@gmail.com
rsabogal267@gmail.com
germansegurag@yahoo.com, beatriz.tabordo@hotmail.com
edilmacu@hotmail.com
hecamarce@hotmail.com
yulymleon@gmail.com
mateo.0592@hotmail.com, lina-velandiat@hotmail.com
angelaclemenciar@gmail.com
marthaserrato@yahoo.com
diana.pachecof@gmail.com
`

/** Correos únicos en orden de primera aparición en el listado. */
function parseEmailsOrdered(raw) {
  const seen = new Set()
  const ordered = []
  for (const line of raw.trim().split(/\n/)) {
    for (const part of line.split(/[;,]/)) {
      const e = part.trim().toLowerCase()
      if (e && !seen.has(e)) {
        seen.add(e)
        ordered.push(e)
      }
    }
  }
  return ordered
}

function parseEmails(raw) {
  return parseEmailsOrdered(raw)
}

function localPart(email) {
  const i = email.indexOf('@')
  return i > 0 ? email.slice(0, i) : email
}

/** Pistas cuando el correo del piloto no coincide con ningún correo de unidades. */
function suggestNearMatches(pilotEmail, unidades) {
  const n = pilotEmail.trim().toLowerCase()
  const lp = localPart(n)
  const suggestions = []
  for (const u of unidades) {
    for (const em of emailsExpandidosDesdeUnidad(u)) {
      if (!em) continue
      if (em === n) continue
      const lp2 = localPart(em)
      if (lp && lp2 && lp === lp2) {
        suggestions.push({
          razon: 'mismo usuario local (@…), distinto dominio o cuenta',
          email_bd: em,
          u,
        })
      }
    }
  }
  return suggestions.slice(0, 5)
}

function shouldUseDemoUnits(isDemo, sandboxUsarUnidadesReales) {
  return isDemo === true && sandboxUsarUnidadesReales !== true
}

function unidadEmailNorm(u) {
  return String(u.email_propietario ?? u.email ?? '')
    .trim()
    .toLowerCase()
}

/** Todos los correos declarados en la unidad (varios a veces van en un solo campo con ; o ,). */
function emailsExpandidosDesdeUnidad(u) {
  const raw = `${String(u.email_propietario ?? '').trim()} ${String(u.email ?? '').trim()}`
  const out = []
  const seen = new Set()
  for (const chunk of raw.split(/[;,]/)) {
    const e = chunk.trim().toLowerCase()
    if (e && !seen.has(e)) {
      seen.add(e)
      out.push(e)
    }
  }
  return out
}

function percentile(arr, p) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function fetchPairs(supabase, asamblea) {
  const orgId = asamblea.organization_id
  const demo = shouldUseDemoUnits(asamblea.is_demo, asamblea.sandbox_usar_unidades_reales)

  let q = supabase
    .from('unidades')
    .select('id, email_propietario, email, is_demo, torre, numero')
    .eq('organization_id', orgId)
  q = demo ? q.eq('is_demo', true) : q.or('is_demo.eq.false,is_demo.is.null')

  const { data: unidades, error } = await q
  if (error) throw new Error(`unidades: ${error.message}`)

  const list = unidades ?? []
  const byEmail = new Map()
  for (const u of list) {
    for (const em of emailsExpandidosDesdeUnidad(u)) {
      if (!byEmail.has(em)) byEmail.set(em, u)
    }
  }

  const emails = parseEmailsOrdered(PILOT_EMAIL_RAW)
  const pairs = []
  const missing = []
  /** @type {{ idx: number, email: string, ok: boolean, torre?: string | null, numero?: string | null, unidad_id?: string, sugerencias?: { razon: string, email_bd: string }[] }[]} */
  const detallePorCorreo = []

  emails.forEach((email, idx) => {
    const u = byEmail.get(email)
    if (u) {
      pairs.push({ email, unidad_id: u.id, torre: u.torre, numero: u.numero })
      detallePorCorreo.push({
        idx: idx + 1,
        email,
        ok: true,
        torre: u.torre,
        numero: u.numero,
        unidad_id: u.id,
      })
    } else {
      missing.push(email)
      const sug = suggestNearMatches(email, list).map((s) => ({
        razon: s.razon,
        email_bd: s.email_bd,
      }))
      detallePorCorreo.push({
        idx: idx + 1,
        email,
        ok: false,
        sugerencias: sug.length ? sug : undefined,
      })
    }
  })

  return {
    pairs,
    missing,
    totalEmails: emails.length,
    unidadesCargadas: list.length,
    detallePorCorreo,
  }
}

function printDetalleCorreos(detallePorCorreo) {
  console.log('\n--- Detalle por correo (todos, orden del listado) ---')
  console.log(
    '(✓ = email coincide con una unidad de la copropiedad; ✗ = no hay unidad con ese email exacto)\n',
  )
  for (const row of detallePorCorreo) {
    const tag = row.ok ? '✓' : '✗'
    const torreNum =
      row.ok && (row.torre != null || row.numero != null)
        ? ` torre=${row.torre ?? '—'} número=${row.numero ?? '—'} unidad_id=${row.unidad_id}`
        : ''
    console.log(`${String(row.idx).padStart(2, '0')}. ${tag} ${row.email}${torreNum}`)
    if (!row.ok && row.sugerencias?.length) {
      for (const s of row.sugerencias) {
        console.log(`       → pista: ${s.razon} | en BD: ${s.email_bd}`)
      }
    }
  }
}

async function resolvePreguntaOpcion(supabase, preguntaIdEnv, opcionIdEnv) {
  if (preguntaIdEnv && opcionIdEnv) {
    return { pregunta_id: preguntaIdEnv, opcion_id: opcionIdEnv }
  }

  const { data: preguntas, error: e1 } = await supabase
    .from('preguntas')
    .select('id, orden, estado, texto_pregunta, is_archived')
    .eq('asamblea_id', ASAMBLEA_ID)
    .order('orden', { ascending: true })

  if (e1) throw new Error(`preguntas: ${e1.message}`)
  const list = (preguntas ?? []).filter((p) => !p.is_archived)
  const abierta = list.find((p) => p.estado === 'abierta')
  const pregunta = abierta ?? list[0]
  if (!pregunta) throw new Error('No hay preguntas para esta asamblea.')

  const { data: opciones, error: e2 } = await supabase
    .from('opciones_pregunta')
    .select('id, orden, texto_opcion')
    .eq('pregunta_id', pregunta.id)
    .order('orden', { ascending: true })

  if (e2) throw new Error(`opciones_pregunta: ${e2.message}`)
  const opcion = (opciones ?? [])[0]
  if (!opcion) throw new Error('La pregunta no tiene opciones.')

  return {
    pregunta_id: pregunta.id,
    opcion_id: opcion.id,
    pregunta_meta: pregunta,
    opcion_meta: opcion,
  }
}

async function sendVoto(baseUrl, secret, body) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/votar`
  const headers = { 'Content-Type': 'application/json' }
  if (secret) headers['X-Stress-Test-Secret'] = secret

  const start = performance.now()
  let ok = false
  let status = 0
  let errMsg = ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    status = res.status
    const data = await res.json().catch(() => ({}))
    ok = res.ok && data.success === true
    if (!res.ok) errMsg = data.error || res.statusText
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e)
  }
  const latencyMs = Math.round(performance.now() - start)
  return { ok, status, latencyMs, errMsg }
}

async function runInChunks(items, concurrency, fn) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const part = await Promise.all(chunk.map(fn))
    results.push(...part)
  }
  return results
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  const stressSecret = process.env.STRESS_TEST_SECRET
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'
  const reportOnly = process.env.REPORT_ONLY === '1' || process.env.REPORT_ONLY === 'true'
  const concurrency = Math.max(1, parseInt(process.env.CONCURRENCY || '15', 10))
  const preguntaIdEnv = process.env.PREGUNTA_ID?.trim()
  const opcionIdEnv = process.env.OPCION_ID?.trim()

  console.log('=== Piloto: carga votación (stress bypass) ===')
  console.log('ASAMBLEA_ID:', ASAMBLEA_ID)
  console.log('BASE_URL:', baseUrl)
  console.log('DRY_RUN:', dryRun)
  console.log('REPORT_ONLY:', reportOnly)

  if (!supabaseUrl || !serviceKey) {
    if (!supabaseUrl) console.error('Falta NEXT_PUBLIC_SUPABASE_URL (en .env.local o en el entorno).')
    if (!serviceKey) {
      console.error(
        'Falta SUPABASE_SERVICE_ROLE_KEY — en Supabase: Project Settings → API → service_role (secret).',
      )
      console.error('Añádela a .env.local en la raíz del repo (una línea: SUPABASE_SERVICE_ROLE_KEY=...).')
    }
    process.exit(1)
  }
  if (!dryRun && !stressSecret) {
    console.error('Para enviar votos hace falta STRESS_TEST_SECRET (igual que en Vercel).')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: asamblea, error: aErr } = await supabase
    .from('asambleas')
    .select('id, nombre, organization_id, is_demo, sandbox_usar_unidades_reales')
    .eq('id', ASAMBLEA_ID)
    .single()

  if (aErr || !asamblea) {
    console.error('No se encontró la asamblea:', aErr?.message ?? 'sin fila')
    process.exit(1)
  }
  console.log('Asamblea:', asamblea.nombre ?? asamblea.id)

  const resolved = await resolvePreguntaOpcion(supabase, preguntaIdEnv, opcionIdEnv)
  console.log('\n--- Pregunta / opción ---')
  console.log('pregunta_id:', resolved.pregunta_id)
  console.log('opcion_id:', resolved.opcion_id)
  if (resolved.pregunta_meta) {
    console.log('texto_pregunta:', resolved.pregunta_meta.texto_pregunta)
    console.log('estado:', resolved.pregunta_meta.estado)
  }
  if (resolved.opcion_meta) console.log('opción (texto):', resolved.opcion_meta.texto_opcion)

  const { pairs, missing, totalEmails, unidadesCargadas, detallePorCorreo } = await fetchPairs(
    supabase,
    asamblea,
  )
  console.log('\n--- Emparejamiento correo → unidad ---')
  console.log('Unidades en copropiedad (filtro demo/real):', unidadesCargadas)
  console.log('Correos únicos en listado:', totalEmails)
  console.log('Emparejados:', pairs.length)
  if (missing.length) {
    console.log('Sin unidad en BD (email exacto):', missing.length)
  }

  printDetalleCorreos(detallePorCorreo)

  if (reportOnly) {
    console.log('\nREPORT_ONLY: no se enviaron peticiones.')
    process.exit(0)
  }

  if (dryRun) {
    console.log('\nDRY_RUN: no se enviaron peticiones.')
    process.exit(missing.length > 0 ? 2 : 0)
  }

  if (pairs.length === 0) {
    console.error('No hay pares para enviar.')
    process.exit(1)
  }

  /** Un voto por unidad (evita violar UNIQUE(pregunta_id, unidad_id) si hay varios correos por unidad). */
  const porUnidad = new Map()
  for (const p of pairs) {
    if (!porUnidad.has(p.unidad_id)) porUnidad.set(p.unidad_id, p)
  }
  const paresEnvio = [...porUnidad.values()]
  if (paresEnvio.length < pairs.length) {
    console.log(
      `\n(Nota: ${pairs.length} correos emparejados → ${paresEnvio.length} unidades únicas; un voto por unidad.)\n`,
    )
  }

  const payloads = paresEnvio.map((p, i) => ({
    pregunta_id: resolved.pregunta_id,
    opcion_id: resolved.opcion_id,
    unidad_id: p.unidad_id,
    votante_email: p.email,
    votante_nombre: `Piloto ${i + 1}`,
  }))

  console.log(`\nEnviando ${payloads.length} votos (concurrencia ${concurrency})...\n`)

  const results = await runInChunks(payloads, concurrency, (body) =>
    sendVoto(baseUrl, stressSecret, body)
  )

  const okCount = results.filter((r) => r.ok).length
  const latenciesOk = results.filter((r) => r.ok).map((r) => r.latencyMs)

  console.log('--- Resultados ---')
  console.log('Éxitos:', okCount, '/', results.length)
  console.log('Fallos:', results.length - okCount)
  if (latenciesOk.length) {
    console.log('Latencia p50 (ms):', percentile(latenciesOk, 50))
    console.log('Latencia p95 (ms):', percentile(latenciesOk, 95))
  }
  const fails = results.filter((r) => !r.ok)
  if (fails.length) {
    const errMap = {}
    fails.forEach((r) => {
      const k = r.errMsg || `status ${r.status}`
      errMap[k] = (errMap[k] || 0) + 1
    })
    console.log('Errores:', errMap)
  }

  process.exit(okCount === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
