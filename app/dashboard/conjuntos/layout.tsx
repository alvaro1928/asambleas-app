import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conjuntos',
  description: 'Administración de conjuntos residenciales.',
}

export default function ConjuntosSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
