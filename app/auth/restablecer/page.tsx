'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
      if (!user) {
        router.replace('/login')
      }
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
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto" />
          <p className="mt-4 text-gray-400">Comprobando sesión...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-8 rounded-xl shadow-2xl w-96 space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">Nueva contraseña</h1>
        <p className="text-sm text-gray-400 text-center">
          Elige una contraseña segura (mínimo 6 caracteres).
        </p>

        {message && (
          <div className="bg-green-900/30 border border-green-600 rounded-lg p-3 text-sm text-green-300">
            {message}
          </div>
        )}
        {error && (
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-3 text-sm text-red-300">
            {error}
          </div>
        )}

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

        <button
          type="button"
          onClick={() => router.push('/login')}
          className="w-full text-indigo-400 hover:text-indigo-300 text-sm"
        >
          ← Volver al login
        </button>
      </form>
    </div>
  )
}
