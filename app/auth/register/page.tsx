'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/providers/ToastProvider'

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
  const i = Math.min(score, 4)
  return { score, label: levels[i].label, color: levels[i].color }
}

function meetsPasswordRules(pwd: string): boolean {
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)
}

export default function RegisterPage() {
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

  const strength = useCallback(() => passwordStrength(password), [password])
  const strengthInfo = strength()

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
        if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists') || error.code === 'user_already_exists') {
          toast.error('Este correo ya está registrado. ¿Quieres iniciar sesión?')
          return
        }
        toast.error(error.message)
        return
      }
      if (data?.user && !data.user.identities?.length) {
        toast.error('Este correo ya está registrado. ¿Quieres iniciar sesión?')
        return
      }
      setSuccess(true)
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 py-8">
        <Link href="/" className="mb-4 flex justify-center">
          <Image src="/logo.png" alt="VOTA TECH" width={80} height={80} className="rounded-full object-contain" unoptimized />
        </Link>
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">¡Casi listo!</h1>
          <p className="text-gray-300">
            Revisa tu correo (<strong>{email}</strong>) para activar tu cuenta. Haz clic en el enlace que te enviamos y podrás iniciar sesión.
          </p>
          <p className="text-sm text-gray-400">
            Si no ves el correo, revisa la carpeta de spam.
          </p>
          <Link
            href="/login"
            className="inline-block w-full py-3 rounded-xl bg-indigo-600 font-semibold hover:bg-indigo-700 transition-colors"
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 py-8">
      <Link href="/" className="mb-4 flex justify-center">
        <Image src="/logo.png" alt="VOTA TECH" width={80} height={80} className="rounded-full object-contain" unoptimized />
      </Link>
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">Crear cuenta</h1>
        <p className="text-sm text-gray-400 text-center">
          Regístrate con tu correo y contraseña para gestionar asambleas.
        </p>

        {/* Honeypot: no visible, no autocomplete */}
        <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
          <label htmlFor="website">No completar</label>
          <input
            id="website"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-300 mb-1">
            Nombre completo
          </label>
          <input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ej. María García"
            autoComplete="name"
            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            required
            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mín. 8 caracteres, una mayúscula y un número"
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {password && (
            <div className="mt-2">
              <div className="flex gap-1 h-1.5 rounded overflow-hidden bg-gray-700">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 transition-colors ${i <= strengthInfo.score ? strengthInfo.color : 'bg-gray-600'}`}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {strengthInfo.label}
                {!meetsPasswordRules(password) && password.length > 0 && (
                  <span className="text-amber-400 ml-1">(requiere: 8+ caracteres, mayúscula y número)</span>
                )}
              </p>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-300 mb-1">
            Confirmar contraseña
          </label>
          <input
            id="confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite tu contraseña"
            autoComplete="new-password"
            required
            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-amber-400 mt-1">Las contraseñas no coinciden</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !meetsPasswordRules(password) || password !== confirmPassword}
          className="w-full py-3 rounded-xl bg-indigo-600 font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        <p className="text-center text-sm text-gray-400">
          ¿Prefieres no usar contraseña?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Regístrate con Google o Magic Link
          </Link>
        </p>

        <div className="relative my-4">
          <span className="block w-full h-px bg-gray-600" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 px-2 text-xs text-gray-400">
            o continuar con
          </span>
        </div>

        <Link
          href="/login"
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium bg-white text-gray-800 hover:bg-gray-100 border border-gray-300 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Usar Google (iniciar sesión)
        </Link>

        <p className="text-center text-sm text-gray-400">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Iniciar sesión
          </Link>
        </p>

        <p className="text-center">
          <Link href="/login" className="text-sm text-amber-400 hover:text-amber-300" title="Recibir enlace para restablecer contraseña">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </form>
    </div>
  )
}
