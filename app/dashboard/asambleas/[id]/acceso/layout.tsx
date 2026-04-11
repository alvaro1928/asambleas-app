import type { Metadata } from 'next'
import { getAsambleaNombreForTitle } from '@/lib/asamblea-metadata'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const nombre = await getAsambleaNombreForTitle(id)
  return {
    title: `Acceso e invitaciones · ${nombre}`,
    description: `Enlaces, QR e invitaciones para la asamblea "${nombre}".`,
  }
}

export default function AccesoSegmentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
