#!/usr/bin/env node
/**
 * Simula el cobro LOPD de la sesión (misma lógica que registrar_consentimiento_y_consumo_sesion)
 * sin tocar BD por defecto (dry-run). Sirve para comprobar tokens requeridos vs saldo del gestor.
 *
 * Uso (PowerShell):
 *   npm run simular:lopd-tokens
 *   (con solo .env.local: usa asamblea piloto, codigo_acceso desde BD y primer correo de la lista piloto)
 *
 * O explícito:
 *   $env:CODIGO="ABC-XXXX"
 *   $env:IDENTIFICADOR="correo@ejemplo.com"
 *
 * Opcional:
 *   ASAMBLEA_ID=uuid — si no pasas CODIGO, se lee codigo_acceso de esta asamblea (default: piloto en scripts/pilot-votacion-load.mjs)
 *   DRY_RUN=0 APPLY=1  — ejecuta el RPC real (solo en staging / asamblea de prueba; inserta consentimiento y descuenta si aplica)
 *   DEMO_ONLY_APPLY=1 — con APPLY=1, solo ejecuta si is_demo=true (cobro 0; no bloquea por saldo)
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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

loadEnvFromRoot('.env.local')
loadEnvFromRoot('.env.pilot.local')

/** Misma asamblea que scripts/pilot-votacion-load.mjs y scripts/sql/pilot-ids-asamblea.sql */
const DEFAULT_ASAMBLEA_ID_PILOTO = '967b8219-a731-4a27-b16c-289044a19cc5'
/** Correo piloto que valida en el conjunto (el primero del listado no siempre está en censo) */
const DEFAULT_IDENTIFICADOR_PILOTO = 'alida1410@hotmail.com'

const dryRun = process.env.DRY_RUN !== '0' && process.env.DRY_RUN !== 'false'
const apply = process.env.APPLY === '1' || process.env.APPLY === 'true'
const demoOnlyApply = process.env.DEMO_ONLY_APPLY === '1' || process.env.DEMO_ONLY_APPLY === 'true'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

/**
 * @returns {{ codigo: string, identificador: string, notas: string[] }}
 */
async function resolverCodigoEIdentificador() {
  const notas = []
  let codigo = process.env.CODIGO?.trim()
  let identificador = process.env.IDENTIFICADOR?.trim()
  const asambleaId = process.env.ASAMBLEA_ID?.trim() || DEFAULT_ASAMBLEA_ID_PILOTO

  if (!codigo) {
    const { data: row, error } = await supabase
      .from('asambleas')
      .select('codigo_acceso')
      .eq('id', asambleaId)
      .maybeSingle()
    if (error) throw new Error(`asambleas (codigo por id): ${error.message}`)
    const c = row?.codigo_acceso?.trim()
    if (!c) {
      throw new Error(
        `No hay codigo_acceso para ASAMBLEA_ID=${asambleaId}. Pasa CODIGO manualmente o revisa la asamblea en BD.`
      )
    }
    codigo = c
    notas.push(`CODIGO leído de BD (ASAMBLEA_ID=${asambleaId})`)
  }

  if (!identificador) {
    identificador = DEFAULT_IDENTIFICADOR_PILOTO
    notas.push(`IDENTIFICADOR por defecto: primer correo piloto (${DEFAULT_IDENTIFICADOR_PILOTO})`)
  }

  return { codigo, identificador, notas }
}

/**
 * Réplica del bucle en SESION-Y-TOKENS-CONSENTIMIENTO.sql (primeras 5 unidades distintas en sesión = 0; luego 1).
 * @param {boolean} isDemo
 * @param {number} nExistentes - COUNT(DISTINCT unidad_id) ya en sesion_token_consumos para esta sesión
 * @param {string[]} unidadIds - unidades del votante (orden estable)
 * @param {Set<string>} unidadesYaEnSesion - ids ya presentes en consumos para esta sesión
 */
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

async function resolverSaldoGestor(organizationId) {
  const { data: org, error: eOrg } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', organizationId)
    .maybeSingle()
  if (eOrg) throw new Error(`organizations: ${eOrg.message}`)
  let gestorUserId = null
  const ownerId = org?.owner_id
  if (ownerId) {
    const { data: prof } = await supabase.from('profiles').select('user_id').eq('id', ownerId).maybeSingle()
    gestorUserId = prof?.user_id ?? null
  }
  if (!gestorUserId) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('organization_id', organizationId)
      .not('user_id', 'is', null)
      .order('created_at', { ascending: true, nullsFirst: false })
      .limit(1)
    gestorUserId = profs?.[0]?.user_id ?? null
  }
  if (!gestorUserId) {
    return { gestorUserId: null, saldo: 0 }
  }
  const { data: rows } = await supabase
    .from('profiles')
    .select('tokens_disponibles')
    .or(`user_id.eq.${gestorUserId},id.eq.${gestorUserId}`)
  const list = Array.isArray(rows) ? rows : []
  const saldo = list.length ? Math.max(...list.map((p) => Math.max(0, Number(p.tokens_disponibles ?? 0)))) : 0
  return { gestorUserId, saldo }
}

