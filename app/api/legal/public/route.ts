import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getDefaultLegalDocs, LEGAL_DOC_ORDER, LEGAL_DOCS_DEFAULT, type LegalDocKey, type LegalDocument } from '@/lib/legal-docs'

interface LegalRow {
  doc_key: LegalDocKey
  titulo: string | null
  contenido: string | null
  ultima_actualizacion: string | null
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ documentos: getDefaultLegalDocs() })
    }

    const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
    const { data, error } = await supabase
      .from('configuracion_legal')
      .select('doc_key, titulo, contenido, ultima_actualizacion')

    if (error) {
      console.warn('GET /api/legal/public fallback default:', error.message)
      return NextResponse.json({ documentos: getDefaultLegalDocs() })
    }

    const byKey = new Map<LegalDocKey, LegalRow>()
    ;(data || []).forEach((row) => {
      const r = row as LegalRow
      byKey.set(r.doc_key, r)
    })

    const documentos: LegalDocument[] = LEGAL_DOC_ORDER.map((key) => {
      const db = byKey.get(key)
      const fallback = LEGAL_DOCS_DEFAULT[key]
      return {
        key,
        titulo: db?.titulo?.trim() || fallback.titulo,
        contenido: db?.contenido?.trim() || fallback.contenido,
        ultima_actualizacion: db?.ultima_actualizacion?.trim() || fallback.ultima_actualizacion,
      }
    })

    const res = NextResponse.json({ documentos })
    res.headers.set('Cache-Control', 'no-store, max-age=0')
    return res
  } catch (e) {
    console.error('GET /api/legal/public:', e)
    return NextResponse.json({ documentos: getDefaultLegalDocs() })
  }
}

