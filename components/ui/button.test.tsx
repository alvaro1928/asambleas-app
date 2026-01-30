import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button', () => {
  it('renderiza con el texto dado', () => {
    render(<Button>Entrar</Button>)
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('puede estar deshabilitado', () => {
    render(<Button disabled>Enviar</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('acepta variant destructive', () => {
    render(<Button variant="destructive">Eliminar</Button>)
    const btn = screen.getByRole('button', { name: /eliminar/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveClass('bg-red-600')
  })
})
