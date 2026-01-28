'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('alvarocontreras35@gmail.com')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [useMagicLink, setUseMagicLink] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const router = useRouter()

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert("Error: " + error.message)
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 🔥 URLs dinámicas para producción
    const redirectTo = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth/callback`
      : process.env.NEXT_PUBLIC_SITE_URL 
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
        : 'http://localhost:3000/auth/callback'

    console.log('🔍 [DEBUG] Enviando Magic Link con redirectTo:', redirectTo)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    console.log('✅ [DEBUG] Magic Link enviado, error:', error)

    if (error) {
      alert("Error: " + error.message)
    } else {
      setMagicLinkSent(true)
    }
    setLoading(false)
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
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
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <form 
        onSubmit={useMagicLink ? handleMagicLinkLogin : handlePasswordLogin} 
        className="bg-gray-800 p-8 rounded-xl shadow-2xl w-96 space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">Entrar a Asambleas</h1>
        
        {/* Selector de método */}
        <div className="flex gap-2 bg-gray-700 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setUseMagicLink(false)}
            className={`flex-1 py-2 rounded-md transition ${
              !useMagicLink 
                ? 'bg-indigo-600 text-white font-bold' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Contraseña
          </button>
          <button
            type="button"
            onClick={() => setUseMagicLink(true)}
            className={`flex-1 py-2 rounded-md transition ${
              useMagicLink 
                ? 'bg-indigo-600 text-white font-bold' 
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
          className="w-full p-2 rounded bg-gray-700 border border-gray-600"
          required
        />
        
        {!useMagicLink && (
          <input 
            type="password" 
            placeholder="Tu contraseña" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600"
            required
          />
        )}

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-indigo-600 p-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Procesando...' : useMagicLink ? '📧 Enviar Magic Link' : 'Entrar Ahora'}
        </button>

        {useMagicLink && (
          <p className="text-xs text-gray-400 text-center">
            Te enviaremos un enlace seguro por correo
          </p>
        )}
      </form>
    </div>
  )
}