import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Legal y datos',
  description: 'Tratamiento de datos y cumplimiento normativo.',
}

export default function LegalDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
