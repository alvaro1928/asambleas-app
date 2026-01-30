'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const FETCH_OPTIONS = {
  method: 'POST' as const,
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include' as RequestCredentials,
}

function doRedirect(isRecovery?: boolean) {
  const url = isRecovery ? `/auth/restablecer?t=${Date.now()}` : `/dashboard?t=${Date.now()}`
  window.location.replace(url)
}

export default function CallbackPage() {
  const [error, setError] = useState<string | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current) return

    const handleCallback = async () => {
      try {
        const hash = window.location.hash
        const search = window.location.search
        const searchParams = new URLSearchParams(search)

        // 0. token_hash en query (evita pérdida del hash en navegadores con caché)
        const token_hash = searchParams.get('token_hash')
        const typeParam = searchParams.get('type')
        if (token_hash && (typeParam === 'email' || typeParam === 'recovery')) {
          doneRef.current = true
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash,
            type: typeParam as 'email' | 'recovery',
          })
          if (verifyError) {
            setError(verifyError.message)
            return
          }
          if (window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname)
          }
          setTimeout(() => doRedirect(typeParam === 'recovery'), 150)
          return
        }

        // 1. Tokens en el hash (Magic Link / Recovery / Implicit Flow)
        const hashParams = new URLSearchParams(hash.substring(1))
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        if (access_token && refresh_token) {
          doneRef.current = true

          const response = await fetch('/api/auth/set-session', {
            ...FETCH_OPTIONS,
            body: JSON.stringify({ access_token, refresh_token }),
          })
          const result = await response.json()

          if (!response.ok || result.error) {
            setError(result.error || 'Error estableciendo sesión')
            return
          }
          if (window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
          }
          const isRecovery = type === 'recovery'
          setTimeout(() => doRedirect(isRecovery), 150)
          return
        }

        // 2. Tokens en query (por si el cliente los manda ahí)
        const access_token_query = searchParams.get('access_token')
        const refresh_token_query = searchParams.get('refresh_token')

        if (access_token_query && refresh_token_query) {
          doneRef.current = true
          const response = await fetch('/api/auth/set-session', {
            ...FETCH_OPTIONS,
            body: JSON.stringify({
              access_token: access_token_query,
              refresh_token: refresh_token_query,
            }),
          })
          const result = await response.json()

          if (!response.ok || result.error) {
            setError(result.error || 'Error estableciendo sesión')
            return
          }
          if (window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname)
          }
          setTimeout(doRedirect, 150)
          return
        }

        // 3. Code (OAuth / PKCE)
        const code = searchParams.get('code')
        if (code) {
          doneRef.current = true
          const response = await fetch('/api/auth/set-session', {
            ...FETCH_OPTIONS,
            body: JSON.stringify({ code }),
          })
          const result = await response.json()

          if (!response.ok || result.error) {
            setError(result.error || 'Error estableciendo sesión')
            return
          }
          if (window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname)
          }
          setTimeout(doRedirect, 150)
          return
        }

        setError('No se encontraron tokens de autenticación')
      } catch (err) {
        console.error(err)
        setError('Error procesando autenticación')
      }
    }

    handleCallback()
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="bg-red-900/20 border border-red-500 p-8 rounded-xl max-w-md">
          <h1 className="text-2xl font-bold mb-4">Error de Autenticación</h1>
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-indigo-600 px-4 py-2 rounded hover:bg-indigo-700"
          >
            Volver al Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
        <p className="text-lg">Completando autenticación...</p>
        <p className="text-sm text-gray-400">Serás redirigido al dashboard</p>
      </div>
    </div>
  )
}
