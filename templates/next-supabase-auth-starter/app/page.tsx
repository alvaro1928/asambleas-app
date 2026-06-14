import Link from 'next/link'
import { getAppName } from '@/lib/utils'

export default function HomePage() {
  const appName = getAppName()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="max-w-lg text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">{appName}</h1>
        <p className="text-slate-600">
          Starter Next.js 14 + Supabase Auth. Incluye login, registro, Magic Link, reset password y Google OAuth.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl border border-slate-300 font-semibold hover:bg-white transition-colors"
          >
            Ir al dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
