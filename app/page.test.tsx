import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './page'

describe('Home (landing)', () => {
  it('muestra el título Asambleas App', () => {
    render(<Home />)
    expect(screen.getByText(/Asambleas App/i)).toBeInTheDocument()
  })

  it('muestra el enlace Iniciar sesión', () => {
    render(<Home />)
    const links = screen.getAllByRole('link', { name: /iniciar sesión/i })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', '/login')
  })

  it('muestra las secciones de features', () => {
    render(<Home />)
    expect(screen.getAllByText(/Quórum en tiempo real/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Actas y auditoría/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Seguro y multi-conjunto/i)).toBeInTheDocument()
  })

  it('muestra la prueba social 500+ usuarios', () => {
    render(<Home />)
    expect(screen.getByText(/500\+ usuarios simultáneos/i)).toBeInTheDocument()
    expect(screen.getByText(/latencia menor a 200 ms/i)).toBeInTheDocument()
  })

  it('muestra la tabla de precios', () => {
    render(<Home />)
    expect(screen.getAllByText(/Gratis/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Pro/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Personalizado/i)).toBeInTheDocument()
  })
})
