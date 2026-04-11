import type { Metadata } from 'next'
import { getAsambleaNombreForTitle } from '@/lib/asamblea-metadata'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const nombre = await getAsambleaNombreForTitle(id)
  return {
    title: `Poderes · ${nombre}`,
    description: `Gestión de poderes de representación de la asamblea "${nombre}".`,
  }
}

export default function PoderesSegmentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
