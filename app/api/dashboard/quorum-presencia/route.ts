import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { calcularQuorumPresencia, recalculateQuorumAndLog } from '@/lib/quorum/quorum-service'
import { createQuorumSnapshot, type QuorumSnapshotType } from '@/lib/quorum/snapshot-service'
import { publicErrorMessage, logRouteError } from '@/lib/route-errors'

export const dynamic = 'force-dynamic'

type Body = {
  asamblea_id?: string
  pregunta_id?: string | null
  snapshot_type?: QuorumSnapshotType
  force_recalculate?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as Body
    const asambleaId = String(body.asamblea_id ?? '').trim()
    const preguntaId = String(body.pregunta_id ?? '').trim() || null

    if (!asambleaId) {
      return NextResponse.json({ error: 'No se recibió la asamblea para calcular quórum de presencia' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración interna incompleta' }, { status: 500 })
    }
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', session.user.id)
      .single()

    const { data: asamblea } = await admin
      .from('asambleas')
      .select('id, organization_id')
      .eq('id', asambleaId)
      .single()

    if (!asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }
    if (profile?.organization_id && asamblea.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Sin permiso para esta asamblea' }, { status: 403 })
    }

    const quorum = body.force_recalculate
      ? await recalculateQuorumAndLog(asambleaId, { preguntaId, triggeredBy: 'dashboard' })
      : await calcularQuorumPresencia(asambleaId, preguntaId)

    let snapshotId: string | null = null
    if (body.snapshot_type) {
      snapshotId = await createQuorumSnapshot({
        asambleaId,
        preguntaId,
        snapshotType: body.snapshot_type,
        metadata: { source: 'dashboard-api' },
      })
    }

    return NextResponse.json({
      ok: true,
      quorum,
      snapshot_id: snapshotId,
    })
  } catch (error) {
    logRouteError('api/dashboard/quorum-presencia', error)
    return NextResponse.json(
      { error: publicErrorMessage(error, 'No fue posible actualizar el quórum de presencia automática') },
      { status: 500 }
    )
  }
}
