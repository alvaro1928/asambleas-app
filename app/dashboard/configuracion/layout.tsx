import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Configuración',
  description: 'Preferencias de cuenta y organización.',
}

export default function ConfiguracionSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
