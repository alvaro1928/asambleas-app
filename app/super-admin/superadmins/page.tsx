'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Loader2, Save, ShieldPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/providers/ToastProvider'

interface SuperAdminRow {
  id: string
  email: string
  full_name: string | null
  active: boolean
}

export default function SuperAdminsPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [superAdmins, setSuperAdmins] = useState<SuperAdminRow[]>([])
  const [principalEmail, setPrincipalEmail] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newFullName, setNewFullName] = useState('')

  const loadData = async () => {
    const res = await fetch('/api/super-admin/super-admins', { credentials: 'include' })
    if (res.status === 401 || res.status === 403) {
      router.replace('/login?redirect=/super-admin/superadmins')
      return
    }
    if (!res.ok) {
      toast.error('No se pudo cargar la lista de super admins.')
      return
    }
    const data = await res.json()
    setSuperAdmins(Array.isArray(data?.super_admins) ? data.super_admins : [])
    setPrincipalEmail(typeof data?.principal_email === 'string' ? data.principal_email : null)
  }

  useEffect(() => {
    const run = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.email) {
          router.replace('/login?redirect=/super-admin/superadmins')
          return
        }
        await loadData()
      } finally {
        setLoading(false)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const crear = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/super-admin/super-admins', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, full_name: newFullName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || 'No se pudo crear el super admin.')
        return
      }
      toast.success('Super admin agregado.')
      setNewEmail('')
      setNewFullName('')
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  const actualizar = async (id: string, fullName: string | null, active: boolean) => {
    setSaving(true)
    try {
      const res = await fetch('/api/super-admin/super-admins', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, full_name: fullName, active }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || 'No se pudo actualizar.')
        return
      }
      toast.success('Super admin actualizado.')
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este super admin?')) return
    setSaving(true)
    try {
      const res = await fetch('/api/super-admin/super-admins', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || 'No se pudo eliminar.')
        return
      }
      toast.success('Super admin eliminado.')
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <Link href="/super-admin" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldPlus className="w-5 h-5 text-indigo-600" />
          Gestión de Super Admins
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          El super admin principal definido en Vercel sigue siendo el principal. Desde aquí puedes agregar cuentas adicionales.
        </p>
        {principalEmail && (
          <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2">
            Principal: {principalEmail}
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Agregar super admin</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="email"
            placeholder="correo@dominio.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Nombre (opcional)"
            value={newFullName}
            onChange={(e) => setNewFullName(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
          <Button onClick={crear} disabled={saving || !newEmail.trim()} className="gap-2">
            <Save className="w-4 h-4" />
            Guardar
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">Activo</th>
              <th className="text-right px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {superAdmins.map((row) => (
              <tr key={row.id} className="border-t border-gray-200 dark:border-gray-700">
                <td className="px-4 py-3">{row.email}</td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    defaultValue={row.full_name ?? ''}
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if ((row.full_name ?? '') !== value) {
                        void actualizar(row.id, value || null, row.active)
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(e) => void actualizar(row.id, row.full_name, e.target.checked)}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => void eliminar(row.id)} disabled={saving}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
