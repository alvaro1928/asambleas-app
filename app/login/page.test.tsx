import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastProvider } from '@/components/providers/ToastProvider'
import LoginPage from './page'

function renderLogin() {
  return render(
    <ToastProvider>
      <LoginPage />
    </ToastProvider>
  )
}

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
    renderLogin()
    expect(screen.getByRole('heading', { name: /entrar a asambleas/i })).toBeInTheDocument()
  })

  it('muestra selector Contraseña y Magic Link', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /^contraseña$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^magic link$/i })).toBeInTheDocument()
  })

  it('muestra campo email y contraseña en modo Contraseña', () => {
    renderLogin()
    expect(screen.getByPlaceholderText(/tu@email\.com/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/tu contraseña/i)).toBeInTheDocument()
  })

  it('muestra enlace ¿Olvidaste tu contraseña?', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /olvidaste tu contraseña/i })).toBeInTheDocument()
  })

  it('al hacer clic en Olvidaste contraseña muestra formulario de recuperación', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    expect(screen.getByRole('heading', { name: /restablecer contraseña/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar enlace de recuperación/i })).toBeInTheDocument()
  })
})
