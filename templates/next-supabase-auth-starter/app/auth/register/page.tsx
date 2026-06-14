'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/providers/ToastProvider'
import { getAppName } from '@/lib/utils'

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: 'bg-gray-600' }
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  const levels = [
    { label: 'Muy débil', color: 'bg-red-500' },
    { label: 'Débil', color: 'bg-amber-500' },
    { label: 'Aceptable', color: 'bg-yellow-500' },
    { label: 'Buena', color: 'bg-lime-500' },
    { label: 'Fuerte', color: 'bg-green-500' },
  ]
  return { score, label: levels[Math.min(score, 4)].label, color: levels[Math.min(score, 4)].color }
}

function meetsPasswordRules(pwd: string): boolean {
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)
}

function isErrorWithMessage(value: unknown): value is { message: string } {
  return typeof value === 'object' && value !== null && 'message' in value
}

export default function RegisterPage() {
  const appName = getAppName()
  const router = useRouter()
  const toast = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !success) router.replace('/dashboard')
    })
  }, [router, success])

  const strengthInfo = useCallback(() => passwordStrength(password), [password])()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (honeypot) return
    if (!meetsPasswordRules(password)) {
      toast.error('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() || undefined },
          emailRedirectTo: typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined,
        },
      })
      if (error) {
        toast.error(error.message)
        return
      }
      if (data?.user && !data.user.identities?.length) {
        toast.error('Este correo ya está registrado.')
        return
      }
      setSuccess(true)
    } catch (err: unknown) {
      toast.error(isErrorWithMessage(err) ? err.message : 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Revisa tu correo</h1>
          <p className="text-gray-300">
            Activación enviada a <strong>{email}</strong>
          </p>
          <Link href="/login" className="inline-block w-full py-3 rounded-xl bg-indigo-600 font-semibold hover:bg-indigo-700">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <Link href="/" className="mb-6 text-xl font-bold text-indigo-400 hover:text-indigo-300">
        {appName}
      </Link>
      <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center">Crear cuenta</h1>

        <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
          <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </div>

        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
          <input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Correo</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600"
          />
          {password && (
            <p className="text-xs text-gray-400 mt-1">{strengthInfo.label}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-300 mb-1">Confirmar</label>
          <input
            id="confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !meetsPasswordRules(password) || password !== confirmPassword}
          className="w-full py-3 rounded-xl bg-indigo-600 font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        <p className="text-center text-sm text-gray-400">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Iniciar sesión</Link>
        </p>
      </form>
    </div>
  )
}
