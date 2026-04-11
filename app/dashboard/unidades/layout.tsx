import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Unidades',
  description: 'Censo de unidades y coeficientes.',
}

export default function UnidadesSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
