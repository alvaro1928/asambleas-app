'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getAppName } from '@/lib/utils'

export default function DashboardPage() {
  const appName = getAppName()
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login')
        return
      }
      setEmail(user.email ?? null)
      setLoading(false)
    })
  }, [router])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-indigo-600">{appName}</Link>
          <button
            onClick={handleSignOut}
            className="text-sm px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100"
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      <section className="container mx-auto px-4 py-12 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-slate-600 mb-8">
          Sesión activa como <strong>{email}</strong>. Empieza a construir tu app desde aquí.
        </p>
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-3 text-sm text-slate-600">
          <p>✅ Auth con Supabase configurada</p>
          <p>✅ Middleware protege esta ruta</p>
          <p>✅ Magic Link, reset password y Google OAuth listos</p>
        </div>
      </section>
    </main>
  )
}
