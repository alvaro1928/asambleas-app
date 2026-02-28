'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/providers/ToastProvider'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [useMagicLink, setUseMagicLink] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetLinkSent, setResetLinkSent] = useState(false)
  const router = useRouter()
  const toast = useToast()

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error(error.message)
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 🔥 URLs dinámicas para producción
    const redirectTo = getCallbackUrl()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    })


    if (error) {
      toast.error(error.message)
    } else {
      setMagicLinkSent(true)
    }
    setLoading(false)
  }

  const getCallbackUrl = () =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
        : 'http://localhost:3000/auth/callback'

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getCallbackUrl(),
    })
    if (error) {
      toast.error(error.message)
    } else {
      setResetLinkSent(true)
    }
    setLoading(false)
  }

  const getOAuthCallbackUrl = () => {
    const base = getCallbackUrl()
    const oauthBase = base.replace(/\/auth\/callback\/?$/, '') + '/auth/callback/oauth'
    const redirectTo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') : null
    const next = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard'
    return `${oauthBase}?next=${encodeURIComponent(next)}`
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getOAuthCallbackUrl() },
    })
    if (error) {
      toast.error(error.message)
    }
    setLoading(false)
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white py-8">
        <Link href="/" className="mb-4 flex justify-center">
          <Image src="/logo.png" alt="VOTA TECH" width={80} height={80} className="rounded-full object-contain" unoptimized />
        </Link>
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-96 space-y-4">
          <h1 className="text-2xl font-bold text-center">Restablecer contraseña</h1>
          <p className="text-gray-400 text-sm text-center">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
          </p>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full p-2 rounded bg-gray-700 border border-gray-600"
              required
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                title="Volver al formulario de inicio de sesión"
                className="flex-1 py-2 rounded border border-gray-500 text-gray-300 hover:bg-gray-700"
              >
                Volver
              </button>
          <button
            type="submit"
            disabled={loading}
            title="Se enviará un enlace a tu correo para restablecer la contraseña"
            className="flex-1 py-2 rounded bg-primary font-bold hover:bg-primary-hover disabled:opacity-50"
          >
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white py-8">
        <Link href="/" className="mb-4 flex justify-center">
          <Image src="/logo.png" alt="VOTA TECH" width={80} height={80} className="rounded-full object-contain" unoptimized />
        </Link>
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-96 text-center space-y-4">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">¡Revisa tu correo!</h1>
          <p className="text-gray-400">
            Te hemos enviado un enlace mágico a <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500">
            Haz clic en el enlace del correo para iniciar sesión.
          </p>
          <button 
            onClick={() => {
              setMagicLinkSent(false)
              setUseMagicLink(false)
            }}
            className="text-indigo-400 hover:text-indigo-300 text-sm"
          >
            ← Volver al login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white py-8">
      <Link href="/" className="mb-4 flex justify-center">
        <Image
          src="/logo.png"
          alt="VOTA TECH - Soluciones Comunitarias Digitales"
          width={120}
          height={120}
          className="rounded-full object-contain"
          unoptimized
        />
      </Link>
      <form 
        onSubmit={useMagicLink ? handleMagicLinkLogin : handlePasswordLogin} 
        className="bg-gray-800 p-8 rounded-xl shadow-2xl w-96 space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">Entrar a Asambleas</h1>
        <p className="text-sm text-gray-400 text-center">
          ¿No tienes cuenta?{' '}
          <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Regístrate
          </Link>
        </p>

        {/* Selector de método */}
        <div className="flex gap-2 bg-gray-700 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setUseMagicLink(false)}
            title="Entrar con tu correo y contraseña"
            className={`flex-1 py-2 rounded-md transition ${
              !useMagicLink 
                ? 'bg-primary text-white font-bold' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Contraseña
          </button>
          <button
            type="button"
            onClick={() => setUseMagicLink(true)}
            title="Recibir un enlace por correo para entrar sin contraseña"
            className={`flex-1 py-2 rounded-md transition ${
              useMagicLink 
                ? 'bg-primary text-white font-bold' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Magic Link
          </button>
        </div>

        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          title="Correo electrónico con el que te registraste"
          className="w-full p-2 rounded bg-gray-700 border border-gray-600"
          required
        />
        
        {!useMagicLink && (
          <>
            <input 
              type="password" 
              placeholder="Tu contraseña" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              title="Tu contraseña de la cuenta"
              className="w-full p-2 rounded bg-gray-700 border border-gray-600"
              required
            />
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              title="Recibir un enlace por correo para crear una nueva contraseña"
              className="text-sm text-amber-400 hover:text-amber-300 w-full text-center"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </>
        )}

        <button 
          type="submit" 
          disabled={loading}
          title={useMagicLink ? 'Se enviará un enlace a tu correo para iniciar sesión' : 'Iniciar sesión con correo y contraseña'}
          className="w-full bg-indigo-600 p-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Procesando...' : useMagicLink ? '📧 Enviar Magic Link' : 'Entrar Ahora'}
        </button>

        <div className="relative my-4">
          <span className="block w-full h-px bg-gray-600" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 px-2 text-xs text-gray-400">
            o continuar con
          </span>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-medium bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-50 border border-gray-300"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Entrar con Google
        </button>

        <p className="text-center text-sm text-gray-500">
          <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300">
            Crear cuenta con email y contraseña
          </Link>
        </p>

        {useMagicLink && (
          <p className="text-xs text-gray-400 text-center">
            Te enviaremos un enlace seguro por correo
          </p>
        )}
      </form>
    </div>
  )
}