import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './page'

describe('Home (landing)', () => {
  it('muestra descripción SEO en el pie', () => {
    render(<Home />)
    expect(
      screen.getByText(/Votaciones y actas para propiedad horizontal en Colombia/i)
    ).toBeInTheDocument()
  })

  it('muestra el enlace Iniciar sesión', () => {
    render(<Home />)
    const links = screen.getAllByRole('link', { name: /iniciar sesión/i })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', '/login')
  })

  it('muestra las secciones de features', () => {
    render(<Home />)
    expect(screen.getAllByText(/Quórum y resultados en tiempo real/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Actas, certificados de voto y trazabilidad/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Datos por conjunto, consentimiento Ley 1581 y acceso seguro/i)).toBeInTheDocument()
  })

  it('muestra valor: acta, quórum y blockchain', () => {
    render(<Home />)
    expect(
      screen.getByText(/Quórum, asistencia verificable y acta lista al cierre/i)
    ).toBeInTheDocument()
    expect(screen.getAllByText(/blockchain/i).length).toBeGreaterThan(0)
  })

  it('muestra sello blockchain y mención gratuita', () => {
    render(<Home />)
    expect(screen.getAllByText(/Gratis/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/blockchain/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/OpenTimestamps/i).length).toBeGreaterThan(0)
  })
})
