#!/usr/bin/env node
/**
 * Recorre las unidades del piloto en el mismo orden que la tabla (una fila = un correo representativo:
 * el primero de cada línea en pilot-votacion-load.mjs).
 *
 * Pasada 1: simula consentimientos en secuencia con sesión vacía → comprueba umbral 5 + cobro 1/unidad después.
 * Pasada 2: mismos correos otra vez → todos los cobros deben ser 0 (unidades ya en sesión).
 *
 * Orden: **primer correo** de cada fila (misma tabla que el piloto). Si en BD la unidad está solo con el
 * segundo correo de la celda, verás ok:false: prueba ese correo a mano o alinea importación con la hoja.
 *
 * Uso: npm run simular:lopd-secuencia
 * Requiere: .env.local con NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFromRoot(fileName) {
  const p = join(process.cwd(), fileName)
  if (!existsSync(p)) return
  const text = readFileSync(p, 'utf8')
  for (const line of text.split('\n')) {
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

/** Mismo bloque que scripts/pilot-votacion-load.mjs (orden = unidades 101, 102, 201…) */
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

const DEFAULT_ASAMBLEA_ID_PILOTO = '967b8219-a731-4a27-b16c-289044a19cc5'

/** Una dirección por fila (primer correo de la celda), orden tabla. */
function emailsOrdenTabla(raw) {
  const out = []
  for (const line of raw.trim().split(/\n/)) {
    const s = line.trim()
    if (!s) continue
    const first = s.split(/[;,]/)[0].trim().toLowerCase()
    if (first) out.push(first)
  }
  return out
}

function calcularCobroSimulado(isDemo, nExistentes, unidadIds, unidadesYaEnSesion) {
  let ord = nExistentes
  let chargeTotal = 0
  const detalle = []
  for (const u of unidadIds) {
    if (unidadesYaEnSesion.has(u)) {
      detalle.push({ unidad_id: u, cobro: 0, motivo: 'ya cobrado en esta sesión' })
      continue
    }
    ord += 1
    const tokensUnit = isDemo ? 0 : ord <= 5 ? 0 : 1
    chargeTotal += tokensUnit
    detalle.push({
      unidad_id: u,
      ordinal_global_en_sesion: ord,
      cobro: tokensUnit,
      motivo: isDemo ? 'demo' : ord <= 5 ? 'dentro del umbral (5)' : 'fuera del umbral',
    })
  }
  return { chargeTotal, detalle }
}

loadEnvFromRoot('.env.local')
loadEnvFromRoot('.env.pilot.local')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function obtenerCodigo() {
  let codigo = process.env.CODIGO?.trim()
  if (codigo) return codigo.toUpperCase()
  const { data: row, error } = await supabase
    .from('asambleas')
    .select('codigo_acceso')
    .eq('id', process.env.ASAMBLEA_ID?.trim() || DEFAULT_ASAMBLEA_ID_PILOTO)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const c = row?.codigo_acceso?.trim()
  if (!c) throw new Error('No hay codigo_acceso')
  return c.toUpperCase()
}

