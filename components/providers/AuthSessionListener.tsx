'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/providers/ToastProvider'

/**
 * Escucha cambios de sesión (expiración, cierre) y redirige a login con toast.
 * Solo tiene efecto en rutas protegidas (dashboard, super-admin).
 */
export function AuthSessionListener() {
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    const isProtected = pathname?.startsWith('/dashboard') || pathname?.startsWith('/super-admin')
    if (!isProtected) return

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !session && isProtected) {
        toast.error('Tu sesión fue cerrada')
        router.replace('/login?redirect=' + encodeURIComponent(pathname || '/dashboard'))
      }
    })

    return () => subscription.unsubscribe()
  }, [pathname, router, toast])

  return null
}
