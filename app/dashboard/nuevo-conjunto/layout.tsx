import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nuevo conjunto',
  description: 'Registrar un nuevo conjunto residencial.',
}

export default function NuevoConjuntoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
