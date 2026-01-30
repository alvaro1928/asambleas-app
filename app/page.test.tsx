import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './page'

describe('Home (landing)', () => {
  it('muestra el título Asambleas App', () => {
    render(<Home />)
    expect(screen.getByText(/Asambleas App/i)).toBeInTheDocument()
  })

  it('muestra el enlace Iniciar Sesión', () => {
    render(<Home />)
    const link = screen.getByRole('link', { name: /iniciar sesión/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/login')
  })

  it('muestra las secciones de features', () => {
    render(<Home />)
    expect(screen.getByText(/Gestión Fácil/i)).toBeInTheDocument()
    expect(screen.getByText(/Seguro/i)).toBeInTheDocument()
    expect(screen.getByText(/Multi-tenant/i)).toBeInTheDocument()
  })
})
