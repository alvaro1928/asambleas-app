import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Editar conjunto',
  description: 'Datos del conjunto y configuración.',
}

export default function EditarConjuntoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