async function main() {
  const codigoNorm = await obtenerCodigo()
  const { data: asm, error: eAsm } = await supabase
    .from('asambleas')
    .select('id, is_demo')
    .eq('codigo_acceso', codigoNorm)
    .maybeSingle()
  if (eAsm || !asm) throw new Error('Asamblea no encontrada')
  const isDemo = !!asm.is_demo

  const orden = emailsOrdenTabla(PILOT_EMAIL_RAW)
  console.error(`[secuencia] ${orden.length} filas (primer correo por unidad), is_demo=${isDemo}, codigo=${codigoNorm}\n`)

  // Pasada 1
  const unidadesSesion = new Set()
  const filasP1 = []
  let totalTokensP1 = 0

  for (let i = 0; i < orden.length; i++) {
    const email = orden[i]
    const nAntes = unidadesSesion.size
    const { data: valRows, error: eVal } = await supabase.rpc('validar_votante_asamblea', {
      p_codigo_asamblea: codigoNorm,
      p_email_votante: email,
    })
    if (eVal) throw new Error(`validar ${email}: ${eVal.message}`)
    const val = Array.isArray(valRows) ? valRows[0] : valRows
    if (!val || val.puede_votar !== true) {
      filasP1.push({
        paso: i + 1,
        email,
        ok: false,
        mensaje: val?.mensaje ?? 'no puede votar',
        cobro: 0,
        acumulado_tokens: totalTokensP1,
        unidades_en_sesion: unidadesSesion.size,
      })
      continue
    }
    const propias = Array.isArray(val.unidades_propias) ? val.unidades_propias : []
    const poderes = Array.isArray(val.unidades_poderes) ? val.unidades_poderes : []
    const unidadIds = [...new Set([...propias, ...poderes].filter(Boolean))].sort()
    const sim = calcularCobroSimulado(isDemo, nAntes, unidadIds, unidadesSesion)
    totalTokensP1 += sim.chargeTotal
    for (const u of unidadIds) unidadesSesion.add(u)
    filasP1.push({
      paso: i + 1,
      email,
      ok: true,
      unidades: unidadIds.length,
      cobro_paso: sim.chargeTotal,
      detalle: sim.detalle,
      acumulado_tokens: totalTokensP1,
      unidades_distintas_en_sesion: unidadesSesion.size,
    })
  }

  // Pasada 2: mismo orden, mismo Set (no reset)
  const filasP2 = []
  let totalTokensP2 = 0
  for (let i = 0; i < orden.length; i++) {
    const email = orden[i]
    const nAntes = unidadesSesion.size
    const { data: valRows, error: eVal } = await supabase.rpc('validar_votante_asamblea', {
      p_codigo_asamblea: codigoNorm,
      p_email_votante: email,
    })
    if (eVal) throw new Error(`validar P2 ${email}: ${eVal.message}`)
    const val = Array.isArray(valRows) ? valRows[0] : valRows
    if (!val || val.puede_votar !== true) {
      filasP2.push({ paso: i + 1, email, ok: false, cobro_paso: 0 })
      continue
    }
    const propias = Array.isArray(val.unidades_propias) ? val.unidades_propias : []
    const poderes = Array.isArray(val.unidades_poderes) ? val.unidades_poderes : []
    const unidadIds = [...new Set([...propias, ...poderes].filter(Boolean))].sort()
    const sim = calcularCobroSimulado(isDemo, nAntes, unidadIds, unidadesSesion)
    totalTokensP2 += sim.chargeTotal
    filasP2.push({
      paso: i + 1,
      email,
      ok: true,
      cobro_paso: sim.chargeTotal,
      todos_motivos_reuso: sim.detalle.every((d) => d.motivo === 'ya cobrado en esta sesión' || d.cobro === 0),
    })
  }

  const fallosP1 = filasP1.filter((f) => f.ok === false).length
  const resumen = {
    codigo: codigoNorm,
    is_demo: isDemo,
    filas_tabla: orden.length,
    pasada1_emails_sin_validar: fallosP1,
    pasada1_total_tokens: totalTokensP1,
    pasada2_total_tokens: totalTokensP2,
    pasada2_debe_ser_cero: totalTokensP2 === 0,
    unidades_distintas_finales: unidadesSesion.size,
    nota:
      isDemo
        ? 'is_demo=true: cobro siempre 0 (regla de negocio demo).'
        : 'En producción real, pasada 1 debería mostrar cobro 0 en pasos 1–5 (unidades nuevas) y 1 a partir de la 6.ª unidad distinta global.',
  }

  console.log(JSON.stringify({ resumen, pasada1: filasP1, pasada2: filasP2 }, null, 2))

  if (!isDemo && totalTokensP2 !== 0) {
    console.error('\n[ERROR] Pasada 2 debería acumular 0 tokens (reintento misma sesión simulada).')
    process.exit(1)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
