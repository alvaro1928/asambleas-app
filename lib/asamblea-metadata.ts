import { cache } from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/** Nombre de asamblea para `<title>`; deduplicado en la misma petición. */
export const getAsambleaNombreForTitle = cache(async (asambleaId: string): Promise<string> => {
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
    .eq('id', asambleaId)
    .single()

  return data?.nombre ?? 'Asamblea'
})