async function main() {
  const { codigo, identificador, notas } = await resolverCodigoEIdentificador()
  for (const n of notas) {
    console.error(`[simular-cobro-lopd] ${n}`)
  }

  const codigoNorm = codigo.toUpperCase()
  const { data: asm, error: eAsm } = await supabase
    .from('asambleas')
    .select('id, organization_id, is_demo, acceso_publico, session_mode, session_seq, codigo_acceso')
    .eq('codigo_acceso', codigoNorm)
    .maybeSingle()
  if (eAsm) throw new Error(`asambleas: ${eAsm.message}`)
  if (!asm) {
    console.error('No hay asamblea con ese código.')
    process.exit(1)
  }

  const isDemo = !!asm.is_demo
  const sessionSeq = Number(asm.session_seq ?? 1) || 1
  const orgId = asm.organization_id

  const { data: consumos, error: eCons } = await supabase
    .from('sesion_token_consumos')
    .select('unidad_id')
    .eq('asamblea_id', asm.id)
    .eq('session_seq', sessionSeq)
  if (eCons) throw new Error(`sesion_token_consumos: ${eCons.message}`)
  const unidadesYaEnSesion = new Set((consumos ?? []).map((r) => r.unidad_id).filter(Boolean))
  const nExistentes = unidadesYaEnSesion.size

  const { data: valRows, error: eVal } = await supabase.rpc('validar_votante_asamblea', {
    p_codigo_asamblea: codigoNorm,
    p_email_votante: identificador,
  })
  if (eVal) throw new Error(`validar_votante_asamblea: ${eVal.message}`)
  const val = Array.isArray(valRows) ? valRows[0] : valRows
  if (!val || val.puede_votar !== true) {
    console.log(JSON.stringify({ ok: false, mensaje: val?.mensaje ?? 'Votante no válido', val }, null, 2))
    process.exit(1)
  }

  const propias = Array.isArray(val.unidades_propias) ? val.unidades_propias : []
  const poderes = Array.isArray(val.unidades_poderes) ? val.unidades_poderes : []
  const unidadIds = [...new Set([...propias, ...poderes].filter(Boolean))].sort()

  const sim = calcularCobroSimulado(isDemo, nExistentes, unidadIds, unidadesYaEnSesion)
  const { saldo, gestorUserId } = await resolverSaldoGestor(orgId)

  const bloquearia = !isDemo && sim.chargeTotal > 0 && (!gestorUserId || saldo < sim.chargeTotal)

  const reporte = {
    resolucion: notas.length ? notas : ['CODIGO e IDENTIFICADOR pasados por env'],
    asamblea_id: asm.id,
    codigo: codigoNorm,
    is_demo: isDemo,
    session_seq: sessionSeq,
    session_mode: asm.session_mode,
    acceso_publico: asm.acceso_publico,
    unidades_distintas_ya_en_sesion: nExistentes,
    unidades_del_votante: unidadIds.length,
    tokens_que_cobraria_este_consentimiento: sim.chargeTotal,
    detalle_por_unidad: sim.detalle,
    gestor_user_id: gestorUserId,
    saldo_gestor_max_profiles: saldo,
    bloquearia_insufficient_tokens: bloquearia,
    dry_run: dryRun,
  }

  console.log(JSON.stringify(reporte, null, 2))

  if (dryRun) {
    console.error(
      '\n[DRY-RUN] No se ejecutó el RPC. Para ejecutar de verdad: DRY_RUN=0 APPLY=1 (y opcional DEMO_ONLY_APPLY=1).\n'
    )
    process.exit(bloquearia ? 2 : 0)
  }

  if (!apply) {
    process.exit(0)
  }

  if (demoOnlyApply && !isDemo) {
    console.error('DEMO_ONLY_APPLY=1: la asamblea no es is_demo; no se ejecutó el RPC.')
    process.exit(1)
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc('registrar_consentimiento_y_consumo_sesion', {
    p_codigo: codigoNorm,
    p_identificador: identificador,
    p_ip: null,
  })
  if (rpcErr) {
    console.error('RPC error:', rpcErr.message)
    process.exit(1)
  }
  console.log('\nResultado RPC:', JSON.stringify(rpcData, null, 2))
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
