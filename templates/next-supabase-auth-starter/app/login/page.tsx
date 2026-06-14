'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/providers/ToastProvider'
import { getAppName } from '@/lib/utils'

export default function LoginPage() {
  const appName = getAppName()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [useMagicLink, setUseMagicLink] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const router = useRouter()
  const toast = useToast()

  const getCallbackUrl = () =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
        : 'http://localhost:3000/auth/callback'

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) toast.error(error.message)
    else router.push('/dashboard')
    setLoading(false)
  }

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: getCallbackUrl() },
    })
    if (error) toast.error(error.message)
    else setMagicLinkSent(true)
    setLoading(false)
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getCallbackUrl(),
    })
    if (error) toast.error(error.message)
    else toast.success('Revisa tu correo para restablecer la contraseña')
    setLoading(false)
  }

  const getOAuthCallbackUrl = () => {
    const base = getCallbackUrl()
    const oauthBase = base.replace(/\/auth\/callback\/?$/, '') + '/auth/callback/oauth'
    const redirectTo = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('redirect')
      : null
    const next = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard'
    return `${oauthBase}?next=${encodeURIComponent(next)}`
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getOAuthCallbackUrl() },
    })
    if (error) toast.error(error.message)
    setLoading(false)
  }

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white py-8 px-4">
      <Link href="/" className="mb-6 text-xl font-bold text-indigo-400 hover:text-indigo-300">
        {appName}
      </Link>
      {content}
    </div>
  )

  if (showForgotPassword) {
    return shell(
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center">Restablecer contraseña</h1>
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
              className="flex-1 py-2 rounded border border-gray-500 text-gray-300 hover:bg-gray-700"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded bg-indigo-600 font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              Enviar enlace
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (magicLinkSent) {
    return shell(
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Revisa tu correo</h1>
        <p className="text-gray-400">Enlace enviado a <strong>{email}</strong></p>
        <button
          onClick={() => { setMagicLinkSent(false); setUseMagicLink(false) }}
          className="text-indigo-400 hover:text-indigo-300 text-sm"
        >
          ← Volver al login
        </button>
      </div>
    )
  }

  return shell(
    <form
      onSubmit={useMagicLink ? handleMagicLinkLogin : handlePasswordLogin}
      className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md space-y-4"
    >
      <h1 className="text-2xl font-bold text-center">Entrar a {appName}</h1>
      <p className="text-sm text-gray-400 text-center">
        ¿No tienes cuenta?{' '}
        <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
          Regístrate
        </Link>
      </p>

      <div className="flex gap-2 bg-gray-700 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setUseMagicLink(false)}
          className={`flex-1 py-2 rounded-md transition ${!useMagicLink ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400'}`}
        >
          Contraseña
        </button>
        <button
          type="button"
          onClick={() => setUseMagicLink(true)}
          className={`flex-1 py-2 rounded-md transition ${useMagicLink ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400'}`}
        >
          Magic Link
        </button>
      </div>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
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
            className="w-full p-2 rounded bg-gray-700 border border-gray-600"
            required
          />
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-sm text-amber-400 hover:text-amber-300 w-full text-center"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 p-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Procesando...' : useMagicLink ? 'Enviar Magic Link' : 'Entrar'}
      </button>

      <div className="relative my-2">
        <span className="block w-full h-px bg-gray-600" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 px-2 text-xs text-gray-400">
          o continuar con
        </span>
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-medium bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-50"
      >
        Entrar con Google
      </button>
    </form>
  )
}
