import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessSuperAdminEmail } from '@/lib/super-admin'
import { getDefaultLegalDocs, LEGAL_DOC_ORDER, LEGAL_DOCS_DEFAULT, type LegalDocKey, type LegalDocument } from '@/lib/legal-docs'

interface LegalRow {
  doc_key: LegalDocKey
  titulo: string | null
  contenido: string | null
  ultima_actualizacion: string | null
}

function mergeWithDefaults(rows: LegalRow[] | null | undefined): LegalDocument[] {
  const byKey = new Map<LegalDocKey, LegalRow>()
  ;(rows || []).forEach((row) => byKey.set(row.doc_key, row))
  return LEGAL_DOC_ORDER.map((key) => {
    const row = byKey.get(key)
    const fallback = LEGAL_DOCS_DEFAULT[key]
    return {
      key,
      titulo: row?.titulo?.trim() || fallback.titulo,
      contenido: row?.contenido?.trim() || fallback.contenido,
      ultima_actualizacion: row?.ultima_actualizacion?.trim() || fallback.ultima_actualizacion,
    }
  })
}

async function buildAuthClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
}

export async function GET() {
  try {
    const supabase = await buildAuthClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await canAccessSuperAdminEmail(supabase, session.user.email))) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false } })
    const { data, error } = await admin
      .from('configuracion_legal')
      .select('doc_key, titulo, contenido, ultima_actualizacion')

    if (error) {
      console.warn('GET /api/super-admin/configuracion-legal fallback default:', error.message)
      return NextResponse.json({ documentos: getDefaultLegalDocs() })
    }
    return NextResponse.json({ documentos: mergeWithDefaults((data || []) as LegalRow[]) })
  } catch (e) {
    console.error('GET /api/super-admin/configuracion-legal:', e)
    return NextResponse.json({ error: 'Error al obtener configuración legal' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await buildAuthClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await canAccessSuperAdminEmail(supabase, session.user.email))) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })

    const body = await request.json().catch(() => ({}))
    const documentos = (body.documentos || []) as Array<Partial<LegalDocument> & { key?: LegalDocKey }>
    if (!Array.isArray(documentos) || documentos.length === 0) {
      return NextResponse.json({ error: 'No se recibieron documentos para guardar' }, { status: 400 })
    }

    const payload = documentos
      .filter((d): d is { key: LegalDocKey; titulo?: string; contenido?: string; ultima_actualizacion?: string } => !!d?.key && LEGAL_DOC_ORDER.includes(d.key))
      .map((d) => ({
        doc_key: d.key,
        titulo: (d.titulo ?? LEGAL_DOCS_DEFAULT[d.key].titulo).trim(),
        contenido: (d.contenido ?? LEGAL_DOCS_DEFAULT[d.key].contenido).trim(),
        ultima_actualizacion: (d.ultima_actualizacion ?? LEGAL_DOCS_DEFAULT[d.key].ultima_actualizacion).trim(),
        updated_at: new Date().toISOString(),
      }))

    if (payload.length === 0) {
      return NextResponse.json({ error: 'No hay documentos válidos para guardar' }, { status: 400 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false } })
    const { error } = await admin
      .from('configuracion_legal')
      .upsert(payload, { onConflict: 'doc_key' })

    if (error) {
      console.error('PATCH /api/super-admin/configuracion-legal:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: latest, error: latestErr } = await admin
      .from('configuracion_legal')
      .select('doc_key, titulo, contenido, ultima_actualizacion')
    if (latestErr) return NextResponse.json({ ok: true, documentos: getDefaultLegalDocs() })
    return NextResponse.json({ ok: true, documentos: mergeWithDefaults((latest || []) as LegalRow[]) })
  } catch (e) {
    console.error('PATCH /api/super-admin/configuracion-legal:', e)
    return NextResponse.json({ error: 'Error al guardar configuración legal' }, { status: 500 })
  }
}

