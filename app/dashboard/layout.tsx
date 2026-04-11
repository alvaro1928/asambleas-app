import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Inicio',
  description: 'Gestiona tus conjuntos, unidades, asambleas y votaciones online. Quórum en tiempo real, actas y cumplimiento Ley 675.',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
