import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Términos y documentos legales | Asambleas Online',
  description:
    'Términos y condiciones, EULA, política de privacidad y cookies. Incluye información sobre créditos (tokens), consumo por sesión y protección de datos.',
}

export default function TerminosLayout({ children }: { children: ReactNode }) {
  return children
}
