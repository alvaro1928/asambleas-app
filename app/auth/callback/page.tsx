'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔍 [CALLBACK CLIENT] Iniciando...')
        console.log('🔍 [CALLBACK CLIENT] URL completa:', window.location.href)
        console.log('🔍 [CALLBACK CLIENT] Hash:', window.location.hash)
        console.log('🔍 [CALLBACK CLIENT] Search:', window.location.search)

        // 1. Intentar obtener tokens del hash (Implicit Flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')

        if (access_token && refresh_token) {
          console.log('✅ [CALLBACK CLIENT] Tokens encontrados en hash')
          
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })

          if (error) {
            console.error('❌ [CALLBACK CLIENT] Error estableciendo sesión:', error)
            setError(error.message)
            return
          }

          console.log('✅ [CALLBACK CLIENT] Sesión establecida correctamente')
          console.log('✅ [CALLBACK CLIENT] Usuario:', data.user?.email)
          
          // Forzar reload completo para sincronizar cookies
          console.log('🔄 [CALLBACK CLIENT] Redirigiendo al dashboard...')
          window.location.href = '/dashboard'
          return
        }

        // 2. Intentar obtener tokens de query params (por si acaso)
        const searchParams = new URLSearchParams(window.location.search)
        const access_token_query = searchParams.get('access_token')
        const refresh_token_query = searchParams.get('refresh_token')

        if (access_token_query && refresh_token_query) {
          console.log('✅ [CALLBACK CLIENT] Tokens encontrados en query params')
          
          const { data, error } = await supabase.auth.setSession({
            access_token: access_token_query,
            refresh_token: refresh_token_query,
          })

          if (error) {
            console.error('❌ [CALLBACK CLIENT] Error estableciendo sesión:', error)
            setError(error.message)
            return
          }

          console.log('✅ [CALLBACK CLIENT] Sesión establecida correctamente')
          console.log('🔄 [CALLBACK CLIENT] Redirigiendo al dashboard...')
          window.location.href = '/dashboard'
          return
        }

        // 3. Si no hay tokens, mostrar error
        console.error('❌ [CALLBACK CLIENT] No se encontraron tokens')
        setError('No se encontraron tokens de autenticación')
      } catch (err) {
        console.error('❌ [CALLBACK CLIENT] Error:', err)
        setError('Error procesando autenticación')
      }
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="bg-red-900/20 border border-red-500 p-8 rounded-xl max-w-md">
          <h1 className="text-2xl font-bold mb-4">Error de Autenticación</h1>
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={() => router.push('/login')}
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
