import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Importar unidades',
  description: 'Importación masiva de unidades.',
}

export default function ImportarUnidadesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
