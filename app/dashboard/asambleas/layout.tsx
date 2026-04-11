import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Asambleas',
  description: 'Lista y gestión de asambleas del conjunto.',
}

export default function AsambleasSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
