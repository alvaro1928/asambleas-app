import type { Metadata } from 'next'
import { getAsambleaNombreForTitle } from '@/lib/asamblea-metadata'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const nombre = await getAsambleaNombreForTitle(id)
  return {
    title: `Importar poderes · ${nombre}`,
    description: `Importación masiva de poderes para la asamblea "${nombre}".`,
  }
}

export default function ImportarPoderesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
