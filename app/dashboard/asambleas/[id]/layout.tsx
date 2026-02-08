import type { Metadata } from 'next'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
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
  const { data } = await supabase
    .from('asambleas')
    .select('nombre')
    .eq('id', id)
    .single()

  const nombre = data?.nombre ?? 'Asamblea'
  return {
    title: nombre,
    description: `Panel de control de la asamblea "${nombre}". Quórum, preguntas de votación y gestión de poderes.`,
  }
}

export default function AsambleaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
