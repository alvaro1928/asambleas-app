import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nueva asamblea',
  description: 'Crear una nueva asamblea.',
}

export default function NuevaAsambleaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
