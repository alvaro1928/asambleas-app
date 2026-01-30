import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LoginPage from './page'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('renderiza el título Entrar a Asambleas', () => {
    render(<LoginPage />)
    expect(screen.getByRole('heading', { name: /entrar a asambleas/i })).toBeInTheDocument()
  })

  it('muestra selector Contraseña y Magic Link', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /^contraseña$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^magic link$/i })).toBeInTheDocument()
  })

  it('muestra campo email y contraseña en modo Contraseña', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText(/tu@email\.com/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/tu contraseña/i)).toBeInTheDocument()
  })

  it('muestra enlace ¿Olvidaste tu contraseña?', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /olvidaste tu contraseña/i })).toBeInTheDocument()
  })

  it('al hacer clic en Olvidaste contraseña muestra formulario de recuperación', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    expect(screen.getByRole('heading', { name: /restablecer contraseña/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar enlace de recuperación/i })).toBeInTheDocument()
  })
})
