'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function isErrorWithMessage(value: unknown): value is { message: string } {
  return typeof value === 'object' && value !== null && 'message' in value
}

export default function RestablecerPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setChecking(false)
      if (!user) router.replace('/login')
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setMessage('Contraseña actualizada. Redirigiendo al dashboard...')
      setTimeout(() => router.replace('/dashboard'), 1500)
    } catch (err: unknown) {
      setError(isErrorWithMessage(err) ? err.message : 'Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center">Nueva contraseña</h1>
        {message && <div className="bg-green-900/30 border border-green-600 rounded-lg p-3 text-sm text-green-300">{message}</div>}
        {error && <div className="bg-red-900/30 border border-red-600 rounded-lg p-3 text-sm text-red-300">{error}</div>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nueva contraseña"
          minLength={6}
          className="w-full p-2 rounded bg-gray-700 border border-gray-600"
          required
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirmar contraseña"
          minLength={6}
          className="w-full p-2 rounded bg-gray-700 border border-gray-600"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-600 p-2 rounded font-bold hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  )
}
